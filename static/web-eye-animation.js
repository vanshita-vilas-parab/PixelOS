(function() {
    /* ─────────────────────────────────────────────
       CSS – Vector-style cyan OLED rectangular eyes
    ───────────────────────────────────────────── */
    function addCSS() {
        const style = document.createElement("style");
        style.textContent = `
            .eye-container {
                position: relative;
                width: 100%;
                height: 100%;
                background-color: transparent;
                overflow: hidden;
            }

            /* ── Robot Face Panel ── */
            .robot-face {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: min(340px, 72vw);
                height: min(280px, 58vw);
                background: radial-gradient(ellipse at 40% 30%, #1c1c1c 0%, #0a0a0a 70%);
                border-radius: 28px;
                box-shadow:
                    0 0 0 3px #222,
                    0 0 0 6px #111,
                    0 14px 55px rgba(0,0,0,0.92),
                    inset 0 2px 10px rgba(255,255,255,0.04);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 28px;
            }
            .robot-face::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 42%;
                border-radius: 28px 28px 0 0;
                background: linear-gradient(180deg, rgba(255,255,255,0.055) 0%, transparent 100%);
                pointer-events: none;
            }

            /* ── Eye (cyan OLED rectangle) ── */
            .robo-eye {
                width: 90px;
                height: 72px;
                background: #00e5ff;
                border-radius: 12px;
                box-shadow:
                    0 0 18px rgba(0,229,255,0.92),
                    0 0 42px rgba(0,229,255,0.52),
                    0 0 82px rgba(0,229,255,0.26),
                    inset 0 0 10px rgba(255,255,255,0.15);
                position: relative;
                flex-shrink: 0;
                overflow: hidden;
                transition: background 0.3s;
            }
            .robo-eye::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(155deg, rgba(255,255,255,0.22) 0%, transparent 55%);
                border-radius: inherit;
                pointer-events: none;
            }

            /* ── Top eyelid ── */
            .eye-lid {
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 0%;
                background: #0a0a0a;
                z-index: 10;
                border-radius: 12px 12px 0 0;
                pointer-events: none;
                transition: border-radius 0.15s;
            }
            /* ── Bottom eyelid ── */
            .eye-lid-bottom {
                position: absolute;
                bottom: 0; left: 0; right: 0;
                height: 0%;
                background: #0a0a0a;
                z-index: 10;
                border-radius: 0 0 12px 12px;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }
    addCSS();

    /* ─────────────────────────────────────────────
       DOM – Build face + eyes
    ───────────────────────────────────────────── */
    const eyeContainer = document.querySelector(".eye-container");
    if (!eyeContainer) return;

    const face = document.createElement("div");
    face.className = "robot-face";
    face.id = "robotFace";
    eyeContainer.appendChild(face);

    function makeEye(id) {
        const eye = document.createElement("div");
        eye.className = "robo-eye";
        eye.id = id;
        const lidTop = document.createElement("div");
        lidTop.className = "eye-lid";
        lidTop.id = id + "-lid";
        const lidBot = document.createElement("div");
        lidBot.className = "eye-lid-bottom";
        lidBot.id = id + "-lid-bottom";
        eye.appendChild(lidTop);
        eye.appendChild(lidBot);
        face.appendChild(eye);
        return eye;
    }

    const leftEye  = makeEye("leftEye");
    const rightEye = makeEye("rightEye");

    const leftLid   = document.getElementById("leftEye-lid");
    const rightLid  = document.getElementById("rightEye-lid");
    const leftLidB  = document.getElementById("leftEye-lid-bottom");
    const rightLidB = document.getElementById("rightEye-lid-bottom");

    const eyes    = [leftEye, rightEye];
    const lids    = [leftLid, rightLid];
    const lidsBot = [leftLidB, rightLidB];

    let isAnimating     = false;
    let blinkTimeoutId  = null;
    let idleIntervalId  = null;
    let isIdle          = false;

    let ws;
    const RECONNECT_SCHEDULE_MS = [5000, 10000, 20000, 40000, 80000];
    let reconnectAttemptIndex = 0;
    let reconnectTimeoutId    = null;

    /* ─────────────────────────────────────────────
       GSAP loader
    ───────────────────────────────────────────── */
    function loadGSAP(cb) {
        if (typeof gsap !== "undefined") { cb(); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/gsap.min.js";
        s.onload = cb;
        document.head.appendChild(s);
    }
    function ensureGSAP() {
        return new Promise(resolve => {
            if (typeof gsap !== "undefined") resolve();
            else loadGSAP(resolve);
        });
    }

    function expressEmotion(fn) {
        if (isAnimating) return;
        isAnimating = true;
        stopIdle();
        fn().then(() => {
            isAnimating = false;
            scheduleBlink();
        });
    }

    /* ─────────────────────────────────────────────
       IDLE ANIMATION — subtle living drift + glances
    ───────────────────────────────────────────── */
    const IDLE_MOVES = [
        // Glance left
        () => ensureGSAP().then(() => gsap.to(face, { x: -22, y: 0, duration: 0.6, ease: "power2.inOut" })
            .then(() => gsap.to(face, { x: 0, duration: 0.5, ease: "power2.inOut", delay: 0.7 }))),
        // Glance right
        () => ensureGSAP().then(() => gsap.to(face, { x: 22, y: 0, duration: 0.6, ease: "power2.inOut" })
            .then(() => gsap.to(face, { x: 0, duration: 0.5, ease: "power2.inOut", delay: 0.7 }))),
        // Glance up
        () => ensureGSAP().then(() => gsap.to(face, { y: -14, duration: 0.55, ease: "power2.inOut" })
            .then(() => gsap.to(face, { y: 0, duration: 0.5, ease: "power2.inOut", delay: 0.6 }))),
        // Subtle squint (curious look)
        () => ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lids, { height: "18%", duration: 0.35, ease: "sine.inOut" })
              .to(lids, { height: "0%",  duration: 0.35, ease: "sine.inOut", delay: 0.6 });
            return tl;
        }),
        // Small bounce (alive feel)
        () => ensureGSAP().then(() =>
            gsap.to(face, { y: -8, duration: 0.3, ease: "power2.out" })
                .then(() => gsap.to(face, { y: 0, duration: 0.35, ease: "bounce.out" }))
        ),
        // Eye size breathe (slow pulse)
        () => ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(eyes, { scaleX: 1.06, scaleY: 1.06, duration: 0.7, ease: "sine.inOut" })
              .to(eyes, { scaleX: 1,    scaleY: 1,    duration: 0.7, ease: "sine.inOut" });
            return tl;
        }),
    ];

    function runIdleMove() {
        if (isAnimating) return;
        const fn = IDLE_MOVES[Math.floor(Math.random() * IDLE_MOVES.length)];
        fn();
    }

    function startIdle() {
        if (idleIntervalId) return;
        isIdle = true;
        idleIntervalId = setInterval(runIdleMove, 2800 + Math.random() * 1500);
    }

    function stopIdle() {
        if (idleIntervalId) { clearInterval(idleIntervalId); idleIntervalId = null; }
        isIdle = false;
        ensureGSAP().then(() => gsap.to(face, { x: 0, y: 0, duration: 0.4, ease: "power2.out" }));
    }

    /* expose so index.html can call */
    window.startIdleAnimation = startIdle;
    window.stopIdleAnimation  = stopIdle;

    /* ─────────────────────────────────────────────
       EXPRESSIONS
    ───────────────────────────────────────────── */

    /* NEUTRAL */
    function expressNeutral() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lids,    { height: "0%", duration: 0.2 })
              .to(lidsBot,  { height: "0%", duration: 0.2 }, "<")
              .to(eyes,     { scaleX: 1, scaleY: 1, x: 0, y: 0, rotate: 0,
                              background: "#00e5ff",
                              boxShadow: "0 0 18px rgba(0,229,255,0.92), 0 0 42px rgba(0,229,255,0.52)",
                              duration: 0.3 }, "<");
            return tl;
        });
    }

    /* HAPPY / JOY */
    function expressJoy() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(eyes, { scaleX: 1.14, scaleY: 1.2, y: -7,
                          boxShadow: "0 0 28px rgba(0,229,255,1), 0 0 60px rgba(0,229,255,0.7)",
                          duration: 0.2, ease: "back.out(2)" })
              .to(eyes, { scaleY: 0.92, duration: 0.12, ease: "power2.in" })
              .to(eyes, { scaleY: 1.18, duration: 0.1,  ease: "back.out(2)" })
              .to(eyes, { scaleX: 1.1,  scaleY: 1.1, y: -5, duration: 0.18 })
              .to(eyes, { scaleX: 1, scaleY: 1, y: 0,
                          boxShadow: "0 0 18px rgba(0,229,255,0.92), 0 0 42px rgba(0,229,255,0.52)",
                          duration: 0.35, ease: "elastic.out(1,0.5)", delay: 0.5 });
            return tl;
        });
    }

    /* SAD */
    function expressSadness() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lidsBot, { height: "30%", duration: 0.7, ease: "sine.inOut" })
              .to(eyes, { y: 10, scaleX: 0.88, duration: 0.6 }, "<")
              .to(eyes, { scaleY: 0.85, duration: 0.35, delay: 0.2 })
              .to(lidsBot, { height: "0%", duration: 0.6, delay: 0.5 })
              .to(eyes, { y: 0, scaleX: 1, scaleY: 1, duration: 0.45, ease: "sine.out" }, "<");
            return tl;
        });
    }

    /* GLEE (squint-smile from top) */
    function expressLove() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lids, { height: "40%", duration: 0.22, ease: "power3.out" })
              .to(eyes, { scaleX: 1.15, duration: 0.15, ease: "power2.inOut" }, "<")
              .to(eyes, { scaleX: 1, duration: 0.2 }, ">0.35")
              .to(lids, { height: "0%", duration: 0.28, ease: "power2.out", delay: 0.55 });
            return tl;
        });
    }

    /* EXCITED */
    function expressExcitement() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(eyes, { scaleX: 1.2, scaleY: 1.25, y: -9,
                          boxShadow: "0 0 32px rgba(0,229,255,1), 0 0 75px rgba(0,229,255,0.8)",
                          duration: 0.14, ease: "back.out(3)" })
              .to(eyes, { y: "+=14", duration: 0.07, yoyo: true, repeat: 5, ease: "power1.inOut" })
              .to(eyes, { scaleX: 1, scaleY: 1, y: 0,
                          boxShadow: "0 0 18px rgba(0,229,255,0.92), 0 0 42px rgba(0,229,255,0.52)",
                          duration: 0.3, ease: "elastic.out(1,0.6)" });
            return tl;
        });
    }

    /* ANGRY */
    function expressAnger() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lids, { height: "46%", duration: 0.14, ease: "power3.out" })
              .to(leftLid,  { borderRadius: "0 12px 0 0", duration: 0.14 }, "<")
              .to(rightLid, { borderRadius: "12px 0 0 0", duration: 0.14 }, "<")
              .to(eyes, { background: "#ff3333",
                          boxShadow: "0 0 28px rgba(255,50,50,0.95), 0 0 65px rgba(255,40,40,0.6)",
                          scaleX: 1.08, duration: 0.12 }, "<")
              .to(face, { x: "+=9", duration: 0.04, yoyo: true, repeat: 9, ease: "power1.inOut" })
              .to(face, { x: 0, duration: 0.05 })
              .to(lids, { height: "0%", borderRadius: "12px 12px 0 0", duration: 0.22, delay: 0.35 })
              .to(eyes, { background: "#00e5ff",
                          boxShadow: "0 0 18px rgba(0,229,255,0.92), 0 0 42px rgba(0,229,255,0.52)",
                          scaleX: 1, duration: 0.28 }, "<");
            return tl;
        });
    }

    /* CONFUSED */
    function expressConfusion() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(leftEye,  { scaleY: 1.2, scaleX: 1.08, y: -5, duration: 0.2, ease: "power2.out" })
              .to(rightEye, { scaleY: 0.55, rotate: 9, duration: 0.2, ease: "power2.out" }, "<")
              .to(face, { x: "+=9", duration: 0.07, yoyo: true, repeat: 5 })
              .to(eyes, { scaleX: 1, scaleY: 1, rotate: 0, y: 0, duration: 0.28, ease: "elastic.out(1,0.6)" })
              .to(face, { x: 0, duration: 0.1 }, "<");
            return tl;
        });
    }

    /* SLEEPY */
    function expressSleepy() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lids, { height: "64%", duration: 1.0, ease: "sine.inOut" })
              .to(eyes, { scaleX: 0.9, duration: 0.8 }, "<")
              .to(lids, { height: "97%", duration: 0.6, ease: "power1.in" })
              .to(lids, { height: "64%", duration: 0.48, ease: "sine.out" })
              .to(lids, { height: "97%", duration: 0.5, delay: 0.35 })
              .to(lids, { height: "64%", duration: 0.45, ease: "sine.out" })
              .to(lids, { height: "0%", duration: 0.85, delay: 0.45, ease: "sine.in" })
              .to(eyes, { scaleX: 1, duration: 0.5 }, "<");
            return tl;
        });
    }

    /* WORRIED */
    function expressWorried() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(leftEye,  { scaleY: 1.15, y: -4, rotate: -5, duration: 0.28, ease: "power2.out" })
              .to(rightEye, { scaleY: 1.15, y: -4, rotate: 5,  duration: 0.28, ease: "power2.out" }, "<")
              .to(eyes, { x: "+=5", duration: 0.07, yoyo: true, repeat: 4 })
              .to(eyes, { scaleY: 1, y: 0, rotate: 0, x: 0, duration: 0.3, ease: "elastic.out(1,0.6)" });
            return tl;
        });
    }

    /* ANNOYED */
    function expressAnnoyed() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lids,    { height: "42%", duration: 0.2, ease: "power3.out" })
              .to(lidsBot,  { height: "14%", duration: 0.2 }, "<")
              .to(eyes, { scaleX: 0.95, y: 5, duration: 0.2 }, "<")
              .to(eyes, { x: "+=4", duration: 0.06, yoyo: true, repeat: 3 })
              .to(lids,    { height: "0%", duration: 0.25, delay: 0.65 })
              .to(lidsBot,  { height: "0%", duration: 0.25 }, "<")
              .to(eyes, { scaleX: 1, y: 0, x: 0, duration: 0.25 }, "<");
            return tl;
        });
    }

    /* SURPRISED */
    function expressSurprise() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(eyes, { scaleX: 1.36, scaleY: 1.42,
                          boxShadow: "0 0 30px rgba(0,229,255,1), 0 0 70px rgba(0,229,255,0.75)",
                          duration: 0.12, ease: "back.out(4)" })
              .to(eyes, { scaleX: 1, scaleY: 1,
                          boxShadow: "0 0 18px rgba(0,229,255,0.92), 0 0 42px rgba(0,229,255,0.52)",
                          duration: 0.36, delay: 0.58, ease: "elastic.out(1,0.58)" });
            return tl;
        });
    }

    /* SKEPTIC */
    function expressSkeptic() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(leftLid,  { height: "50%", duration: 0.2, ease: "power2.out" })
              .to(rightEye, { scaleX: 1.05, duration: 0.2 }, "<")
              .to(leftEye,  { x: -4, duration: 0.1 })
              .to(leftLid,  { height: "0%", duration: 0.22, delay: 0.75 })
              .to(leftEye,  { x: 0, duration: 0.2 }, "<")
              .to(rightEye, { scaleX: 1, duration: 0.2 }, "<");
            return tl;
        });
    }

    /* UNIMPRESSED */
    function expressUnimpressed() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lids, { height: "46%", duration: 0.55, ease: "sine.inOut" })
              .to(eyes, { y: 6, duration: 0.4 }, "<")
              .to(lids, { height: "0%", duration: 0.4, delay: 0.92 })
              .to(eyes, { y: 0, duration: 0.35 }, "<");
            return tl;
        });
    }

    /* FOCUSED */
    function expressFocused() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            tl.to(lids, { height: "28%", duration: 0.17, ease: "power3.out" })
              .to(eyes, { scaleX: 1.08,
                          boxShadow: "0 0 24px rgba(0,229,255,1), 0 0 55px rgba(0,229,255,0.7)",
                          duration: 0.17 }, "<")
              .to(lids, { height: "0%", duration: 0.22, delay: 0.68 })
              .to(eyes, { scaleX: 1,
                          boxShadow: "0 0 18px rgba(0,229,255,0.92), 0 0 42px rgba(0,229,255,0.52)",
                          duration: 0.22 }, "<");
            return tl;
        });
    }

    /* WAKE — eyes snap open wide + glow burst (triggered by wake word) */
    function expressWake() {
        return ensureGSAP().then(() => {
            const tl = gsap.timeline();
            // quick blink then burst open
            tl.to(lids, { height: "98%", duration: 0.08 })
              .to(lids, { height: "0%",  duration: 0.06 })
              .to(eyes, { scaleX: 1.3, scaleY: 1.38,
                          boxShadow: "0 0 40px rgba(0,229,255,1), 0 0 90px rgba(0,229,255,0.85)",
                          duration: 0.14, ease: "back.out(3)" })
              .to(face, { y: -10, duration: 0.14, ease: "back.out(2)" }, "<")
              .to(eyes, { scaleX: 1, scaleY: 1,
                          boxShadow: "0 0 18px rgba(0,229,255,0.92), 0 0 42px rgba(0,229,255,0.52)",
                          duration: 0.32, delay: 0.22, ease: "elastic.out(1,0.55)" })
              .to(face, { y: 0, duration: 0.28, ease: "elastic.out(1,0.55)" }, "<");
            return tl;
        });
    }

    /* ─────────────────────────────────────────────
       Blink
    ───────────────────────────────────────────── */
    function singleBlink() {
        return ensureGSAP().then(() =>
            gsap.timeline()
                .to(lids, { height: "97%", duration: 0.07 })
                .to(lids, { height: "0%",  duration: 0.07 })
        );
    }
    function doubleBlink() {
        return ensureGSAP().then(() =>
            gsap.timeline()
                .to(lids, { height: "97%", duration: 0.07 })
                .to(lids, { height: "0%",  duration: 0.07 })
                .to(lids, { height: "97%", duration: 0.07, delay: 0.11 })
                .to(lids, { height: "0%",  duration: 0.07 })
        );
    }
    function blink() {
        if (isAnimating) { scheduleBlink(); return; }
        const tl = Math.random() < 0.65 ? singleBlink() : doubleBlink();
        tl.then(scheduleBlink);
    }
    function scheduleBlink() {
        if (blinkTimeoutId) clearTimeout(blinkTimeoutId);
        blinkTimeoutId = setTimeout(blink, Math.random() * 5000 + 1500);
    }

    /* ─────────────────────────────────────────────
       Eye / face cursor tracking
    ───────────────────────────────────────────── */
    function moveEyes(x, y, reg = false) {
        return ensureGSAP().then(() => {
            const rect    = eyeContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width  / 2;
            const centerY = rect.top  + rect.height / 2;
            if (reg) { x *= window.innerWidth; y *= window.innerHeight; }
            const dx = (x - centerX) * 0.07;
            const dy = (y - centerY) * 0.07;
            gsap.to(face, { x: dx, y: dy, duration: 0.35, ease: "power2.out" });
        });
    }

    function moveEyesTarget(x, y, z, focalLength = 1000) {
        return ensureGSAP().then(() => {
            const px = (x / (z + focalLength)) * window.innerWidth  / 2;
            const py = (y / (z + focalLength)) * window.innerHeight / 2;
            gsap.to(face, { x: px, y: py, duration: 0.3 });
        });
    }

    function resetEyes() {
        return ensureGSAP().then(() =>
            gsap.to(face, { x: 0, y: 0, duration: 0.5, ease: "power2.out" })
        );
    }

    document.addEventListener("mousemove", (e) => {
        const rect = eyeContainer.getBoundingClientRect();
        const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                       e.clientY >= rect.top  && e.clientY <= rect.bottom;
        if (inside) moveEyes(e.clientX, e.clientY);
        else resetEyes();
    });

    scheduleBlink();

    /* ─────────────────────────────────────────────
       runEmotion dispatch
    ───────────────────────────────────────────── */
    function runEmotion(emotion) {
        switch (emotion) {
            case "joy":         expressEmotion(expressJoy);         break;
            case "love":        expressEmotion(expressLove);        break;
            case "excitement":  expressEmotion(expressExcitement);  break;
            case "anger":       expressEmotion(expressAnger);       break;
            case "confusion":   expressEmotion(expressConfusion);   break;
            case "sleepy":      expressEmotion(expressSleepy);      break;
            case "worried":     expressEmotion(expressWorried);     break;
            case "annoyed":     expressEmotion(expressAnnoyed);     break;
            case "surprise":    expressEmotion(expressSurprise);    break;
            case "skeptic":     expressEmotion(expressSkeptic);     break;
            case "unimpressed": expressEmotion(expressUnimpressed); break;
            case "sadness":     expressEmotion(expressSadness);     break;
            case "focused":     expressEmotion(expressFocused);     break;
            case "neutral":     expressEmotion(expressNeutral);     break;
            case "wake":        expressEmotion(expressWake);        break;
            default: console.log("Unknown emotion:", emotion);
        }
    }

    /* ─────────────────────────────────────────────
       WebSocket
    ───────────────────────────────────────────── */
    function startWebSocket(ip_address, port = 8765, protocol = "wss") {
        if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
        const url = `${protocol === "wss" ? "wss" : "ws"}://${ip_address}:${port}`;
        ws = new WebSocket(url);
        ws.onopen  = () => { reconnectAttemptIndex = 0; if (reconnectTimeoutId) { clearTimeout(reconnectTimeoutId); reconnectTimeoutId = null; } };
        ws.onmessage = (event) => {
            const parts = event.data.split(" ");
            if (parts[0] === "emotion") {
                runEmotion(parts[1]);
            } else if (parts[0] === "eye" && parts[1] === "target" && parts.length === 6) {
                const [,, x, y, z, fl] = parts.map(parseFloat);
                if (![x,y,z,fl].some(isNaN)) moveEyesTarget(x, y, z, fl);
            } else if (parts[0] === "eye" && parts.length === 3) {
                const x = parseFloat(parts[1]), y = parseFloat(parts[2]);
                const rect = eyeContainer.getBoundingClientRect();
                if (!isNaN(x) && !isNaN(y)) moveEyes(x * rect.width, y * rect.height);
            }
        };
        ws.onclose = () => scheduleReconnect(ip_address, port, protocol);
        ws.onerror = () => scheduleReconnect(ip_address, port, protocol);
    }

    let connectionConfig = { host: null, port: 8765, protocol: "wss" };
    function scheduleReconnect(ip, port, protocol) {
        connectionConfig = { host: ip, port: port ?? 8765, protocol: protocol ?? "wss" };
        if (reconnectTimeoutId) { clearTimeout(reconnectTimeoutId); reconnectTimeoutId = null; }
        if (reconnectAttemptIndex >= RECONNECT_SCHEDULE_MS.length) return;
        const delay = RECONNECT_SCHEDULE_MS[reconnectAttemptIndex++];
        reconnectTimeoutId = setTimeout(() => {
            reconnectTimeoutId = null;
            if (ws.readyState === WebSocket.CLOSED)
                startWebSocket(connectionConfig.host, connectionConfig.port, connectionConfig.protocol);
        }, delay);
    }

    window.eyes = { websocket: startWebSocket, emotion: runEmotion, move: moveEyes, target: moveEyesTarget };

    function autoConnectWebSocket() {
        const hostMeta     = document.querySelector("meta[name=\"websocket-host\"]");
        const portMeta     = document.querySelector("meta[name=\"websocket-port\"]");
        const protocolMeta = document.querySelector("meta[name=\"websocket-protocol\"]");
        if (!hostMeta) return;
        const host     = hostMeta.getAttribute("content") || "localhost";
        const port     = portMeta     ? parseInt(portMeta.getAttribute("content"), 10) || 8765 : 8765;
        const protocol = protocolMeta ? protocolMeta.getAttribute("content") || "ws" : "ws";
        startWebSocket(host, port, protocol);
    }
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", autoConnectWebSocket);
    else
        autoConnectWebSocket();
})();