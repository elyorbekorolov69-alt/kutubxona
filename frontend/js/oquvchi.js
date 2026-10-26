// ================= O'QUVCHI OYNASI =================
// Ma'lumot: GET /api/oquvchi/kabinet

let oqTarix = [];   // qidiruv uchun

async function oquvchiOynasiniYukla() {
  const k = await api("/oquvchi/kabinet");
  oquvchiniChiz(k);
}

function oquvchiniChiz(k) {
  el("oqSalom").textContent = `Salom, ${k.ism.split(" ")[0]}!`;
  el("oqMalumot").textContent = `${k.sinf} sinf · ${k.maktab} · Login: ${k.login}`;
  el("oqReytingSarlavha").textContent = `${k.sinf} sinf reytingi`;

  // ---- Qo'limdagi kitob (muddati eng yaqini) ----
  const qolda = [...k.qolda].sort((a, b) => kunMatn(a.muddat).localeCompare(kunMatn(b.muddat)));
  const j = qolda[0];
  el("joriyBlok").hidden = !j;
  el("joriyBosh").hidden = !!j;
  const ogoh = el("oqOgoh");
  ogoh.hidden = true;
  if (j) {
    el("joriyNom").textContent = j.kitob + (qolda.length > 1 ? ` (+${qolda.length - 1} ta yana)` : "");
    el("joriyMuallif").textContent = j.muallif;
    el("joriyOlingan").textContent = qisqaSana(j.olingan);
    el("joriyMuddat").textContent = qisqaSana(j.muddat);
    const qoldi = kunFarq(j.muddat);
    const [m, c] = qoldi > 3 ? [`${qoldi} kun qoldi`, "chip-yaxshi"] : muddatHolati(j.muddat);
    el("muddatChip").className = "chip " + c;
    el("muddatChip").textContent = qoldi > 0 && qoldi <= 3 ? `Muddat yaqin: ${qoldi} kun` : m;
    const jami = kunSon(j.muddat) - kunSon(j.olingan);
    const otdi = jami > 0 ? (kunSon(bugunMatn()) - kunSon(j.olingan)) / jami : 1;
    el("vaqtChiziq").style.width = Math.min(Math.max(otdi, 0), 1) * 100 + "%";
    el("vaqtChiziq").style.background = qoldi < 0 ? "var(--error)" : "";

    if (qoldi < 0) {
      ogoh.className = "ogoh xavf"; ogoh.hidden = false;
      ogoh.textContent = `«${j.kitob}» kitobini qaytarish muddati ${-qoldi} kun oldin tugagan. Iltimos, kitobni tezroq kutubxonaga qaytaring, uni boshqa o'quvchilar ham kutmoqda.`;
    } else if (qoldi <= 1) {
      ogoh.className = "ogoh diqqat"; ogoh.hidden = false;
      ogoh.textContent = `«${j.kitob}» kitobini ${qoldi === 0 ? "bugun" : "ertaga"} qaytarishingiz kerak.`;
    }
  }

  // ---- Tarix ----
  oqTarix = k.tarix;
  el("tarixQidiruv").value = "";
  oqJadvalChiz();

  // ---- Yillik maqsad (shu yil qaytarilgan kitoblar) ----
  const yil = bugunMatn().slice(0, 4);
  const shuYil = k.tarix.filter(y => kunMatn(y.qaytarilgan).startsWith(yil));
  const oqildi = shuYil.length, qolgan = Math.max(k.maqsad - oqildi, 0);
  el("maqsadSon").textContent = oqildi;
  el("maqsadJami").textContent = ` / ${k.maqsad} kitob`;
  el("maqsadChiziq").style.width = Math.min(oqildi / k.maqsad, 1) * 100 + "%";
  const oylarQoldi = 13 - Number(bugunMatn().slice(5, 7));
  el("maqsadIzoh").textContent = qolgan === 0
    ? "Tabriklaymiz! Yillik maqsadingizga yetdingiz."
    : `Maqsadgacha ${qolgan} ta kitob qoldi. Har oyda ${Math.ceil(qolgan / oylarQoldi)} tadan o'qisangiz, yil oxirigacha yetasiz.`;

  // ---- Ko'rsatkichlar ----
  const jamiOqilgan = k.tarix.length;
  const vaqtida = k.tarix.filter(y => kunMatn(y.qaytarilgan) <= kunMatn(y.muddat)).length;
  const orin = k.reyting.findIndex(o => o.men) + 1;
  el("kOqilgan").textContent = jamiOqilgan;
  el("kVaqtida").textContent = jamiOqilgan ? `${vaqtida}/${jamiOqilgan}` : "—";
  el("kOrin").textContent = orin ? `${orin}-o'rin` : "—";

  // ---- Yutuqlar ----
  const yutuq = [];
  if (jamiOqilgan >= 20) yutuq.push("Oltin kitobxon");
  else if (jamiOqilgan >= 10) yutuq.push("Kumush kitobxon");
  else if (jamiOqilgan >= 5) yutuq.push("Bronza kitobxon");
  else if (jamiOqilgan >= 1) yutuq.push("Birinchi kitoblar");
  if (orin === 1 && jamiOqilgan > 0) yutuq.push("Sinf yetakchisi");
  if (jamiOqilgan >= 3 && vaqtida === jamiOqilgan) yutuq.push("Vaqtga sodiq");
  el("yutuqlar").innerHTML = yutuq.length
    ? yutuq.map(y => `<span class="yutuq">★ ${y}</span>`).join("")
    : `<span class="yutuq-bosh">Birinchi kitobingizni o'qing va yutuq oling!</span>`;

  // ---- Sinf reytingi: top 5, o'quvchi undan pastda bo'lsa alohida qatorda ----
  const eng = Math.max(1, ...k.reyting.map(o => o.soni));
  const ol = el("reyting");
  ol.innerHTML = "";
  const qator = (o, i) => {
    const li = document.createElement("li");
    if (o.men) li.className = "men";
    li.innerHTML = `<span class="o">${i + 1}</span><span class="ism">${xavfsiz(o.men ? qisqaIsm(o.ism) + " (siz)" : o.ism)}</span><span class="s">${o.soni}</span><span class="bar"><i style="width:${o.soni / eng * 100}%"></i></span>`;
    ol.appendChild(li);
  };
  k.reyting.slice(0, 5).forEach(qator);
  if (orin > 5) {
    const u = document.createElement("li"); u.className = "uzilish"; u.textContent = "···"; ol.appendChild(u);
    qator(k.reyting[orin - 1], orin - 1);
  }
}

function oqJadvalChiz() {
  const q = el("tarixQidiruv").value.trim().toLowerCase();
  const royxat = oqTarix.filter(y => (y.kitob + " " + y.muallif).toLowerCase().includes(q));
  el("tarixJadval").innerHTML = royxat.map(y => {
    const [m, c] = qaytishHolati(y);
    return `<tr><td class="nom">${xavfsiz(y.kitob)}</td><td class="mua">${xavfsiz(y.muallif)}</td>
      <td>${raqamSana(y.olingan)}</td><td>${raqamSana(y.qaytarilgan)}</td><td><span class="chip ${c}">${m}</span></td></tr>`;
  }).join("");
  el("tarixBosh").textContent = oqTarix.length ? "Bu so'z bo'yicha kitob topilmadi." : "Hali birorta kitob o'qilmagan. Birinchi kitobingiz shu yerda paydo bo'ladi!";
  el("tarixBosh").hidden = royxat.length > 0;
}
el("tarixQidiruv").addEventListener("input", oqJadvalChiz);
