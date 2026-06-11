pixelOS — ADAS Dashboard

> **See Smarter. Drive Safer.**

PixelOS is a real-time **Advanced Driver Assistance System (ADAS)** dashboard that uses computer vision and AI to enhance driving safety. It processes live camera input and provides intelligent insights like object detection, lane tracking, and traffic sign recognition — all in real time.

---

## ✨ Features

### 🚘 Object Detection

* Powered by **YOLOv8 (Ultralytics)**
* Detects vehicles, obstacles, and surroundings in real time
* Displays bounding boxes with basic depth estimation

### 🛣️ Lane Detection

* Uses **Canny Edge Detection + Hough Transform**
* Tracks lane boundaries continuously
* Triggers alerts when vehicle drifts out of lane

### 🚦 Traffic Sign Recognition

* OCR using **Tesseract**
* Detects Indian speed limit signs
* Fully **offline (no API required)**

### 👁️ Robot Eye UI

* Interactive visual assistant
* Responds dynamically to driving conditions
* Base for future AI-powered co-pilot

---

## 🛠️ Tech Stack

* **Python 3.10+**
* **YOLOv8 (Ultralytics)**
* **OpenCV**
* **Flask (Backend + Video Streaming)**
* **Tesseract OCR**

---

## ⚙️ Installation

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/ShlokPatil11/PixelOS.git
cd PixelOS
```

### 2️⃣ Create Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate
```

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Add YOLO Model

Download `yolov8n.pt` and place it in the project root folder

---

## ▶️ Run the Project

```bash
python app.py
```

Open in browser:

```
http://localhost:5000
```

---

## 📁 Project Structure

```
PixelOS/
│── app.py
│── detect.py
│── lane.py
│── sign_ocr.py
│── templates/
│── static/
│── requirements.txt
```

---

## 🚀 Future Improvements

* Voice-enabled AI co-pilot (OpenAI / Groq integration)
* Advanced distance estimation (depth models)
* Collision prediction system
* Mobile app integration

---



---

## 📜 License

MIT License

