import cv2, threading, time, os
from flask import Flask, Response, render_template, jsonify, request, send_file
from ultralytics import YOLO
from lane import lane_overlay
from sign_ocr import find_speed_limit   # OCR-based Indian sign detector

app = Flask(__name__)

# ─── Globals ───────────────────────────────────────────────────────────────
model        = None
current_frame = None
running       = False
frame_lock    = threading.Lock()
state_lock    = threading.Lock()

# COCO class groups relevant to ADAS
VEHICLE_CLASSES    = {1: 'bicycle', 2: 'car', 3: 'motorcycle', 5: 'bus', 7: 'truck'}
PERSON_CLASS       = 0
TRAFFIC_LIGHT_CLS  = 9
STOP_SIGN_CLS      = 11

# Shared detection state polled by the frontend every ~500 ms
detection_state = {
    "running":           False,
    "vehicle_count":     0,
    "person_count":      0,
    "traffic_light":     "None",
    "sign_detected":     None,
    "speed_limit":       None,
    "ocr_limit":         None,
    "detections":        [],
    "manual_speed":      None,
    "lane_departure":    None,
    "lane_enabled":      True,   # can be toggled from user settings
}


# ─── Model ─────────────────────────────────────────────────────────────────
def init_model(weights):
    global model
    if model is None:
        print("🔍 Loading YOLO…")
        model = YOLO(weights)
        print("✅ YOLO loaded")


# ─── Processing loop ───────────────────────────────────────────────────────
def process_loop(video, weights, is_webcam=False):
    global current_frame, running

    init_model(weights)
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        print(f"❌ Cannot open: {video}")
        running = False
        return

    src_label = "webcam" if is_webcam else video
    print(f"🎬 Processing: {src_label}")

    frame_idx     = 0
    OCR_INTERVAL  = 20   # run OCR every N frames (balance speed vs accuracy)
    last_ocr_limit = None  # last limit found by OCR

    while running:
        ret, frame = cap.read()
        if not ret:
            if is_webcam:
                # Webcam dropped a frame — just skip
                time.sleep(0.01)
                continue
            else:
                # Video file ended → loop
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_idx = 0
                continue

        # ── YOLO inference ──
        results   = model(frame, verbose=False)[0]
        vehicles  = 0
        persons   = 0
        tl        = "None"
        sign      = None
        det_list  = []

        for box in results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cls  = int(box.cls[0])
            conf = float(box.conf[0])
            name = results.names[cls]

            if cls in VEHICLE_CLASSES:
                vehicles += 1
                color = (0, 255, 80)
            elif cls == PERSON_CLASS:
                persons += 1
                color = (255, 165, 0)
            elif cls == TRAFFIC_LIGHT_CLS:
                tl = "Detected"
                color = (255, 255, 0)
            elif cls == STOP_SIGN_CLS:
                sign  = "stop"
                color = (0, 60, 255)
            else:
                color = (180, 180, 180)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"{name} {conf:.0%}"
            cv2.putText(frame, label, (x1, max(0, y1 - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.52, color, 2)
            det_list.append({"class": name, "conf": round(conf, 2)})

        # ── OCR speed-limit detection (every OCR_INTERVAL frames) ──
        frame_idx += 1
        if frame_idx % OCR_INTERVAL == 0:
            try:
                ocr_limit, frame = find_speed_limit(frame)
                if ocr_limit is not None:
                    last_ocr_limit = ocr_limit
            except Exception as e:
                print(f"⚠️  OCR error: {e}")

        # ── Lane overlay + departure detection ──
        if detection_state.get("lane_enabled", True):
            frame, departure = lane_overlay(frame)
        else:
            departure = None

        # ── Update shared state ──
        with state_lock:
            # Priority: stop sign (YOLO) > OCR number > previously set limit
            if sign == "stop":
                new_limit = 0
            elif last_ocr_limit is not None:
                new_limit = last_ocr_limit
            else:
                new_limit = detection_state["speed_limit"]

            detection_state.update({
                "running":        True,
                "vehicle_count":  vehicles,
                "person_count":   persons,
                "traffic_light":  tl,
                "sign_detected":  sign,
                "speed_limit":    new_limit,
                "ocr_limit":      last_ocr_limit,
                "detections":     det_list[:12],
                "lane_departure": departure,
            })

        with frame_lock:
            current_frame = frame.copy()

        time.sleep(0.01)

    cap.release()
    with state_lock:
        detection_state["running"] = False
    running = False
    print("🛑 Stopped")


# ─── MJPEG generator ───────────────────────────────────────────────────────
def gen_frames():
    while True:
        with frame_lock:
            f = current_frame
        if f is None:
            time.sleep(0.02)
            continue
        ok, buf = cv2.imencode('.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 78])
        if not ok:
            continue
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n'
               + buf.tobytes() + b'\r\n')
        time.sleep(0.033)   # ~30 fps cap


# ─── Routes ────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    """Marketing landing page first; click-through to /user."""
    return send_file("landingpage.html")


@app.route("/user")
def user_view():
    """Minimal CarPlay-style driver dashboard."""
    return render_template("user.html")


@app.route("/admin")
def admin_view():
    """Full admin / ADAS control panel."""
    videos = sorted([
        f for f in os.listdir("uploads")
        if f.lower().endswith(('.mp4', '.avi', '.mov'))
    ])
    return render_template("index.html", videos=videos)


@app.route("/start", methods=["POST"])
def start():
    global running
    data   = request.json or {}
    source = data.get("source", "file")   # "webcam" | "file"
    video  = data.get("video", "")

    if source == "webcam":
        cap_src    = 0          # default camera index
        is_webcam  = True
    else:
        if not video:
            return jsonify({"error": "No video selected"}), 400
        cap_src   = os.path.join("uploads", video)
        is_webcam = False
        if not os.path.exists(cap_src):
            return jsonify({"error": "Video not found"}), 404

    if running:
        return jsonify({"status": "already running"})

    running = True
    threading.Thread(target=process_loop,
                     args=(cap_src, "yolov8n.pt", is_webcam), daemon=True).start()
    return jsonify({"status": "started", "source": source})


@app.route("/stream")
def stream():
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route("/stop")
def stop():
    global running
    running = False
    return jsonify({"status": "stopped"})


@app.route("/state")
def state():
    with state_lock:
        return jsonify(dict(detection_state))


@app.route("/set_speed_limit", methods=["POST"])
def set_speed_limit():
    data  = request.json or {}
    limit = data.get("limit")
    with state_lock:
        detection_state["speed_limit"] = int(limit) if limit is not None else None
    return jsonify({"status": "ok", "speed_limit": detection_state["speed_limit"]})


@app.route("/set_manual_speed", methods=["POST"])
def set_manual_speed():
    """Admin sets current speed; user dashboard reads it."""
    data  = request.json or {}
    speed = data.get("speed")
    with state_lock:
        detection_state["manual_speed"] = int(speed) if speed is not None else None
    return jsonify({"status": "ok", "manual_speed": detection_state["manual_speed"]})


@app.route("/upload", methods=["POST"])
def upload():
    if "video" not in request.files:
        return jsonify({"error": "No file part"}), 400
    f = request.files["video"]
    if f.filename == "":
        return jsonify({"error": "No filename"}), 400
    save_path = os.path.join("uploads", f.filename)
    f.save(save_path)
    return jsonify({"status": "uploaded", "filename": f.filename})


@app.route("/images/<path:filename>")
def serve_wallpaper(filename):
    import os
    from flask import send_from_directory
    images_dir = os.path.join(app.root_path, 'templates', 'images')
    return send_from_directory(images_dir, filename)


@app.route("/toggle_lane", methods=["POST"])
def toggle_lane():
    data = request.json or {}
    enabled = data.get("enabled", True)
    with state_lock:
        detection_state["lane_enabled"] = bool(enabled)
    return jsonify({"status": "ok", "lane_enabled": detection_state["lane_enabled"]})


# ─── Entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("static",  exist_ok=True)
    print("✅  PixelOS ADAS")
    print("   Landing page   →  http://localhost:5002/")
    print("   User dashboard →  http://localhost:5002/user")
    print("   Admin panel    →  http://localhost:5002/admin")
    app.run(host="0.0.0.0", port=5002, threaded=True)
