// ================= SOZLAMALAR =================
// Bu faylni o'zgartirish bilan sayt qaysi serverga ulanishini belgilaysiz.

window.SOZLAMA = {
  // Backend manzili.
  // - Sayt backendning o'zidan ochilsa (http://localhost:3000 yoki haqiqiy domen): bo'sh qoldiring.
  // - VS Code "Live Server" (5500-port) dan ochsangiz: backend 3000-portda deb hisoblaymiz.
  API_URL: location.port === "5500" ? "http://localhost:3000" : "",

  // Kirish oynasida sinov akkauntlari ro'yxatini ko'rsatish.
  // Haqiqiy maktabda ishga tushirishdan oldin ALBATTA false qiling!
  DEMO: true,

  // DEMO yoqilganda ko'rinadigan akkauntlar (backend/prisma/seed.js bilan bir xil)
  SINOV_AKKAUNTLAR: [
    { login: "dilnoza.r",    parol: "kutub2026",    izoh: "Kutubxonachi" },
    { login: "direktor12",   parol: "direktor2026", izoh: "Direktor" },
    { login: "xtb.toshkent", parol: "nazorat2026",  izoh: "Nazorat organi" },
    { login: "aziza.k",      parol: "aziza2026",    izoh: "O'quvchi, ko'p o'qiydi" },
    { login: "sardor.n",     parol: "sardor2026",   izoh: "O'quvchi, kitobi kechikkan" },
    { login: "bekzod.o",     parol: "bekzod2026",   izoh: "O'quvchi, endi boshlagan" }
  ]
};
