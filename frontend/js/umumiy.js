// ================= UMUMIY YORDAMCHILAR =================
// Boshqa hamma fayllar shu funksiyalardan foydalanadi.

const el = id => document.getElementById(id);

// Foydalanuvchidan yoki serverdan kelgan matnni HTML ichiga xavfsiz qo'yish uchun
const xavfsiz = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Sanalar ----------
// Server sanalarni "2026-10-06T00:00:00.000Z" ko'rinishida yuboradi. Bizga faqat "2026-10-06" qismi kerak.
const oylar = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const oyQisqa = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const kunMatn = s => (s ? String(s).slice(0, 10) : "");
const bugunMatn = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
const kunSon = s => Date.parse(kunMatn(s) + "T00:00:00Z") / 864e5;
const kunFarq = s => Math.round(kunSon(s) - kunSon(bugunMatn()));   // manfiy = o'tib ketgan
const qisqaSana = s => { const k = kunMatn(s); return `${Number(k.slice(8))}-${oylar[Number(k.slice(5, 7)) - 1]}`; };
const raqamSana = s => { const k = kunMatn(s); return k ? `${k.slice(8)}.${k.slice(5, 7)}.${k.slice(0, 4)}` : "—"; };
const minglik = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const qisqaIsm = ism => { const [a, b = ""] = String(ism).split(" "); return b ? `${a} ${b[0]}.` : a; };
const bosHarflar = ism => String(ism).split(" ").map(s => s[0] || "").join("").slice(0, 3).toUpperCase();

// Muddat holati: [matn, chip klassi]
function muddatHolati(muddat) {
  const f = kunFarq(muddat);
  if (f < 0) return [`${-f} kun kechikdi`, "chip-xavf"];
  if (f === 0) return ["Bugun qaytarish kerak", "chip-diqqat"];
  if (f === 1) return ["Ertaga muddati tugaydi", "chip-diqqat"];
  return [`${f} kun qoldi`, "chip-yaxshi"];
}
// Qaytarilgan kitob holati
function qaytishHolati(y) {
  if (!y.qaytarilgan) return kunFarq(y.muddat) < 0 ? ["Qo'lda, kechikmoqda", "chip-xavf"] : ["Qo'lda", "chip-qolda"];
  return kunMatn(y.qaytarilgan) > kunMatn(y.muddat) ? ["Kechikib qaytgan", "chip-diqqat"] : ["O'z vaqtida", "chip-yaxshi"];
}

// ---------- Telefon ----------
const yashirTel = t => { const p = String(t).split(" "); return p.length === 5 ? `${p[0]} ${p[1]} *** ** ${p[4]}` : "***"; };
// Yozilgan raqamni +998 XX XXX XX XX ko'rinishiga keltiradi
function telFormat(qiymat) {
  let r = qiymat.replace(/\D/g, "");
  if (r.startsWith("998")) r = r.slice(3);
  r = r.slice(0, 9);
  const q = [r.slice(0, 2), r.slice(2, 5), r.slice(5, 7), r.slice(7, 9)].filter(Boolean);
  return { matn: r.length ? "+998 " + q.join(" ") : "", toliq: r.length === 9 };
}

// ---------- Xabarlar ----------
let toastVaqt;
function toast(matn, xatomi = false) {
  const t = el("toast");
  t.textContent = matn;
  t.classList.toggle("xato-toast", xatomi);
  t.hidden = false;
  clearTimeout(toastVaqt);
  toastVaqt = setTimeout(() => (t.hidden = true), 4500);
}

// Forma maydonidagi xato: xato("loginMaydon", "loginXato", "Loginni kiriting.") yoki "" bilan tozalash
function xato(maydonId, xatoId, matn) {
  if (maydonId) el(maydonId).classList.toggle("xato", !!matn);
  el(xatoId).textContent = matn;
}

// Tugmani so'rov davomida o'chirib turish
async function tugmaBilan(tugma, matn, ishFn) {
  const eski = tugma.textContent;
  tugma.disabled = true;
  tugma.textContent = matn;
  try { return await ishFn(); }
  finally { tugma.disabled = false; tugma.textContent = eski; }
}

// Nusxa olish (ishlamasa, matn belgilanadi va qo'lda nusxalash mumkin)
function nusxaOl(matn, belgilaEl) {
  const yiqil = () => {
    const s = getSelection(), r = document.createRange();
    r.selectNodeContents(belgilaEl); s.removeAllRanges(); s.addRange(r);
    toast("Belgilandi. Ctrl+C (telefonda: Nusxalash) bilan oling.");
  };
  try { navigator.clipboard.writeText(matn).then(() => toast("Nusxa olindi."), yiqil); } catch { yiqil(); }
}

// ---------- Oyna ustidagi oynalar (modal) ----------
function modalOch(id) {
  el(id).hidden = false;
  const birinchi = el(id).querySelector("input, select, textarea, button:not([data-yop])");
  if (birinchi) birinchi.focus();
}
function modalYop(id) { el(id).hidden = true; }
document.addEventListener("click", e => {
  const fon = e.target.classList?.contains("modal-fon") ? e.target : null;
  if (fon) fon.hidden = true;                                       // fonni bosish yopadi
  const yop = e.target.closest("[data-yop]");
  if (yop) yop.closest(".modal-fon").hidden = true;                 // × tugmasi
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".modal-fon:not([hidden])").forEach(m => (m.hidden = true));
});

// ---------- Yuklanmoqda belgisi ----------
let yuklashSoni = 0, yuklashVaqt;
function yuklash(bormi) {
  yuklashSoni = Math.max(0, yuklashSoni + (bormi ? 1 : -1));
  clearTimeout(yuklashVaqt);
  // Tez javoblarda belgini umuman ko'rsatmaymiz, faqat 300 ms dan oshsa
  if (yuklashSoni) yuklashVaqt = setTimeout(() => (el("yuklash").hidden = false), 300);
  else el("yuklash").hidden = true;
}

// ================= VARAQLASH (oynadan oynaga o'tish) =================
// Oyna darhol almashadi. Eski oynaning bo'laklari shamolda uchib ketadi (effektlar.js).
// Yangi oyna index.html da keyin kelsa bo'laklar chapga, oldin kelsa o'ngga uchadi.
let joriyEkran = "ekranKirish";
let varaqlanmoqda = Promise.resolve();

function otish(yangiId) {
  varaqlanmoqda = varaqlanmoqda.then(() => varaqla(joriyEkran, yangiId));
  return varaqlanmoqda;
}

async function varaqla(eskiId, yangiId) {
  if (eskiId === yangiId) return;
  const eski = el(eskiId), yangi = el(yangiId);
  const yonalish = eski.compareDocumentPosition(yangi) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  joriyEkran = yangiId;
  // Bo'laklar eski oynaning ko'rinib turgan holatidan olinadi, shuning uchun yashirishdan oldin chaqiramiz
  if (!eski.hidden) Effektlar.yirt(eski, yonalish);
  eski.hidden = true;
  yangi.hidden = false;
  scrollTo(0, 0);
}

// ---------- Ovoz tugmasi (yuqori paneldagi "Ovoz: yoqiq / o'chiq") ----------
const ovozMatni = () => (Effektlar.ovozYoqilganmi() ? "Ovoz: yoqiq" : "Ovoz: o'chiq");
document.querySelectorAll(".ovoz-btn").forEach(b => {
  b.textContent = ovozMatni();
  b.addEventListener("click", () => {
    Effektlar.ovozniAlmashtir();
    document.querySelectorAll(".ovoz-btn").forEach(x => (x.textContent = ovozMatni()));
  });
});

// Har bir oyna tepasidagi ism va bosh harflar
function sarlavhaniToldir(ism) {
  document.querySelectorAll("[data-ism]").forEach(s => (s.textContent = ism));
  document.querySelectorAll("[data-avatar]").forEach(s => (s.textContent = bosHarflar(ism)));
}

// ---------- "»" tugmasi: raqam yonida, bosilsa ro'yxat ochiladi ----------
function ochkichHtml(son) {
  return `<button type="button" class="ochkich" aria-expanded="false" title="Ro'yxatni ko'rish">${son} <span aria-hidden="true">»</span></button>`;
}
function kitobChiplar(royxat, matnFn) {
  if (!royxat.length) return `<span class="izoh-kichik">Hali yo'q.</span>`;
  return royxat.map(x => `<span class="kitob-chip">${matnFn(x)}</span>`).join("");
}
// Jadvalda » bosilganda keyingi qatorda tafsilot ochiladi
function jadvalTafsil(och, ustunlar, tarkibHtml) {
  const tr = och.closest("tr");
  let tq = tr.nextElementSibling;
  if (!tq || !tq.classList.contains("tafsil-qator")) {
    tq = document.createElement("tr");
    tq.className = "tafsil-qator";
    tq.hidden = true;
    tq.innerHTML = `<td colspan="${ustunlar}"><div class="tafsil"></div></td>`;
    tr.after(tq);
  }
  const ochiq = och.getAttribute("aria-expanded") === "true";
  och.setAttribute("aria-expanded", String(!ochiq));
  tq.querySelector(".tafsil").innerHTML = tarkibHtml;
  tq.hidden = ochiq;
}
