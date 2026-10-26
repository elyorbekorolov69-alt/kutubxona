/*
 * effektlar.js — maktab kutubxonasi sayti uchun effektlar.
 * Hech qanday kutubxona kerak emas: oddiy JavaScript, Web Animations va Web Audio.
 *
 *   Effektlar.intro({ video, poster, tugaganda })  — kirish videosi; oxirida sayt kitob nuridan ochiladi
 *   Effektlar.yirt(eskiEkran, yonalish)            — eski oynani qog'oz bo'laklariga yirtib, shamolda uchiradi
 *                                                    yonalish: -1 = bo'laklar chapga (keyingi oyna), 1 = o'ngga (oldingi oyna)
 *   Effektlar.varaqOvozi(yonalish)                 — varaq ovozi (yirtilish, shitirlash, tushish)
 *   Effektlar.ovozniAlmashtir()                    — ovozni yoqadi/o'chiradi, true/false qaytaradi
 *   Effektlar.ovozYoqilganmi()                     — hozirgi holat
 */
(function () {
  "use strict";
  const kamHarakat = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- uslublar (alohida CSS fayl kerak bo'lmasin) ---------- */
  const css = `
.ef-intro{position:fixed;inset:0;z-index:9999;background:#0b0a0c;overflow:hidden}
.ef-intro video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 43%}
.ef-glow{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .45s ease-in}
.ef-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;background:rgba(10,14,22,.6);color:#fff3dd;
  border:1px solid rgba(255,214,150,.6);border-radius:999px;padding:14px 26px;font:600 16px/1 system-ui,sans-serif;cursor:pointer}
.ef-ctrl{position:absolute;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;z-index:3}
.ef-btn{background:rgba(10,14,22,.55);border:1px solid rgba(255,230,190,.3);color:#f5e9d6;border-radius:999px;padding:8px 14px;
  font:500 13px/1.2 system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px)}
.ef-btn:hover{border-color:rgba(255,210,140,.75)}
.ef-tear{position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden}
.ef-region{position:absolute;perspective:1100px}
.ef-piece{position:absolute;inset:0;will-change:transform}
.ef-piece>div{position:absolute;inset:0;overflow:hidden}
.ef-streak{position:absolute;left:0;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(255,240,215,0),rgba(255,236,205,.55),rgba(255,240,215,0))}
.ef-scrap{position:absolute;left:0;width:10px;height:7px;background:#efe6d2;border-radius:1px}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ============ OVOZ — kodda yaratiladi, ovoz fayli kerak emas ============ */
  const Ovoz = {
    yoqilgan: true, ctx: null, noise: null,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    },
    tayyor() {
      if (!this.yoqilgan) return false;
      this.init(); if (!this.ctx) return false;
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    },
    chiqish(daraja, pan) {
      const c = this.ctx, g = c.createGain(); g.gain.value = daraja;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = (pan || 0) * 0.4 + (Math.random() - 0.5) * 0.15; g.connect(p).connect(c.destination); }
      else g.connect(c.destination);
      return g;
    },
    zarb(dest, t, len, type, freq, q, peak) {
      const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.003, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 1.8); s.stop(t + len + 0.02);
    },
    // varaq: qisqa yirtilish, havoda shitirlash, quruq qirsillash va yerga yengil tushish
    varaq(yonalish) {
      if (!this.tayyor()) return;
      const c = this.ctx, t = c.currentTime + 0.01, out = this.chiqish(1.1, yonalish);
      for (let i = 0; i < 22; i++) this.zarb(out, t + i * 0.0065 + Math.random() * 0.004, 0.006 + Math.random() * 0.006, "highpass", 1800, 0.7, 0.12 + Math.random() * 0.22);
      const sw = c.createBufferSource(); sw.buffer = this.noise;
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 650;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(1300, t + 0.08); bp.frequency.exponentialRampToValueAtTime(5200, t + 0.2); bp.frequency.exponentialRampToValueAtTime(2100, t + 0.46);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + 0.08); g.gain.exponentialRampToValueAtTime(0.5, t + 0.13); g.gain.exponentialRampToValueAtTime(0.16, t + 0.26); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      sw.connect(hp).connect(bp).connect(g).connect(out); sw.start(t + 0.08, Math.random() * 1.4); sw.stop(t + 0.52);
      for (let i = 0; i < 14; i++) this.zarb(out, t + 0.1 + Math.pow(Math.random(), 1.5) * 0.32, 0.004 + Math.random() * 0.01, "bandpass", 2600 + Math.random() * 5200, 1.4, 0.1 + Math.random() * 0.28);
      this.zarb(out, t + 0.42, 0.09, "lowpass", 850, 0.7, 0.45);
    },
    shamol(dur, k) {
      if (!this.tayyor()) return;
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.7;
      f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(950, t + dur * 0.45); f.frequency.exponentialRampToValueAtTime(320, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * k, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(c.destination); src.start(t); src.stop(t + dur + 0.05);
    }
  };
  try { if (localStorage.getItem("kutubxona-ovoz") === "0") Ovoz.yoqilgan = false; } catch (e) {}

  /* ============ YIRTISH — eski oyna qog'oz bo'laklariga bo'linib, shamolda uchadi ============ */
  function tishli(a, b, chet) {   // yirtiq chet: to'g'ri chiziq emas, mayda tishlar bilan
    if (chet) return [a, b];
    const n = 5 + Math.floor(Math.random() * 4), pts = [a];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < n; i++) {
      const t = i / n + (Math.random() - 0.5) * 0.06;
      const amp = (Math.random() < 0.25 ? 11 : 5) * (Math.random() * 2 - 1);
      pts.push([a[0] + dx * t + nx * amp, a[1] + dy * t + ny * amp]);
    }
    pts.push(b); return pts;
  }
  let qatlam = null;
  function yirt(el, yonalish) {
    const dir = yonalish < 0 ? -1 : 1;
    Ovoz.varaq(dir); Ovoz.shamol(1.1, 0.35);
    if (kamHarakat || !el) return;
    const sr = el.getBoundingClientRect();
    const L = Math.max(0, sr.left), T = Math.max(0, sr.top), R = Math.min(innerWidth, sr.right), B = Math.min(innerHeight, sr.bottom);
    const w = R - L, h = B - T;
    if (w < 40 || h < 40) return;
    if (!qatlam) { qatlam = document.createElement("div"); qatlam.className = "ef-tear"; qatlam.setAttribute("aria-hidden", "true"); document.body.appendChild(qatlam); }
    const region = document.createElement("div");
    region.className = "ef-region";
    Object.assign(region.style, { left: L + "px", top: T + "px", width: w + "px", height: h + "px" });
    qatlam.appendChild(region);

    const cols = Math.max(3, Math.min(5, Math.round(w / 300))), rows = Math.max(3, Math.min(4, Math.round(h / 300)));
    const cw = w / cols, ch = h / rows, P = [];
    for (let r = 0; r <= rows; r++) { P[r] = []; for (let c = 0; c <= cols; c++) {
      const ichki = r > 0 && r < rows && c > 0 && c < cols;
      P[r][c] = [c * cw + (ichki ? (Math.random() - 0.5) * cw * 0.45 : 0), r * ch + (ichki ? (Math.random() - 0.5) * ch * 0.45 : 0)];
    } }
    const Hz = [], Vt = [];
    for (let r = 0; r <= rows; r++) { Hz[r] = []; for (let c = 0; c < cols; c++) Hz[r][c] = tishli(P[r][c], P[r][c + 1], r === 0 || r === rows); }
    for (let r = 0; r < rows; r++) { Vt[r] = []; for (let c = 0; c <= cols; c++) Vt[r][c] = tishli(P[r][c], P[r + 1][c], c === 0 || c === cols); }

    // eski oynaning nusxasi: har bir bo'lak shu nusxaning bir qismini ko'rsatadi
    const nusxa = el.cloneNode(true);
    nusxa.removeAttribute("id"); nusxa.removeAttribute("hidden");
    nusxa.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
    const cs = getComputedStyle(el);
    Object.assign(nusxa.style, { position: "absolute", margin: "0", left: (sr.left - L) + "px", top: (sr.top - T) + "px", width: sr.width + "px", height: sr.height + "px", boxSizing: "border-box",
      background: cs.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.body).backgroundColor : cs.backgroundColor, animation: "none", transition: "none" });

    let oxirgi = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const poly = [...Hz[r][c], ...Vt[r][c + 1].slice(1), ...Hz[r + 1][c].slice().reverse().slice(1), ...Vt[r][c].slice().reverse().slice(1, -1)];
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const piece = document.createElement("div"); piece.className = "ef-piece";
      const clip = document.createElement("div");
      clip.style.clipPath = `polygon(${poly.map(p => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(",")})`;
      clip.appendChild(nusxa.cloneNode(true));
      piece.appendChild(clip); region.appendChild(piece);
      piece.style.transformOrigin = `${cx}px ${cy}px`;
      // shamol avval shamol kelgan chetdagi bo'laklarni ko'taradi
      const kech = (((dir > 0 ? cx : w - cx) / w) * 0.42 + Math.random() * 0.08 + (cy / h) * 0.05) * 1000;
      const dur = rnd(1150, 1600);
      const sx = (cx - w / 2) * 0.03 + rnd(-5, 5), sy = rnd(-6, 4), sr0 = rnd(-4, 4);
      const tx = dir * innerWidth * rnd(0.75, 1.3), ty = innerHeight * rnd(-0.55, 0.1);
      const rz = rnd(-140, 140), rx = rnd(-170, 170), ry = rnd(-120, 120), sc = rnd(0.55, 0.85);
      piece.animate([
        { transform: "translate(0px,0px) rotate(0deg)", opacity: 1, easing: "ease-out" },
        { transform: `translate(${sx}px,${sy}px) rotate(${sr0}deg)`, offset: 0.12, easing: "cubic-bezier(.55,0,.75,.2)" },
        { opacity: 1, offset: 0.75 },
        { transform: `translate(${tx}px,${ty}px) rotate(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`, opacity: 0 }
      ], { duration: dur, delay: kech, fill: "both" });
      oxirgi = Math.max(oxirgi, kech + dur);
    }
    setTimeout(() => region.remove(), oxirgi + 100);

    // shamol chiziqlari va mayda qog'oz parchalari
    for (let i = 0; i < 11; i++) {
      const s = document.createElement("div"); s.className = "ef-streak";
      const sw = innerWidth * rnd(0.25, 0.5);
      Object.assign(s.style, { top: rnd(0.08, 0.92) * innerHeight + "px", width: sw + "px", opacity: "0" });
      qatlam.appendChild(s);
      const a = s.animate([
        { transform: `translateX(${dir > 0 ? -sw : innerWidth + sw}px)`, opacity: 0 },
        { opacity: 1, offset: 0.4 },
        { transform: `translateX(${dir > 0 ? innerWidth + sw : -sw}px)`, opacity: 0 }
      ], { duration: rnd(550, 900), delay: rnd(0, 350), easing: "ease-in" });
      a.onfinish = () => s.remove();
    }
    for (let i = 0; i < 8; i++) {
      const s = document.createElement("div"); s.className = "ef-scrap";
      s.style.top = rnd(0.2, 0.85) * innerHeight + "px"; s.style.opacity = "0";
      qatlam.appendChild(s);
      const a = s.animate([
        { transform: `translate(${dir > 0 ? -20 : innerWidth + 20}px,0px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${dir > 0 ? innerWidth + 40 : -40}px,${rnd(-160, 60)}px) rotate(${dir * rnd(200, 700)}deg)`, opacity: 1 }
      ], { duration: rnd(900, 1400), delay: rnd(100, 500), easing: "ease-in" });
      a.onfinish = () => s.remove();
    }
  }

  /* ============ KIRISH VIDEOSI ============ */
  // Video tik (9:16). Keng kompyuter ekranida u butun ekranni to'ldiradi va ko'rinadigan qism harakatga ergashadi:
  // quyosh → deraza → tushayotgan kitob → poldagi kitob. Har juftlik: [soniya, qiziq nuqtaning kadr balandligidagi ulushi].
  const FOCUS = [[0, 0.43], [1.8, 0.43], [3.6, 0.42], [4.2, 0.5], [4.6, 0.64], [5.0, 0.8], [5.3, 0.8], [5.8, 0.74], [6.4, 0.68], [8.1, 0.64]];
  function focusAt(t) {
    if (t <= FOCUS[0][0]) return FOCUS[0][1];
    for (let i = 0; i < FOCUS.length - 1; i++) {
      const [t0, f0] = FOCUS[i], [t1, f1] = FOCUS[i + 1];
      if (t <= t1) { const k = (t - t0) / (t1 - t0), e = k * k * (3 - 2 * k); return f0 + (f1 - f0) * e; }
    }
    return FOCUS[FOCUS.length - 1][1];
  }

  function intro(opts) {
    opts = opts || {};
    const tugaganda = typeof opts.tugaganda === "function" ? opts.tugaganda : function () {};
    const NUR = opts.nur || { x: 0.48, y: 0.62 };          // kitobdan nur chiqadigan joy (kadrda)
    const OCHILISH = opts.ochilishVaqti || 7.4;            // shu soniyada sayt ocha boshlaydi
    if (kamHarakat || !opts.video) { tugaganda(); return; }

    const qoplama = document.createElement("div");
    qoplama.className = "ef-intro";
    qoplama.setAttribute("aria-label", "Kirish videosi");
    qoplama.innerHTML = `<video playsinline preload="auto" muted></video><div class="ef-glow"></div>
      <button type="button" class="ef-play" hidden>▶ Videoni boshlash</button>
      <div class="ef-ctrl"><button type="button" class="ef-btn" data-ef="ovoz">Ovozni yoqish</button><button type="button" class="ef-btn" data-ef="otkaz">O‘tkazib yuborish →</button></div>`;
    const vid = qoplama.querySelector("video"), glow = qoplama.querySelector(".ef-glow"), play = qoplama.querySelector(".ef-play"), ovozBtn = qoplama.querySelector('[data-ef="ovoz"]');
    vid.src = opts.video; if (opts.poster) vid.poster = opts.poster;
    document.body.appendChild(qoplama);
    const eskiOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    let tugadi = false, ochilmoqda = false, raf = 0;
    function kadr() {
      const W = vid.videoWidth || 1080, H = vid.videoHeight || 1920;
      const s = Math.max(innerWidth / W, innerHeight / H), vw = W * s, vh = H * s;
      const f = focusAt(vid.currentTime || 0);
      const py = vh > innerHeight ? Math.min(1, Math.max(0, (f * vh - innerHeight / 2) / (vh - innerHeight))) : 0.5;
      return { s, left: (innerWidth - vw) / 2, top: -(vh - innerHeight) * py, py, W, H };
    }
    function ovozTugmasi() { ovozBtn.textContent = vid.muted ? "Ovozni yoqish" : "Ovozni o‘chirish"; }
    function boshla(ovozli) { vid.muted = !ovozli; ovozTugmasi(); return vid.play(); }
    function tugat() {
      if (tugadi) return; tugadi = true;
      cancelAnimationFrame(raf); vid.pause();
      qoplama.remove();
      document.documentElement.style.overflow = eskiOverflow;
      tugaganda();
    }
    function och() {   // nur kuchayadi, keyin uning markazidan ochilgan doira orqali sayt ko'rinadi
      ochilmoqda = true;
      const k = kadr(), x = k.left + NUR.x * k.W * k.s, y = k.top + NUR.y * k.H * k.s;
      const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 30;
      glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,248,228,.96), rgba(255,214,140,.55) 32%, rgba(255,190,90,0) 72%)`;
      glow.style.opacity = "1";
      if (!vid.muted) Ovoz.varaq(0);
      const t0 = performance.now() + 300, dur = 1100;
      (function step(now) {
        const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const r = e * R;
        const m = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, #000 ${r + 1}px)`;
        qoplama.style.webkitMaskImage = m; qoplama.style.maskImage = m;
        if (p < 1) requestAnimationFrame(step); else tugat();
      })(performance.now());
    }
    function kuzat() {
      if (tugadi) return;
      vid.style.objectPosition = `50% ${(kadr().py * 100).toFixed(2)}%`;
      if (!ochilmoqda && vid.currentTime >= OCHILISH) och();
      raf = requestAnimationFrame(kuzat);
    }
    vid.addEventListener("ended", () => { if (!ochilmoqda) och(); });
    vid.addEventListener("error", tugat);
    ovozBtn.addEventListener("click", () => {
      vid.muted = !vid.muted; ovozTugmasi();
      if (!vid.muted && !Ovoz.yoqilgan) { Ovoz.yoqilgan = true; try { localStorage.setItem("kutubxona-ovoz", "1"); } catch (e) {} }
      if (vid.paused) boshla(!vid.muted).catch(() => {});
    });
    qoplama.querySelector('[data-ef="otkaz"]').addEventListener("click", tugat);
    play.addEventListener("click", () => { play.hidden = true; boshla(true).catch(() => boshla(false)).catch(tugat); });

    raf = requestAnimationFrame(kuzat);
    // avval ovoz bilan; brauzer ruxsat bermasa — ovozsiz, u ham bo'lmasa — "Videoni boshlash" tugmasi
    boshla(Ovoz.yoqilgan).catch(() => boshla(false)).catch(() => { play.hidden = false; });
  }

  window.Effektlar = {
    intro,
    yirt,
    varaqOvozi: dir => Ovoz.varaq(dir || 0),
    ovozYoqilganmi: () => Ovoz.yoqilgan,
    ovozniAlmashtir() {
      Ovoz.yoqilgan = !Ovoz.yoqilgan;
      try { localStorage.setItem("kutubxona-ovoz", Ovoz.yoqilgan ? "1" : "0"); } catch (e) {}
      if (Ovoz.yoqilgan) Ovoz.varaq(0);
      return Ovoz.yoqilgan;
    }
  };
})();
