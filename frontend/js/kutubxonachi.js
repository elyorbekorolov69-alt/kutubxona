// ================= KUTUBXONACHI OYNASI =================
// Ma'lumot: /api/kutubxonachi/... manzillari

let kutQolda = [];        // hozir qo'lda turgan kitoblar (muddat bo'yicha)
let kutOquvchilar = [];   // maktab o'quvchilari (kitob berish va sinflar ro'yxati uchun)
let kutKitoblar = [];     // katalog

async function kutubxonachiniYukla() {
  const [xulosa, qolda, berildi, qaytdi, oquvchilar] = await Promise.all([
    api("/kutubxonachi/xulosa"),
    api("/kutubxonachi/yozuvlar?tur=qolda"),
    api("/kutubxonachi/yozuvlar?tur=berildi"),
    api("/kutubxonachi/yozuvlar?tur=qaytdi"),
    api("/kutubxonachi/oquvchilar")
  ]);
  kutQolda = qolda;
  kutOquvchilar = oquvchilar;

  const b = bugunMatn();
  el("kutSana").textContent = `Kutubxona paneli · bugun ${qisqaSana(b)}`;
  el("tBerildi").textContent = xulosa.berildi;
  el("tQaytdi").textContent = xulosa.qaytdi;
  el("tQolda").textContent = xulosa.qolda;
  el("tKech").textContent = xulosa.kech;
  el("tKechTile").classList.toggle("xavf", xulosa.kech > 0);

  // ---- Muddati keldi yoki o'tdi (bugun, ertaga, kechikkan) ----
  const yaqin = qolda.filter(y => kunFarq(y.muddat) <= 1);
  el("qarzdorlar").innerHTML = yaqin.map(y => {
    const [matn, cls] = muddatHolati(y.muddat);
    const tel = y.otaOnaTel;
    return `<li>
      <div class="q-mal"><b>${xavfsiz(y.oquvchi)} · ${xavfsiz(y.sinf)}</b><span>${xavfsiz(y.kitob)}${tel ? ` · ${yashirTel(tel)}` : ""}</span></div>
      <span class="chip ${cls}">${matn}</span>
      <div class="q-tugmalar">
        ${tel ? `<button type="button" class="q-btn tel-btn" aria-expanded="false">Qo'ng'iroq</button>` : ""}
        <button type="button" class="q-btn qaytdi-btn" data-id="${y.id}">Qaytarildi</button>
      </div>
      <div class="tel-qator" hidden>
        <span>Ota-onasi:</span><b>${xavfsiz(tel || "")}</b>
        <button type="button" class="q-btn nusxa-btn">Nusxa olish</button>
        ${kunFarq(y.muddat) <= -7 ? `<span class="eslatma">7 kundan oshdi: sinf rahbariga ham xabar bering.</span>` : ""}
      </div>
    </li>`;
  }).join("");
  el("qarzBosh").hidden = yaqin.length > 0;

  // ---- Bugungi harakatlar ----
  const harakat = [...qaytdi.map(y => [y, "Qaytardi", "chip-yaxshi"]), ...berildi.map(y => [y, "Oldi", "chip-qolda"])];
  el("harakatlar").innerHTML = harakat.map(([y, m, c]) =>
    `<li><div class="h-mal"><b>${xavfsiz(y.oquvchi)} · ${xavfsiz(y.sinf)}</b><span>${xavfsiz(y.kitob)}</span></div><span class="chip ${c}">${m}</span></li>`).join("");
  el("harakatBosh").hidden = harakat.length > 0;

  bildirishlarniChiz(yaqin);
  sinflarniToldir();
  await tarixniYukla();
  await darslikHolatiniYukla();   // darsliklar bo'limi (faqat kirgan kutubxonachi uchun)
}

// ---- Bildirishnomalar (qo'ng'iroqcha) ----
function bildirishlarniChiz(yaqin) {
  el("bildirishSon").hidden = yaqin.length === 0;
  el("bildirishSon").textContent = yaqin.length;
  el("bpIzoh").textContent = yaqin.length ? `${yaqin.length} ta` : "yangi xabar yo'q";
  el("bildirishRoyxat").innerHTML = yaqin.length
    ? yaqin.map(y => {
        const [matn, cls] = muddatHolati(y.muddat);
        return `<li><span class="chip ${cls}">${matn}</span><b>${xavfsiz(y.oquvchi)} (${xavfsiz(y.sinf)})</b><span>«${xavfsiz(y.kitob)}», muddat: ${qisqaSana(y.muddat)}</span></li>`;
      }).join("")
    : "<li><span>Hozircha muddati kelgan kitob yo'q.</span></li>";
}
const qBtn = el("qongiroqBtn"), qPanel = el("bildirishPanel");
qBtn.addEventListener("click", e => {
  e.stopPropagation();
  qPanel.hidden = !qPanel.hidden;
  qBtn.setAttribute("aria-expanded", String(!qPanel.hidden));
});
document.addEventListener("click", e => { if (!qPanel.hidden && !qPanel.contains(e.target)) { qPanel.hidden = true; qBtn.setAttribute("aria-expanded", "false"); } });

// Kutubxonachi kirganda: qo'ng'iroqcha silkinadi va xabar chiqadi
function bildirishniKorsat() {
  const son = kutQolda.filter(y => kunFarq(y.muddat) <= 1).length;
  if (!son) return;
  qBtn.classList.remove("silkin"); void qBtn.offsetWidth; qBtn.classList.add("silkin");
  toast(`Diqqat: ${son} ta kitobning qaytarish muddati keldi yoki o'tdi. Qo'ng'iroqchani bosing.`);
}

// ---- Kitobni qaytarib olish (ro'yxat oynasi ham ishlatadi) ----
async function kitobniQaytar(id, tugma) {
  const y = await tugmaBilan(tugma, "...", () => api(`/kutubxonachi/qaytarish/${id}`, { method: "POST" }));
  toast("Kitob qaytarib olindi va tarixga yozildi.");
  return y;
}

el("qarzdorlar").addEventListener("click", async e => {
  const telBtn = e.target.closest(".tel-btn");
  if (telBtn) {
    const qator = telBtn.closest("li").querySelector(".tel-qator");
    qator.hidden = !qator.hidden;
    telBtn.setAttribute("aria-expanded", String(!qator.hidden));
    return;
  }
  const nBtn = e.target.closest(".nusxa-btn");
  if (nBtn) { const b = nBtn.parentElement.querySelector("b"); nusxaOl(b.textContent, b); return; }
  const btn = e.target.closest(".qaytdi-btn");
  if (!btn) return;
  try { await kitobniQaytar(btn.dataset.id, btn); await kutubxonachiniYukla(); }
  catch (er) { xatoniKorsat(er); }
});

// ---- Kitob olish tarixi (filtrlar bilan) ----
let tarixYozuvlari = [], korsatSoni = 25;

function sinflarniToldir() {
  const sinflar = [...new Set(kutOquvchilar.map(o => o.sinf).filter(Boolean))]
    .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
  const tanlangan = el("tSinf").value;
  el("tSinf").innerHTML = `<option value="hammasi">Barcha sinflar</option>` + sinflar.map(s => `<option value="${xavfsiz(s)}">${xavfsiz(s)} sinf</option>`).join("");
  if (sinflar.includes(tanlangan)) el("tSinf").value = tanlangan;
  el("ySinfRoyxat").innerHTML = sinflar.map(s => `<option value="${xavfsiz(s)}"></option>`).join("");
}

// Davr nomidan [dan, gacha] sanalarini hisoblash
function davrOraligi(d) {
  const iso = x => x.toISOString().slice(0, 10);
  const b = new Date(bugunMatn() + "T00:00:00Z"), y = b.getUTCFullYear(), m = b.getUTCMonth();
  const qosh = (x, n) => new Date(x.getTime() + n * 864e5);
  const dushanba = qosh(b, -((b.getUTCDay() + 6) % 7));
  switch (d) {
    case "bugun": return [iso(b), iso(b)];
    case "shuHafta": return [iso(dushanba), iso(b)];
    case "otganHafta": return [iso(qosh(dushanba, -7)), iso(qosh(dushanba, -1))];
    case "shuOy": return [iso(new Date(Date.UTC(y, m, 1))), iso(b)];
    case "otganOy": return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
    case "shuYil": return [iso(new Date(Date.UTC(y, 0, 1))), iso(b)];
    default: return null;
  }
}

async function tarixniYukla() {
  const oraliq = davrOraligi(el("tDavr").value);
  const sorov = oraliq ? `&dan=${oraliq[0]}&gacha=${oraliq[1]}` : "";
  tarixYozuvlari = await api("/kutubxonachi/yozuvlar?tur=tarix" + sorov);
  korsatSoni = 25;
  tarixniChiz();
}

function tarixniChiz() {
  const q = el("tQidiruv").value.trim().toLowerCase(), sinf = el("tSinf").value, hol = el("tHolat").value;
  const royxat = tarixYozuvlari.filter(y => {
    if (q && !(y.oquvchi + " " + y.kitob).toLowerCase().includes(q)) return false;
    if (sinf !== "hammasi" && y.sinf !== sinf) return false;
    if (hol === "qolda" && y.qaytarilgan) return false;
    if (hol === "qaytgan" && !y.qaytarilgan) return false;
    if (hol === "kech") {
      const kech = y.qaytarilgan ? kunMatn(y.qaytarilgan) > kunMatn(y.muddat) : kunFarq(y.muddat) < 0;
      if (!kech) return false;
    }
    return true;
  });
  el("tSoni").textContent = `${royxat.length} ta yozuv` + (tarixYozuvlari.length >= 500 ? " (eng yangi 500 tasi ichidan; davrni toraytiring)" : "");
  el("tJadval").innerHTML = royxat.slice(0, korsatSoni).map(y => {
    const [m, c] = qaytishHolati(y);
    return `<tr><td class="nom">${xavfsiz(y.oquvchi)}</td><td>${xavfsiz(y.sinf)}</td><td class="mua">${xavfsiz(y.kitob)}</td>
      <td>${raqamSana(y.olingan)}</td><td>${raqamSana(y.muddat)}</td><td>${raqamSana(y.qaytarilgan)}</td>
      <td><span class="chip ${c}">${m}</span></td></tr>`;
  }).join("");
  el("tBosh").hidden = royxat.length > 0;
  el("tYana").hidden = royxat.length <= korsatSoni;
}
el("tDavr").addEventListener("change", () => tarixniYukla().catch(xatoniKorsat));
["tSinf", "tHolat"].forEach(id => el(id).addEventListener("change", () => { korsatSoni = 25; tarixniChiz(); }));
el("tQidiruv").addEventListener("input", () => { korsatSoni = 25; tarixniChiz(); });
el("tYana").addEventListener("click", () => { korsatSoni += 25; tarixniChiz(); });

// ================= KITOB BERISH =================
const oquvchiYorligi = o => `${o.ism} · ${o.sinf}`;
const kitobYorligi = k => `${k.nomi} — ${k.muallif}`;

el("berishBtn").addEventListener("click", async () => {
  try {
    const [oquvchilar, kitoblar] = await Promise.all([api("/kutubxonachi/oquvchilar"), api("/kutubxonachi/kitoblar")]);
    kutOquvchilar = oquvchilar;
    kutKitoblar = kitoblar.filter(k => k.tur !== "darslik");   // darslik bu yerda berilmaydi (Darsliklar bo'limida)
    el("brOquvchiRoyxat").innerHTML = oquvchilar.map(o => `<option value="${xavfsiz(oquvchiYorligi(o))}"></option>`).join("");
    el("brKitobRoyxat").innerHTML = kutKitoblar.map(k =>
      `<option value="${xavfsiz(kitobYorligi(k))}">Bo'sh: ${k.nusxaSoni - k.qolda} / ${k.nusxaSoni}</option>`).join("");
    el("berishForma").reset();
    el("brKun").value = "14";
    el("brIzoh").textContent = "";
    xato("brOquvchiM", "brOquvchiX", ""); xato("brKitobM", "brKitobX", "");
    modalOch("modalBerish");
  } catch (e) { xatoniKorsat(e); }
});

const tanlanganKitob = () => kutKitoblar.find(k => kitobYorligi(k) === el("brKitob").value.trim());
el("brKitob").addEventListener("input", () => {
  const k = tanlanganKitob();
  el("brIzoh").textContent = k ? `Bo'sh nusxalar: ${k.nusxaSoni - k.qolda} / ${k.nusxaSoni}` : "";
});

el("berishForma").addEventListener("submit", async e => {
  e.preventDefault();
  const o = kutOquvchilar.find(x => oquvchiYorligi(x) === el("brOquvchi").value.trim());
  const k = tanlanganKitob();
  xato("brOquvchiM", "brOquvchiX", o ? "" : "Ro'yxatdan o'quvchini tanlang.");
  xato("brKitobM", "brKitobX", !k ? "Ro'yxatdan kitobni tanlang." : k.nusxaSoni - k.qolda <= 0 ? "Bu kitobning bo'sh nusxasi yo'q." : "");
  if (!o || !k || k.nusxaSoni - k.qolda <= 0) return;
  try {
    await tugmaBilan(el("berishYubor"), "Berilmoqda...", () =>
      api("/kutubxonachi/berish", { method: "POST", body: { oquvchiId: o.id, kitobId: k.id, kun: Number(el("brKun").value) } }));
    modalYop("modalBerish");
    toast(`«${k.nomi}» ${o.ism}ga ${el("brKun").value} kunga berildi.`);
    await kutubxonachiniYukla();
  } catch (er) { xatoniKorsat(er); }
});

// ================= YANGI KITOB =================
// Sinf tanlash ro'yxati (1-11): kitob qo'shish va darsliklar bo'limi ishlatadi
const SINFLAR = Array.from({ length: 11 }, (_, i) => i + 1);
el("ktSinf").innerHTML = `<option value="">Sinfni tanlang</option>` + SINFLAR.map(s => `<option value="${s}">${s}-sinf</option>`).join("");
el("ktDarslik").addEventListener("change", e => { el("ktSinfM").hidden = !e.target.checked; });

el("yangiKitobBtn").addEventListener("click", () => {
  el("kitobForma").reset();
  el("ktSinfM").hidden = true;
  ["ktNomi", "ktMuallif", "ktSoni", "ktSinf"].forEach(id => xato(id + "M", id + "X", ""));
  modalOch("modalKitob");
});
el("kitobForma").addEventListener("submit", async e => {
  e.preventDefault();
  const nomi = el("ktNomi").value.trim(), muallif = el("ktMuallif").value.trim(), nusxaSoni = Number(el("ktSoni").value);
  const darslik = el("ktDarslik").checked, sinfRaqam = Number(el("ktSinf").value);
  const ok1 = nomi.length > 1, ok2 = muallif.length > 1, ok3 = Number.isInteger(nusxaSoni) && nusxaSoni >= 1 && nusxaSoni <= 1000;
  const ok4 = !darslik || (sinfRaqam >= 1 && sinfRaqam <= 11);
  xato("ktNomiM", "ktNomiX", ok1 ? "" : "Kitob nomini yozing.");
  xato("ktMuallifM", "ktMuallifX", ok2 ? "" : "Muallifni yozing.");
  xato("ktSoniM", "ktSoniX", ok3 ? "" : "1 dan 1000 gacha son kiriting.");
  xato("ktSinfM", "ktSinfX", ok4 ? "" : "Darslik uchun sinfni tanlang.");
  if (!ok1 || !ok2 || !ok3 || !ok4) return;
  try {
    const k = await tugmaBilan(el("kitobYubor"), "Saqlanmoqda...", () =>
      api("/kutubxonachi/kitoblar", { method: "POST", body: { nomi, muallif, nusxaSoni, tur: darslik ? "darslik" : "kitob", sinfRaqam: darslik ? sinfRaqam : null } }));
    modalYop("modalKitob");
    toast(k.qoshildi ? `«${k.nomi}» katalogga qo'shildi.` : `«${k.nomi}» katalogda bor edi: endi ${k.nusxaSoni} ta nusxa.`);
  } catch (er) { xatoniKorsat(er); }
});

// ================= YANGI O'QUVCHI AKKAUNTI =================
["yOtaTel", "yTel"].forEach(id => el(id).addEventListener("input", e => { e.target.value = telFormat(e.target.value).matn; }));

function oquvchiModaliniOch() {
  el("yangiForma").reset();
  el("yangiForma").hidden = false;
  el("yNatija").hidden = true;
  ["yIsmM", "ySinfM", "yOtaTelM", "yTelM"].forEach(id => el(id).classList.remove("xato"));
  ["yIsmX", "ySinfX", "yOtaTelX", "yTelX", "yRoziX"].forEach(id => (el(id).textContent = ""));
  modalOch("modal");
}
el("yangiOquvchiBtn").addEventListener("click", oquvchiModaliniOch);
el("yYana").addEventListener("click", oquvchiModaliniOch);
el("modalYop").addEventListener("click", () => modalYop("modal"));
el("yTayyor").addEventListener("click", () => { modalYop("modal"); kutubxonachiniYukla().catch(xatoniKorsat); });

el("yangiForma").addEventListener("submit", async e => {
  e.preventDefault();
  const ism = el("yIsm").value.trim().replace(/\s+/g, " "), sinf = el("ySinf").value.trim().toUpperCase();
  const ota = telFormat(el("yOtaTel").value), ozi = telFormat(el("yTel").value);
  let togri = true;
  const tekshir = (shart, maydon, xatoId, matn) => { xato(maydon, xatoId, shart ? "" : matn); if (!shart) togri = false; };
  tekshir(ism.split(" ").length >= 2, "yIsmM", "yIsmX", "Ism va familiyani to'liq yozing.");
  tekshir(/^\d{1,2}-[A-ZА-Я]$/.test(sinf), "ySinfM", "ySinfX", "Sinfni 7-B ko'rinishida yozing.");
  tekshir(ota.toliq, "yOtaTelM", "yOtaTelX", "To'liq raqam kiriting: +998 va 9 ta raqam.");
  tekshir(!el("yTel").value || ozi.toliq, "yTelM", "yTelX", "Raqam to'liq emas. Bo'sh qoldirsangiz ham bo'ladi.");
  tekshir(el("yRozi").checked, null, "yRoziX", "Rozilik olinmasa, akkaunt ochib bo'lmaydi.");
  if (!togri) return;

  try {
    const javob = await tugmaBilan(el("yangiForma").querySelector("button[type=submit]"), "Ochilmoqda...", () =>
      api("/kutubxonachi/oquvchilar", { method: "POST", body: { ism, sinf, otaOnaTel: ota.matn, ozTel: ozi.matn || null, rozilik: true } }));
    el("yLogin").textContent = javob.login;
    el("yParol").textContent = javob.parol;
    el("yangiForma").hidden = true;
    el("yNatija").hidden = false;
    el("yTayyor").focus();
  } catch (er) { xatoniKorsat(er); }
});
el("yNusxa").addEventListener("click", () => {
  nusxaOl(`Login: ${el("yLogin").textContent}\nParol: ${el("yParol").textContent}`, el("yNatija").querySelector(".kirish-malumot"));
});

// ---- Boshqa oynalarga o'tish ----
el("buyurtmaBtn").addEventListener("click", buyurtmaOynasiniOch);
el("bOrqaga").addEventListener("click", async () => {
  try { await kutubxonachiniYukla(); await otish("ekranKutubxonachi"); } catch (e) { xatoniKorsat(e); }
});

// ================= DARSLIKLAR (sinf bo'yicha: tarqatish, yig'ish, sinf o'tkazish) =================
// O'quv yili tugash yili: sentabrdan keyin keyingi yil (2026-10 -> 2027)
const oquvYiliTugashi = () => { const b = bugunMatn(); return Number(b.slice(5, 7)) >= 8 ? Number(b.slice(0, 4)) + 1 : Number(b.slice(0, 4)); };
const dSinf = el("dSinf"), dYil = el("dYil");
dSinf.innerHTML = SINFLAR.map(s => `<option value="${s}">${s}-sinf</option>`).join("");
dYil.value = oquvYiliTugashi();

async function darslikHolatiniYukla() {
  const sinf = Number(dSinf.value);
  const h = await api(`/kutubxonachi/darslik/holat?sinfRaqam=${sinf}`);
  el("dHolat").textContent = `${sinf}-sinf: ${h.darsliklar} ta darslik · ${h.oquvchilar} ta faol o'quvchi · qaytarilmagan: ${h.ochiq.length} ta`;
  el("dOchiq").innerHTML = h.ochiq.map(y => `<li>
      <div class="h-mal"><b>${xavfsiz(y.oquvchi)}</b><span>${xavfsiz(y.kitob)} · muddat: ${raqamSana(y.muddat)}</span></div>
      <div class="q-tugmalar">
        <button type="button" class="q-btn" data-darslik-qaytdi="${y.id}">Qaytardi</button>
        <button type="button" class="q-btn" data-darslik-yoqolgan="${y.id}">Yo'qolgan</button>
      </div></li>`).join("");
  el("dBosh").hidden = h.ochiq.length > 0;
}
dSinf.addEventListener("change", () => darslikHolatiniYukla().catch(xatoniKorsat));
dYil.addEventListener("change", () => darslikHolatiniYukla().catch(xatoniKorsat));

// Ro'yxatdagi bitta darslik: qaytardi yoki yo'qolgan
el("dOchiq").addEventListener("click", async e => {
  const qaytdi = e.target.closest("[data-darslik-qaytdi]"), yoqolgan = e.target.closest("[data-darslik-yoqolgan]");
  try {
    if (qaytdi) { await kitobniQaytar(qaytdi.dataset.darslikQaytdi, qaytdi); toast("Darslik qaytarib olindi."); }
    else if (yoqolgan) {
      if (!confirm("Bu darslik yo'qolgan yoki yaroqsiz bo'lgan deb qayd etilsinmi?")) return;
      await tugmaBilan(yoqolgan, "...", () => api(`/kutubxonachi/darslik/yoqolgan/${yoqolgan.dataset.darslikYoqolgan}`, { method: "POST" }));
      toast("Darslik yo'qolgan deb qayd etildi.");
    } else return;
    await darslikHolatiniYukla();
  } catch (er) { xatoniKorsat(er); }
});

el("dTarqatish").addEventListener("click", async () => {
  const sinf = Number(dSinf.value), yil = Number(dYil.value);
  if (!confirm(`${sinf}-sinf o'quvchilariga darsliklar tarqatilsinmi? Muddat: ${yil}-yil 31-may.`)) return;
  try {
    const r = await tugmaBilan(el("dTarqatish"), "Tarqatilmoqda...", () =>
      api("/kutubxonachi/darslik/tarqatish", { method: "POST", body: { sinfRaqam: sinf, yil } }));
    toast(`${r.yaratildi} ta darslik berildi (muddat ${raqamSana(r.muddat)}).`);
    await darslikHolatiniYukla();
  } catch (er) { xatoniKorsat(er); }
});

el("dYigish").addEventListener("click", async () => {
  const sinf = Number(dSinf.value);
  if (!confirm(`${sinf}-sinfning hamma darsliklari qaytarildi deb belgilansinmi? Ro'yxatdagilar ham shunday belgilanadi.`)) return;
  try {
    const r = await tugmaBilan(el("dYigish"), "Yig'ilmoqda...", () =>
      api("/kutubxonachi/darslik/yigish", { method: "POST", body: { sinfRaqam: sinf } }));
    toast(`${r.qaytarildi} ta darslik qaytarildi deb belgilandi.`);
    await darslikHolatiniYukla();
  } catch (er) { xatoniKorsat(er); }
});

el("dOtkazish").addEventListener("click", async () => {
  const yil = Number(dYil.value);
  if (!confirm(`Barcha faol o'quvchilar keyingi sinfga o'tkazilsinmi (${yil}-yil)? Bu amalni qaytarib bo'lmaydi. 11-sinfni tugatganlar arxivga o'tadi.`)) return;
  try {
    let r;
    try {
      r = await tugmaBilan(el("dOtkazish"), "O'tkazilmoqda...", () => api("/kutubxonachi/sinf-otkazish", { method: "POST", body: { yil } }));
    } catch (er) {
      // Qaytarilmagan darsliklar bo'lsa, server tasdiq so'raydi
      if (er.holat !== 409 || !er.message.includes("qaytarilmagan")) throw er;
      if (!confirm(er.message)) return;
      r = await tugmaBilan(el("dOtkazish"), "O'tkazilmoqda...", () => api("/kutubxonachi/sinf-otkazish", { method: "POST", body: { yil, tasdiq: true } }));
    }
    toast(`${r.otkazildi} o'quvchi keyingi sinfga o'tdi. ${r.bitirgan} ta bitiruvchi arxivga o'tkazildi.`);
    await kutubxonachiniYukla();
    await darslikHolatiniYukla();
  } catch (er) { xatoniKorsat(er); }
});
