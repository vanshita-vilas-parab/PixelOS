# sign_ocr.py
# Detects Indian speed limit signs (white circle, red border, black number)
# Pipeline: HSV red-mask → circularity filter → EasyOCR digit read

import cv2
import numpy as np
import os, shutil, threading

# ── Lazy-loaded EasyOCR reader (loaded once, reused) ──────────────────────
_reader      = None
_reader_lock = threading.Lock()
EASYOCR_MODEL_DIR = os.path.join(os.path.expanduser('~'), '.EasyOCR', 'model')


def _clear_corrupt_models():
    """Delete EasyOCR model cache so it re-downloads fresh."""
    if os.path.exists(EASYOCR_MODEL_DIR):
        shutil.rmtree(EASYOCR_MODEL_DIR, ignore_errors=True)
        print("🗑️  Cleared corrupt EasyOCR model cache — will re-download")


def _load_reader():
    """Load (or reload) the EasyOCR reader, auto-recovering from corrupt files."""
    global _reader
    import easyocr
    for attempt in range(2):
        try:
            print(f"📖 Loading EasyOCR… (attempt {attempt + 1}, downloads ~100 MB on first run)")
            _reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            print("✅ EasyOCR ready")
            return
        except Exception as e:
            print(f"⚠️  EasyOCR load failed ({e}) — clearing cache and retrying…")
            _clear_corrupt_models()
    print("❌ EasyOCR could not load after 2 attempts. OCR disabled.")


def _get_reader():
    global _reader
    with _reader_lock:
        if _reader is None:
            _load_reader()
    return _reader


def preload_reader():
    """Call this at app startup to warm up EasyOCR in the background."""
    t = threading.Thread(target=_get_reader, daemon=True)
    t.start()


def find_speed_limit(frame, min_radius=16, max_radius=130):
    """
    Scans `frame` for an Indian speed-limit sign (white circle with red border).

    Returns
    -------
    (limit, annotated_frame)
        limit : int | None   — detected speed limit value, or None
        annotated_frame      — frame with debug drawings
    """
    h, w = frame.shape[:2]
    out  = frame.copy()

    # ── 1. Isolate red pixels (HSV) ──────────────────────────────────────
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    lower1, upper1 = np.array([0,   110,  70]), np.array([10,  255, 255])
    lower2, upper2 = np.array([158, 110,  70]), np.array([180, 255, 255])
    red_mask = cv2.bitwise_or(cv2.inRange(hsv, lower1, upper1),
                               cv2.inRange(hsv, lower2, upper2))

    # Morphological cleanup
    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    red_mask = cv2.morphologyEx(red_mask, cv2.MORPH_CLOSE, kern, iterations=2)
    red_mask = cv2.morphologyEx(red_mask, cv2.MORPH_OPEN,  kern, iterations=1)

    # ── 2. Find circular contours in the red mask ─────────────────────────
    contours, _ = cv2.findContours(red_mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)

    candidates = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 300:
            continue
        perim = cv2.arcLength(cnt, True)
        if perim < 1:
            continue
        circularity = 4 * np.pi * area / (perim ** 2)
        if circularity < 0.50:          # not round enough
            continue
        (cx, cy), radius = cv2.minEnclosingCircle(cnt)
        cx, cy, r = int(cx), int(cy), int(radius)
        if not (min_radius <= r <= max_radius):
            continue
        candidates.append((cx, cy, r))

    if not candidates:
        return None, out

    # ── 3. For each candidate, crop & OCR ────────────────────────────────
    reader = _get_reader()
    detected = None

    for (cx, cy, r) in candidates:
        pad = max(6, int(r * 0.30))
        x1 = max(0, cx - r - pad);  y1 = max(0, cy - r - pad)
        x2 = min(w, cx + r + pad);  y2 = min(h, cy + r + pad)
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        # Upscale tiny crops so OCR can read digits
        short = min(crop.shape[:2])
        if short < 64:
            scale = max(2, int(80 / short))
            crop  = cv2.resize(crop, None, fx=scale, fy=scale,
                               interpolation=cv2.INTER_CUBIC)

        # Preprocess: grayscale + Otsu threshold
        gray  = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        _, th = cv2.threshold(gray, 0, 255,
                              cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Try both binary and inverted — sometimes the sign is dark-on-light
        for img in (th, cv2.bitwise_not(th)):
            results = reader.readtext(img,
                                      allowlist='0123456789',
                                      detail=0,
                                      paragraph=False)
            for text in results:
                t = text.strip()
                if t.isdigit():
                    val = int(t)
                    if 10 <= val <= 120:        # plausible speed limit range
                        detected = val
                        # Draw indicator on output
                        cv2.circle(out, (cx, cy), r + 5, (0, 255, 80), 3)
                        cv2.putText(out, f"Limit:{val}",
                                    (cx - 35, cy - r - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    0.75, (0, 255, 80), 2)
                        break
            if detected:
                break
        if detected:
            break

    return detected, out
