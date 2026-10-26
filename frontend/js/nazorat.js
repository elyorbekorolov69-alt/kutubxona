// ================= NAZORAT ORGANI OYNASI =================
// Ma'lumot: /api/nazorat/maktablar, /api/buyurtmalar
// Faqat umumiy statistika: o'quvchilarning ismlari va telefonlari kelmaydi.

let maktablar = [];
let nSaralash = { ustun: "ortacha", yo: "desc" };
const holatTop = m => m.ortacha >= 5 ? ["Yaxshi", "chip-yaxshi", "yaxshi"] : m.ortacha < 3 ? ["E'tibor kerak", "chip-xavf", "etibor"] : ["O'rtacha", "chip-diqqat", "ortacha"];

async function nazoratniYukla(ism) {
  const [royxat] = await Promise.all([api("/nazorat/maktablar"), buyurtmalarniYukla()]);
  maktablar = royxat;
  el("nazIsm").textContent = ism || "";
  nazBuyurtmaChiz();

  const jamiOq = maktablar.reduce((s, m) => s + m.oquvchi, 0);
  const jamiKitob = maktablar.reduce((s, m) => s + m.oqilgan, 0);
  el("nMaktab").textContent = maktablar.length;
  el("nOquvchi").textContent = minglik(jamiOq);
  el("nOqilgan").textContent = minglik(jamiKitob);
  el("nOrtacha").textContent = jamiOq ? (jamiKitob / jamiOq).toFixed(1) : "0";

  // Tumanlar: bir o'quvchiga o'rtacha
  const tumanlar = [...new Set(maktablar.map(m => m.tuman))];
  const tq = tumanlar.map(t => {
    const ms = maktablar.filter(m => m.tuman === t);
    const oq = ms.reduce((s, m) => s + m.oquvchi, 0), k = ms.reduce((s, m) => s + m.oqilgan, 0);
    return { t, ort: oq ? k / oq : 0 };
  }).sort((a, b) => b.ort - a.ort);
  const eng = Math.max(0.1, ...tq.map(x => x.ort));
  el("nTumanlar").innerHTML = tq.map(x => `<div class="tuman-qator"><span class="tq-nom">${xavfsiz(x.t)}</span>
    <span class="tq-bar"><i style="width:${x.ort / eng * 100}%;${x.ort < 3 ? "background:var(--error)" : ""}"></i></span><span class="tq-son">${x.ort.toFixed(1)}</span></div>`).join("")
    || `<p class="bosh-xabar">Hali maktablar qo'shilmagan.</p>`;

  const tanlangan = el("nTuman").value;
  el("nTuman").innerHTML = `<option value="hammasi">Barcha tumanlar</option>` + tumanlar.sort().map(t => `<option>${xavfsiz(t)}</option>`).join("");
  if (tumanlar.includes(tanlangan)) el("nTuman").value = tanlangan;
  maktabJadvalChiz();
}

function maktabJadvalChiz() {
  const q = el("nQidiruv").value.trim().toLowerCase(), tuman = el("nTuman").value, hol = el("nHolat").value;
  const { ustun, yo } = nSaralash;
  const raqam = m => parseInt(m.nomi) || 0;
  const royxat = maktablar.filter(m =>
    (!q || m.nomi.toLowerCase().includes(q)) && (tuman === "hammasi" || m.tuman === tuman) && (hol === "hammasi" || holatTop(m)[2] === hol)
  ).sort((a, b) => {
    const x = ustun === "nom" ? raqam(a) : a[ustun], y = ustun === "nom" ? raqam(b) : b[ustun];
    const f = typeof x === "string" ? x.localeCompare(y) : x - y;
    return yo === "asc" ? f : -f;
  });
  el("nSoni").textContent = `${royxat.length} ta maktab`;
  el("nJadval").innerHTML = royxat.map(m => {
    const [matn, cls] = holatTop(m);
    return `<tr><td class="nom">${xavfsiz(m.nomi)}</td><td>${xavfsiz(m.tuman)}</td><td>${minglik(m.oquvchi)}</td><td>${minglik(m.fond)}</td>
      <td>${minglik(m.oqilgan)}</td><td><b>${m.ortacha.toFixed(1)}</b></td><td>${m.kech}%</td>
      <td><span class="chip ${cls}">${matn}</span></td></tr>`;
  }).join("");
  el("nBosh").hidden = royxat.length > 0;
  document.querySelectorAll("#nSarlavha .saralash").forEach(b => {
    if (b.dataset.ustun === ustun) b.dataset.yo = yo; else delete b.dataset.yo;
  });
}
document.querySelectorAll("#nSarlavha .saralash").forEach(b => b.addEventListener("click", () => {
  const u = b.dataset.ustun;
  nSaralash = { ustun: u, yo: nSaralash.ustun === u && nSaralash.yo === "desc" ? "asc" : (u === "nom" || u === "tuman" ? "asc" : "desc") };
  maktabJadvalChiz();
}));
["nQidiruv", "nTuman", "nHolat"].forEach(id => el(id).addEventListener(id === "nQidiruv" ? "input" : "change", maktabJadvalChiz));
