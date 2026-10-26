// ================= DIREKTOR OYNASI =================
// Ma'lumot: /api/direktor/xulosa, /api/direktor/statistika, /api/buyurtmalar
// Bu oynada telefon raqamlari umuman kelmaydi.

let dStat = null;

async function direktorniYukla() {
  const [xulosa, stat] = await Promise.all([api("/direktor/xulosa"), api("/direktor/statistika"), buyurtmalarniYukla()]);
  dStat = stat;
  el("dirSana").textContent = `Direktor paneli · bugun ${qisqaSana(bugunMatn())}`;
  el("dBuOy").textContent = xulosa.shuOy;
  el("dQolda").textContent = xulosa.qolda;
  el("dKech").textContent = xulosa.kech;
  el("dKechTile").classList.toggle("xavf", xulosa.kech > 0);
  el("dFaol").textContent = `${xulosa.faol}/${xulosa.oquvchilar}`;

  dirBuyurtmaChiz();
  oylikChiz(stat.oylik);
  reytingChiz("dFaollar", stat.faollar, x => `${x.ism} · ${x.sinf}`);
  reytingChiz("dKitoblar", stat.kitoblar, x => `${x.nomi} — ${x.muallif}`);
  sovgaChiz();
}

// So'nggi 12 oy ustunli diagrammasi
function oylikChiz(oylik) {
  const eng = Math.max(1, ...oylik.map(o => o.soni));
  el("dOylik").innerHTML = oylik.map((o, i) =>
    `<div class="oy-ustun${i === oylik.length - 1 ? " joriy-oy" : ""}" title="${oylar[Number(o.oy.slice(5)) - 1]}: ${o.soni} ta"><b>${o.soni}</b><i style="height:${o.soni / eng * 80}%"></i></div>`).join("");
  let nomlar = el("dOylikNomlar");
  if (!nomlar) {
    nomlar = document.createElement("div");
    nomlar.className = "oy-nomlar"; nomlar.id = "dOylikNomlar";
    el("dOylik").after(nomlar);
  }
  nomlar.innerHTML = oylik.map(o => `<span>${oyQisqa[Number(o.oy.slice(5)) - 1]}</span>`).join("");
}

// Eng faol kitobxonlar va eng ko'p o'qilgan kitoblar: soni yonidagi » bosilsa tafsilot ochiladi
function reytingChiz(id, royxat, nomFn) {
  const eng = Math.max(1, ...royxat.map(x => x.soni));
  el(id).innerHTML = royxat.length ? royxat.map((x, i) =>
    `<li><span class="o">${i + 1}</span><span class="ism">${xavfsiz(nomFn(x))}</span>${ochkichHtml(x.soni).replace("<button", `<button data-i="${i}"`)}<span class="bar"><i style="width:${x.soni / eng * 100}%"></i></span><div class="tafsil" hidden></div></li>`).join("")
    : `<li class="uzilish" style="letter-spacing:0">Hali ma'lumot yo'q.</li>`;
}
function reytingOchkich(id, tarkibFn) {
  el(id).addEventListener("click", e => {
    const b = e.target.closest(".ochkich");
    if (!b) return;
    const tafsil = b.closest("li").querySelector(".tafsil");
    const ochiq = b.getAttribute("aria-expanded") === "true";
    b.setAttribute("aria-expanded", String(!ochiq));
    if (!ochiq) tafsil.innerHTML = tarkibFn(Number(b.dataset.i));
    tafsil.hidden = ochiq;
  });
}
reytingOchkich("dFaollar", i => kitobChiplar(dStat.faollar[i].kitoblar, k => `${xavfsiz(k.nomi)} <small>${qisqaSana(k.sana)}</small>`));
reytingOchkich("dKitoblar", i => kitobChiplar(dStat.kitoblar[i].oquvchilar, o => `${xavfsiz(o.ism)} <small>${xavfsiz(o.sinf)}</small>`));

// ---- Sovg'a berish jadvali ----
function sovgaChiz() {
  const s = dStat;
  el("sovgaYil").textContent = s.yil;
  el("sovgaQoidalar").innerHTML = s.darajalar.map(d =>
    `<span class="daraja ${d.cls}">${xavfsiz(d.nom)}: ${d.min}+ kitob</span><span class="izoh-kichik">${xavfsiz(d.sovga)}</span>`).join("");
  const berildi = s.sovga.filter(x => x.berildi).length;
  el("sovgaSoni").textContent = `${s.sovga.length} ta o'quvchi sovg'aga loyiq · ${berildi} tasiga berildi`;
  el("sovgaJadval").innerHTML = s.sovga.map((x, i) => `<tr>
      <td>${i + 1}</td><td class="nom">${xavfsiz(x.ism)}</td><td>${xavfsiz(x.sinf)}</td>
      <td>${ochkichHtml(x.soni).replace("<button", `<button data-i="${i}"`)}</td>
      <td><span class="daraja ${x.daraja.cls}">${xavfsiz(x.daraja.nom)}</span></td><td class="mua">${xavfsiz(x.daraja.sovga)}</td>
      <td>${x.berildi
        ? `<span class="chip chip-yaxshi">Berildi, ${qisqaSana(x.berildi.sana)}</span>`
        : `<button type="button" class="q-btn sovga-btn" data-i="${i}">Sovg'a berildi</button>`}</td></tr>`).join("");
  el("sovgaBosh").hidden = s.sovga.length > 0;
}
el("sovgaJadval").addEventListener("click", async e => {
  const och = e.target.closest(".ochkich");
  if (och) {
    const x = dStat.sovga[Number(och.dataset.i)];
    jadvalTafsil(och, 7, kitobChiplar(x.kitoblar, k => `${xavfsiz(k.nomi)} <small>${qisqaSana(k.sana)}</small>`));
    return;
  }
  const sb = e.target.closest(".sovga-btn");
  if (!sb) return;
  const x = dStat.sovga[Number(sb.dataset.i)];
  try {
    await tugmaBilan(sb, "...", () => api("/direktor/sovga", { method: "POST", body: { oquvchiId: x.oquvchiId } }));
    dStat = await api("/direktor/statistika");
    sovgaChiz();
    toast(`${x.ism}ga sovg'a berildi: ${x.daraja.sovga}.`);
  } catch (er) { xatoniKorsat(er); }
});
