// ================= TIZIMGA KIRISH =================
// Rol tanlanmaydi: server login va parol orqali kimligini aniqlaydi va mos oynani ochamiz.
// Bu fayl eng oxirida yuklanadi, shuning uchun boshqa fayllardagi funksiyalar tayyor.

const ROL_EKRANI = {
  oquvchi:      { ekran: "ekranOquvchi",      yukla: () => oquvchiOynasiniYukla() },
  kutubxonachi: { ekran: "ekranKutubxonachi", yukla: () => kutubxonachiniYukla(), keyin: () => bildirishniKorsat() },
  direktor:     { ekran: "ekranDirektor",     yukla: () => direktorniYukla(),     keyin: () => kutayotganBildirish("direktor") },
  nazorat:      { ekran: "ekranNazorat",      yukla: ism => nazoratniYukla(ism),  keyin: () => kutayotganBildirish("nazorat") }
};

// Rolga mos oynani ma'lumot bilan to'ldirib ochish
async function rolOynasiniOch(rol, ism) {
  const r = ROL_EKRANI[rol];
  if (!r) throw new Error("Noma'lum rol: " + rol);
  sarlavhaniToldir(ism);
  if (rol === "kutubxonachi") el("kutSalom").textContent = `Xayrli kun, ${ism.split(" ")[0]}!`;
  if (rol === "direktor") el("dirSalom").textContent = `Assalomu alaykum, ${ism.split(" ")[0]}!`;
  await r.yukla(ism);
  await otish(r.ekran);
  if (r.keyin) r.keyin();
}

forma.addEventListener("submit", async e => {
  e.preventDefault();
  natija.hidden = true;
  const l = login.value.trim().toLowerCase();
  xato("loginMaydon", "loginXato", l ? "" : "Loginni kiriting.");
  xato("parolMaydon", "parolXato", parol.value ? "" : "Parolni kiriting.");
  if (!l || !parol.value) return;

  try {
    const javob = await tugmaBilan(el("kirishBtn"), "Tekshirilmoqda...", () =>
      api("/kirish", { method: "POST", body: { login: l, parol: parol.value } }));
    Sessiya.saqla(javob, el("eslab").checked);
    parol.value = "";
    await rolOynasiniOch(javob.rol, javob.ism);
  } catch (er) {
    if (er.holat === 401 || er.holat === 429 || er.holat === 400) xato("parolMaydon", "parolXato", er.message);
    else xatoniKorsat(er);
  }
});

// Chiqish: barcha oynalardagi "Chiqish" tugmalari
function tizimdanChiqish(eskirgan = false) {
  Sessiya.tozala();
  document.querySelectorAll(".modal-fon").forEach(m => (m.hidden = true));
  parol.value = "";
  if (joriyEkran !== "ekranKirish") otish("ekranKirish");
  if (eskirgan) { natija.hidden = false; natija.textContent = "Sessiya tugadi. Qaytadan kiring."; }
}
document.querySelectorAll(".chiqish").forEach(b => b.addEventListener("click", () => tizimdanChiqish()));

// Sinov akkauntlari (faqat SOZLAMA.DEMO yoqilganda)
if (SOZLAMA.DEMO) {
  el("sinovBlok").hidden = false;
  el("sinovRoyxat").innerHTML = SOZLAMA.SINOV_AKKAUNTLAR.map((a, i) =>
    `<button type="button" class="sinov-btn" data-i="${i}"><b>${xavfsiz(a.login)} / ${xavfsiz(a.parol)}</b><span>${xavfsiz(a.izoh)}</span></button>`).join("");
  el("sinovRoyxat").addEventListener("click", e => {
    const b = e.target.closest(".sinov-btn");
    if (!b) return;
    const a = SOZLAMA.SINOV_AKKAUNTLAR[Number(b.dataset.i)];
    login.value = a.login; parol.value = a.parol;
    xato("loginMaydon", "loginXato", ""); xato("parolMaydon", "parolXato", "");
    el("kirishBtn").focus();
  });
}

// ---- Sahifa ochilganda: avval kirgan bo'lsa, o'z oynasiga varaqlab o'tadi ----
// Kirish videosi tugagandan keyin ishlaydi (index.html dagi "sayt-ochildi" hodisasi).
async function sessiyaniTiklash() {
  const s = Sessiya.oqi();
  if (!s.token || !s.rol) return;
  try {
    const men = await api("/men");              // token hali amal qiladimi?
    sarlavhaniToldir(men.ism);
    const r = ROL_EKRANI[men.rol];
    if (men.rol === "kutubxonachi") el("kutSalom").textContent = `Xayrli kun, ${men.ism.split(" ")[0]}!`;
    if (men.rol === "direktor") el("dirSalom").textContent = `Assalomu alaykum, ${men.ism.split(" ")[0]}!`;
    await r.yukla(men.ism);
    await otish(r.ekran);
    if (r.keyin) r.keyin();
  } catch (e) {
    // Token eskirgan yoki server ishlamayapti: kirish varag'ida qolamiz
    if (e.holat !== 401) xatoniKorsat(e);
  }
}
if (window.saytOchildi) sessiyaniTiklash();
else window.addEventListener("sayt-ochildi", sessiyaniTiklash, { once: true });
