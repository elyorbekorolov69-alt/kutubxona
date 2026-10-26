// ================= KIRISH VARAG'I: MAYDONLAR =================
// Login va parol varag'idagi yordamchi tugmalar. (Avval bu faylda bosh oyna animatsiyasi ham bor edi.)

// Kirish formasi elementlari (kirish.js ham ishlatadi)
const forma = el("kirishForma");
const login = el("login");
const parol = el("parol");
const natija = el("natija");

// Parolni ko'rsatish / yashirish
document.getElementById("korsatBtn").addEventListener("click", e => {
  const yashirin = parol.type === "password";
  parol.type = yashirin ? "text" : "password";
  e.target.textContent = yashirin ? "Yashir" : "Ko'rsat";
});

// Parolni unutdim
document.getElementById("unutdim").addEventListener("click", e => {
  e.preventDefault();
  natija.hidden = false;
  natija.textContent = "Parolni tiklash uchun maktab kutubxonachisiga yoki administratorga murojaat qiling.";
});
