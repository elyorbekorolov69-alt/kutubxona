// ================= RO'YXAT OYNASI (ko'rsatkich bosilganda) =================
// Ikki rejimda ishlaydi: kutubxonachi (telefon va "Qaytarildi" bilan) va direktor (faqat ko'rish).

const ROYXAT_TUR = {
  berildi: ["Bugun berilgan kitoblar", "Bugun o'quvchilarga berilgan barcha kitoblar."],
  qaytdi:  ["Bugun qaytarilgan kitoblar", "Bugun kutubxonaga qaytarib olingan kitoblar."],
  shuoy:   ["Shu oy o'qilgan kitoblar", "Shu oy o'qib, kutubxonaga qaytarilgan kitoblar."],
  qolda:   ["Hozir o'quvchilar qo'lidagi kitoblar", "Hali qaytarilmagan barcha kitoblar. Muddati yaqinlari tepada."],
  kech:    ["Muddati o'tgan kitoblar", "Eng ko'p kechikkanlari tepada."],
  faol:    ["Faol o'quvchilar", "So'nggi 30 kunda kutubxonadan kitob olgan o'quvchilar."]
};
const TAB_NOMI = { berildi: "Bugun berildi", qaytdi: "Bugun qaytarildi", shuoy: "Shu oy o'qilgan", qolda: "Hozir qo'lda", kech: "Muddati o'tgan", faol: "Faol o'quvchilar" };
const REJIM = {
  kutubxonachi: { ekran: "ekranKutubxonachi", tablar: ["berildi", "qaytdi", "qolda", "kech"], qayt: "← Bosh panelga qaytish",
                  yukla: tur => api(`/kutubxonachi/yozuvlar?tur=${tur}`), panel: () => kutubxonachiniYukla() },
  direktor:     { ekran: "ekranDirektor", tablar: ["shuoy", "qolda", "kech", "faol"], qayt: "← Direktor paneliga qaytish",
                  yukla: tur => api(tur === "faol" ? "/direktor/faollar" : `/direktor/yozuvlar?tur=${tur}`), panel: () => direktorniYukla() }
};
let joriyRoyxat = "qolda", royxatRejim = "kutubxonachi", rMalumot = [];

async function royxatniYukla() {
  rMalumot = await REJIM[royxatRejim].yukla(joriyRoyxat);
  royxatChiz();
}

function royxatChiz() {
  const tur = joriyRoyxat, rej = REJIM[royxatRejim];
  el("rOrqaga").textContent = rej.qayt;
  el("rSarlavha").textContent = ROYXAT_TUR[tur][0];
  el("rIzoh").textContent = ROYXAT_TUR[tur][1] + (royxatRejim === "kutubxonachi" && tur === "kech" ? " 7 kundan oshganlar haqida sinf rahbariga ham xabar bering." : "");
  el("rTablar").innerHTML = rej.tablar.map(t =>
    `<button type="button" class="r-tab" role="tab" data-royxat="${t}" aria-selected="${t === tur}">${TAB_NOMI[t]}</button>`).join("");
  const q = el("rQidiruv").value.trim().toLowerCase();

  // Faol o'quvchilar jadvali boshqacha: o'quvchi bo'yicha, » bosilsa kitoblari ochiladi
  if (tur === "faol") {
    el("rSarlavhaQator").innerHTML = `<th>O'quvchi</th><th>Sinf</th><th>30 kunda olgan kitoblari</th><th>Oxirgi marta kelgan</th>`;
    const royxat = rMalumot.filter(x => !q || x.ism.toLowerCase().includes(q));
    el("rSoni").textContent = `${rMalumot.length} ta faol o'quvchi`;
    el("rJadval").innerHTML = royxat.map(x =>
      `<tr><td class="nom">${xavfsiz(x.ism)}</td><td>${xavfsiz(x.sinf)}</td><td>${ochkichHtml(x.soni).replace("<button", `<button data-i="${rMalumot.indexOf(x)}"`)}</td><td>${qisqaSana(x.oxirgi)}</td></tr>`).join("");
    el("rBosh").hidden = royxat.length > 0;
    el("rBosh").textContent = q ? "Bu ism bo'yicha hech kim topilmadi." : "So'nggi 30 kunda hech kim kitob olmagan.";
    return;
  }

  const qaytmagan = tur === "qolda" || tur === "kech";
  const amallar = qaytmagan && royxatRejim === "kutubxonachi";     // telefon va "Qaytarildi" faqat kutubxonachida
  el("rSarlavhaQator").innerHTML = `<th>O'quvchi</th><th>Sinf</th><th>Kitob</th><th>Olingan</th><th>Muddat</th>` +
    (qaytmagan ? `<th>Holat</th>` + (amallar ? `<th>Ota-ona tel.</th><th></th>` : "") : `<th>Qaytarilgan</th><th>Holat</th>`);

  const royxat = rMalumot.filter(y => !q || (y.oquvchi + " " + y.kitob).toLowerCase().includes(q));
  el("rSoni").textContent = q ? `${royxat.length} ta (jami ${rMalumot.length} ta)` : `Jami ${rMalumot.length} ta`;
  el("rJadval").innerHTML = royxat.map(y => {
    let qolgan;
    if (qaytmagan) {
      const [m, c] = muddatHolati(y.muddat);
      qolgan = `<td><span class="chip ${c}">${m}</span></td>`;
      if (amallar) {
        qolgan += `<td class="tel-ust">${y.otaOnaTel
          ? `<span class="tel-mat" data-toliq="${xavfsiz(y.otaOnaTel)}">${yashirTel(y.otaOnaTel)}</span> <button type="button" class="tel-kichik">Ko'rsat</button>` : "—"}</td>
          <td><button type="button" class="q-btn qaytdi-btn" data-id="${y.id}">Qaytarildi</button></td>`;
      }
    } else {
      const [m, c] = qaytishHolati(y);
      qolgan = `<td>${raqamSana(y.qaytarilgan)}</td><td><span class="chip ${c}">${m}</span></td>`;
    }
    return `<tr><td class="nom">${xavfsiz(y.oquvchi)}</td><td>${xavfsiz(y.sinf)}</td><td class="mua">${xavfsiz(y.kitob)}</td>
      <td>${raqamSana(y.olingan)}</td><td>${raqamSana(y.muddat)}</td>${qolgan}</tr>`;
  }).join("");
  el("rBosh").hidden = royxat.length > 0;
  el("rBosh").textContent = q ? "Bu so'z bo'yicha hech narsa topilmadi." :
    { berildi: "Bugun hali kitob berilmadi.", qaytdi: "Bugun hali kitob qaytarilmadi.", shuoy: "Shu oy hali kitob qaytarilmadi.",
      qolda: "Hozir hech kimning qo'lida kitob yo'q.", kech: "Muddati o'tgan kitob yo'q. Ajoyib!" }[tur];
}

async function royxatOch(tur, rejim) {
  joriyRoyxat = tur;
  royxatRejim = rejim;
  el("rQidiruv").value = "";
  try { await royxatniYukla(); await otish("ekranRoyxat"); }
  catch (e) { xatoniKorsat(e); }
}
document.querySelectorAll(".tile-btn[data-royxat]").forEach(t =>
  t.addEventListener("click", () => royxatOch(t.dataset.royxat, t.dataset.rejim || "kutubxonachi")));

el("rTablar").addEventListener("click", e => {
  const t = e.target.closest(".r-tab");
  if (!t) return;
  joriyRoyxat = t.dataset.royxat;
  el("rQidiruv").value = "";
  royxatniYukla().catch(xatoniKorsat);
});
el("rQidiruv").addEventListener("input", royxatChiz);

el("rJadval").addEventListener("click", async e => {
  const och = e.target.closest(".ochkich");
  if (och) {                                       // faol o'quvchi: 30 kunda olgan kitoblari
    const x = rMalumot[Number(och.dataset.i)];
    jadvalTafsil(och, 4, kitobChiplar(x?.kitoblar || [], k =>
      `${xavfsiz(k.nomi)} <small>${qisqaSana(k.olingan)}${k.qaytarilgan ? "" : " · qo'lda"}</small>`));
    return;
  }
  const telBtn = e.target.closest(".tel-kichik");
  if (telBtn) {                                    // to'liq raqamni ko'rsatish / yashirish
    const s = telBtn.parentElement.querySelector(".tel-mat");
    const ochiq = telBtn.textContent === "Yashir";
    s.textContent = ochiq ? yashirTel(s.dataset.toliq) : s.dataset.toliq;
    telBtn.textContent = ochiq ? "Ko'rsat" : "Yashir";
    return;
  }
  const btn = e.target.closest(".qaytdi-btn");
  if (!btn) return;
  try { await kitobniQaytar(btn.dataset.id, btn); await royxatniYukla(); }
  catch (er) { xatoniKorsat(er); }
});

el("rOrqaga").addEventListener("click", async () => {
  const rej = REJIM[royxatRejim];
  try { await rej.panel(); await otish(rej.ekran); } catch (e) { xatoniKorsat(e); }
});
