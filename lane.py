# lane.py - Classical lane detection (Canny + Hough)

import cv2
import numpy as np
import warnings
warnings.filterwarnings('ignore', category=np.exceptions.RankWarning)

def region_of_interest(img, vertices):
    mask = np.zeros_like(img)
    cv2.fillPoly(mask, vertices, 255)
    masked = cv2.bitwise_and(img, mask)
    return masked

def draw_lines(img, lines):
    if lines is None:
        return img

    left_fit = []
    right_fit = []

    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x1 == x2:          # vertical line — skip (undefined slope)
            continue
        parameters = np.polyfit((x1, x2), (y1, y2), 1)
        slope = parameters[0]
        intercept = parameters[1]

        if slope < -0.5:  # left lane
            left_fit.append((slope, intercept))
        elif slope > 0.5:  # right lane
            right_fit.append((slope, intercept))

    y1 = img.shape[0]
    y2 = int(y1 * 0.6)

    line_img = img.copy()

    for fit in (left_fit, right_fit):
        if len(fit) > 0:
            slope, intercept = np.mean(fit, axis=0)
            x1 = int((y1 - intercept) / slope)
            x2 = int((y2 - intercept) / slope)
            cv2.line(line_img, (x1, y1), (x2, y2), (255, 0, 0), 5)

    return line_img

def get_lane_positions(lines, height):
    """Return (left_x, right_x) at the bottom of the frame, or None if not found."""
    left_fit = []
    right_fit = []

    if lines is None:
        return None, None

    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x1 == x2:
            continue
        params = np.polyfit((x1, x2), (y1, y2), 1)
        slope, intercept = params[0], params[1]
        if slope < -0.5:
            left_fit.append((slope, intercept))
        elif slope > 0.5:
            right_fit.append((slope, intercept))

    left_x  = None
    right_x = None
    y_bottom = height  # calculate x at bottom of frame

    if left_fit:
        slope, intercept = np.mean(left_fit, axis=0)
        left_x = int((y_bottom - intercept) / slope)
    if right_fit:
        slope, intercept = np.mean(right_fit, axis=0)
        right_x = int((y_bottom - intercept) / slope)

    return left_x, right_x


def lane_overlay(frame):
    """
    Draws lane lines on the frame, detects lane departure.
    Returns: (annotated_frame, departure)
      where departure is 'left' | 'right' | None
    """
    height, width = frame.shape[:2]

    gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    roi_vertices = np.array([[
        (0, height),
        (width//2 - 50, height//2),
        (width//2 + 50, height//2),
        (width, height)
    ]])

    roi = region_of_interest(edges, roi_vertices)

    lines = cv2.HoughLinesP(
        roi,
        rho=2,
        theta=np.pi/180,
        threshold=60,
        minLineLength=40,
        maxLineGap=100
    )

    frame = draw_lines(frame, lines)

    # ── Departure detection ──────────────────────────────────────────────────
    left_x, right_x = get_lane_positions(lines, height)
    departure = None

    vehicle_centre = width // 2  # camera is centre-mounted

    if left_x is not None and right_x is not None:
        lane_centre = (left_x + right_x) // 2
        offset = vehicle_centre - lane_centre
        tolerance = width * 0.07          # 7 % of frame width

        if offset > tolerance:
            departure = "right"           # drifting right of centre
        elif offset < -tolerance:
            departure = "left"            # drifting left of centre

        # Draw a subtle departure bar on video
        if departure:
            color = (0, 60, 255)
            label = f"LANE DEPARTURE — {departure.upper()}"
            cv2.rectangle(frame, (0, 0), (width, 36), color, -1)
            cv2.putText(frame, label, (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)

    return frame, departure
