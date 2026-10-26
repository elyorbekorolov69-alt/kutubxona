// ================= KITOB BUYURTMALARI =================
// Yo'l: Kutubxonachi buyurtma beradi → Direktor tasdiqlaydi → Nazorat organi tasdiqlaydi.
// Server nazorat organiga faqat direktor tasdiqlagan buyurtmalarni yuboradi.

const BOSQICHLAR = ["Yuborildi", "Direktor", "Nazorat", "Tasdiqlandi"];
const HOLAT = {
  direktor:     ["Direktor ko'rib chiqmoqda", "chip-diqqat", 1],
  nazorat:      ["Nazoratda", "chip-diqqat", 2],
  tasdiqlandi:  ["Tasdiqlandi", "chip-yaxshi", 3],
  rad_direktor: ["Direktor rad etdi", "chip-xavf", 1],
  rad_nazorat:  ["Nazorat rad etdi", "chip-xavf", 2]
};
let buyurtmalar = [];
const buyurtmaRaqami = b => "B-" + String(b.id).padStart(4, "0");

// Bitta buyurtma kartochkasi. amal: null (faqat ko'rish) yoki true (Tasdiqlash / Rad etish tugmalari bilan)
function buyurtmaKarta(b, amal) {
  const [yorliq, cls, idx] = HOLAT[b.holat];
  const rad = b.holat.startsWith("rad");
  const d = document.createElement("article");
  d.className = "buyurtma";
  d.dataset.id = b.id;
  d.innerHTML = `
    <div class="b-bosh">
      <div><span class="b-raqam">${buyurtmaRaqami(b)} · ${xavfsiz(b.maktab?.nomi || "")} · ${qisqaSana(b.yaratilgan)}</span><h3>${xavfsiz(b.kitobNomi)}</h3><p class="b-muallif">${xavfsiz(b.muallif || "Muallif ko'rsatilmagan")}</p></div>
      <span class="chip ${cls}">${yorliq}</span>
    </div>
    <div class="b-malumot"><span><b>${b.soni}</b> nusxa</span><span class="b-sabab">${xavfsiz(b.sabab || "")}</span></div>
    <ol class="bosqich">${BOSQICHLAR.map((n, i) => {
      const c = i < idx || (i === idx && b.holat === "tasdiqlandi") ? "otdi" : i === idx ? (rad ? "rad" : "hozir") : "";
      return `<li class="${c}"><i></i><span>${n}</span></li>`;
    }).join("")}</ol>
    <ul class="b-tarix">${b.tarix.map(t =>
      `<li>${qisqaSana(t.sana)} · ${xavfsiz(t.kim)}: ${xavfsiz(t.matn)}${t.izoh ? `<span class="izohm">“${xavfsiz(t.izoh)}”</span>` : ""}</li>`).join("")}</ul>`;
  if (amal) {
    const a = document.createElement("div");
    a.className = "b-amal";
    a.innerHTML = `<label for="izoh-${b.id}">Izoh <span class="teg">rad etishda majburiy</span></label>
      <textarea id="izoh-${b.id}" rows="2" placeholder="Masalan: Roziman / Soni ko'p, kamaytiring"></textarea>
      <div class="b-xato"></div>
      <div class="b-tugmalar">
        <button type="button" class="btn-ha" data-amal="ha">Tasdiqlash</button>
        <button type="button" class="btn-yoq" data-amal="yoq">Rad etish</button>
      </div>`;
    d.appendChild(a);
  }
  return d;
}

function royxatgaQoy(konteynerId, royxat, amal) {
  const k = el(konteynerId);
  k.innerHTML = "";
  royxat.forEach(b => k.appendChild(buyurtmaKarta(b, amal)));
}

async function buyurtmalarniYukla() {
  buyurtmalar = await api("/buyurtmalar");
}

// --- Kutubxonachi: buyurtma oynasi ---
function kutBuyurtmaChiz() {
  const son = h => buyurtmalar.filter(b => h(b.holat)).length;
  el("bTDir").textContent = son(h => h === "direktor");
  el("bTNaz").textContent = son(h => h === "nazorat");
  el("bTHa").textContent = son(h => h === "tasdiqlandi");
  el("bTYoq").textContent = son(h => h.startsWith("rad"));
  royxatgaQoy("bRoyxat", buyurtmalar, false);
  if (!buyurtmalar.length) el("bRoyxat").innerHTML = `<p class="bosh-xabar">Hali buyurtma berilmagan.</p>`;
}

async function buyurtmaOynasiniOch() {
  try {
    const [, kitoblar] = await Promise.all([buyurtmalarniYukla(), api("/kutubxonachi/kitoblar")]);
    el("kitobRoyxat").innerHTML = kitoblar.map(k => `<option value="${xavfsiz(k.nomi)}"></option>`).join("");
    el("kitobRoyxat").dataset.kitoblar = JSON.stringify(kitoblar.map(k => [k.nomi, k.muallif]));
    kutBuyurtmaChiz();
    await otish("ekranBuyurtma");
  } catch (e) { xatoniKorsat(e); }
}

el("bKitob").addEventListener("change", () => {        // katalogdagi kitob tanlansa, muallif o'zi yoziladi
  const royxat = JSON.parse(el("kitobRoyxat").dataset.kitoblar || "[]");
  const k = royxat.find(x => x[0] === el("bKitob").value.trim());
  if (k && !el("bMuallif").value.trim()) el("bMuallif").value = k[1];
});

el("bForma").addEventListener("submit", async e => {
  e.preventDefault();
  const kitobNomi = el("bKitob").value.trim(), soni = Number(el("bSoni").value);
  const kitobOk = kitobNomi.length > 1, soniOk = Number.isInteger(soni) && soni >= 1 && soni <= 500;
  xato("bKitobM", "bKitobX", kitobOk ? "" : "Kitob nomini yozing.");
  xato("bSoniM", "bSoniX", soniOk ? "" : "1 dan 500 gacha butun son kiriting.");
  if (!kitobOk || !soniOk) return;
  const tugma = el("bForma").querySelector("button[type=submit]");
  try {
    const b = await tugmaBilan(tugma, "Yuborilmoqda...", () => api("/buyurtmalar", { method: "POST", body: {
      kitobNomi, soni, muallif: el("bMuallif").value.trim() || null, sabab: el("bSabab").value.trim() || null
    } }));
    el("bForma").reset();
    el("bSoni").value = 10;
    await buyurtmalarniYukla();
    kutBuyurtmaChiz();
    toast(`Buyurtma ${buyurtmaRaqami(b)} direktorga yuborildi.`);
  } catch (e) { xatoniKorsat(e); }
});

// --- Direktor va nazorat: qaror qabul qilish ---
function dirBuyurtmaChiz() {
  const kut = buyurtmalar.filter(b => b.holat === "direktor");
  const kor = buyurtmalar.filter(b => b.holat !== "direktor");
  royxatgaQoy("dKutilmoqda", kut, true);
  el("dKutBosh").hidden = kut.length > 0;
  royxatgaQoy("dKorilgan", kor, false);
  el("dKorSoni").textContent = kor.length;
}
function nazBuyurtmaChiz() {
  const kut = buyurtmalar.filter(b => b.holat === "nazorat");
  const kor = buyurtmalar.filter(b => b.holat !== "nazorat");
  royxatgaQoy("nKutilmoqda", kut, true);
  el("nKutBosh").hidden = kut.length > 0;
  royxatgaQoy("nKorilgan", kor, false);
  el("nKorSoni").textContent = kor.length;
}

function qarorTinglovchi(konteynerId, kim, qaytaChiz) {
  el(konteynerId).addEventListener("click", async e => {
    const btn = e.target.closest("[data-amal]");
    if (!btn) return;
    const karta = btn.closest(".buyurtma");
    const izohEl = karta.querySelector("textarea");
    const izoh = izohEl.value.trim(), ha = btn.dataset.amal === "ha";
    if (!ha && !izoh) { karta.querySelector(".b-xato").textContent = "Rad etish sababini yozing."; izohEl.focus(); return; }
    try {
      const b = await tugmaBilan(btn, "Saqlanmoqda...", () =>
        api(`/buyurtmalar/${karta.dataset.id}/qaror`, { method: "POST", body: { ha, izoh } }));
      await buyurtmalarniYukla();
      qaytaChiz();
      toast(ha
        ? (kim === "direktor" ? `${buyurtmaRaqami(b)} tasdiqlandi va nazorat organiga yuborildi.` : `${buyurtmaRaqami(b)} yakuniy tasdiqlandi.`)
        : `${buyurtmaRaqami(b)} rad etildi. Kutubxonachi sababini ko'radi.`);
    } catch (e) { xatoniKorsat(e); }
  });
}
qarorTinglovchi("dKutilmoqda", "direktor", dirBuyurtmaChiz);
qarorTinglovchi("nKutilmoqda", "nazorat", nazBuyurtmaChiz);

function kutayotganBildirish(holat) {
  const n = buyurtmalar.filter(b => b.holat === holat).length;
  if (n) toast(`${n} ta kitob buyurtmasi tasdiqlashingizni kutmoqda.`);
}
