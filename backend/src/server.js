// Maktab kutubxonasi platformasi: backend
// Ishga tushirish: npm run dev   (README.md'ga qarang)

require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5500" }));

// Frontend fayllarini ham shu server beradi: http://localhost:3000 ochilsa, sayt chiqadi
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, "../../frontend");
app.use(express.static(FRONTEND_DIR));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET .env faylida yo'q yoki 32 belgidan qisqa.");
  process.exit(1);
}
const MUDDAT_KUN = 14;

// ---------- Sana yordamchilari (Toshkent vaqti bilan) ----------
const bugunMatn = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
const sana = s => new Date(s + "T00:00:00Z");
const bugun = () => sana(bugunMatn());
const kunQosh = (d, n) => new Date(d.getTime() + n * 864e5);
const oyBoshi = () => sana(bugunMatn().slice(0, 8) + "01");
const yilBoshi = () => sana(bugunMatn().slice(0, 4) + "-01-01");
// "Aziza Karimova" -> "Aziza K." (boshqa o'quvchilarga to'liq familiya ko'rsatilmaydi)
const qisqaIsm = ism => { const [a, b = ""] = ism.split(" "); return b ? `${a} ${b[0]}.` : a; };

// Async xatolarni bitta joyda ushlash uchun
const ish = fn => (req, res, next) => fn(req, res, next).catch(next);

// ID butun musbat son bo'lishi kerak. Bo'lmasa null qaytadi (500 o'rniga 404 chiqishi uchun)
const idOl = v => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

// Sinf raqamini ajratadi: "7-B" -> 7. Noto'g'ri bo'lsa null
const sinfRaqamOl = s => { const n = parseInt(String(s || ""), 10); return Number.isInteger(n) && n >= 1 && n <= 11 ? n : null; };
// O'quv yili tugash yili: sentabrdan (9-oy) keyin boshlangan yil uchun keyingi yil. Masalan, 2026-10 -> 2027
const joriyOquvYili = () => { const b = bugunMatn(); return Number(b.slice(5, 7)) >= 8 ? Number(b.slice(0, 4)) + 1 : Number(b.slice(0, 4)); };

// ---------- Login cheklovi: 5 marta xato -> 10 daqiqa blok ----------
const xatoKirishlar = new Map(); // login -> { soni, blokGacha }
function bloklanganmi(login) {
  const x = xatoKirishlar.get(login);
  return x && x.blokGacha && x.blokGacha > Date.now();
}
function xatoYoz(login) {
  const x = xatoKirishlar.get(login) || { soni: 0, blokGacha: 0 };
  x.soni++;
  if (x.soni >= 5) { x.blokGacha = Date.now() + 10 * 60 * 1000; x.soni = 0; }
  xatoKirishlar.set(login, x);
}

// ---------- Kirish: rol tanlanmaydi, login va parol orqali aniqlanadi ----------
app.post("/api/kirish", ish(async (req, res) => {
  const login = String(req.body.login || "").trim().toLowerCase();
  const parol = String(req.body.parol || "");
  if (!login || !parol) return res.status(400).json({ xato: "Login va parolni kiriting." });
  if (bloklanganmi(login)) return res.status(429).json({ xato: "Ko'p marta xato kiritildi. 10 daqiqadan keyin urinib ko'ring." });

  const f = await prisma.foydalanuvchi.findUnique({ where: { login } });
  // Login yoki parol xato bo'lsa, qaysi biri xatoligini aytmaymiz (xavfsizlik uchun)
  if (!f || !(await bcrypt.compare(parol, f.parolHash))) {
    xatoYoz(login);
    return res.status(401).json({ xato: "Login yoki parol noto'g'ri." });
  }
  xatoKirishlar.delete(login);
  if (f.holat === "bitirgan") return res.status(403).json({ xato: "Siz maktabni tugatgansiz. Akkaunt yopilgan." });
  const token = jwt.sign({ id: f.id, rol: f.rol, maktabId: f.maktabId }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, rol: f.rol, ism: f.ism });
}));

// ---------- Tekshiruvchilar ----------
function kirganmi(req, res, next) {
  const [, token] = (req.headers.authorization || "").split(" ");
  try { req.f = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ xato: "Avval tizimga kiring." }); }
}
const rolKerak = (...rollar) => (req, res, next) =>
  rollar.includes(req.f.rol) ? next() : res.status(403).json({ xato: "Bu oyna sizning rolingiz uchun emas." });

app.get("/api/men", kirganmi, ish(async (req, res) => {
  const f = await prisma.foydalanuvchi.findUnique({ where: { id: req.f.id }, include: { maktab: true } });
  res.json({ id: f.id, ism: f.ism, rol: f.rol, sinf: f.sinf, maktab: f.maktab?.nomi || null });
}));

// ================= O'QUVCHI =================
app.get("/api/oquvchi/kabinet", kirganmi, rolKerak("oquvchi"), ish(async (req, res) => {
  const men = await prisma.foydalanuvchi.findUnique({ where: { id: req.f.id }, include: { maktab: true } });
  const yozuvlar = await prisma.yozuv.findMany({ where: { oquvchiId: men.id }, include: { kitob: true }, orderBy: { olingan: "desc" } });

  // Sinf reytingi: shu sinfdagi har bir o'quvchi nechta kitob qaytargan
  const sinfdoshlar = await prisma.foydalanuvchi.findMany({
    where: { maktabId: men.maktabId, sinf: men.sinf, rol: "oquvchi" },
    select: { id: true, ism: true, _count: { select: { yozuvlar: { where: { qaytarilgan: { not: null } } } } } }
  });
  const reyting = sinfdoshlar.map(s => ({ ism: s.id === men.id ? men.ism : qisqaIsm(s.ism), soni: s._count.yozuvlar, men: s.id === men.id }))
    .sort((a, b) => b.soni - a.soni || a.ism.localeCompare(b.ism));

  res.json({
    ism: men.ism, login: men.login, sinf: men.sinf, maktab: men.maktab?.nomi || "", maqsad: men.yillikMaqsad,
    qolda: yozuvlar.filter(y => !y.qaytarilgan).map(y => ({ kitob: y.kitob.nomi, muallif: y.kitob.muallif, olingan: y.olingan, muddat: y.muddat })),
    tarix: yozuvlar.filter(y => y.qaytarilgan).map(y => ({ kitob: y.kitob.nomi, muallif: y.kitob.muallif, olingan: y.olingan, muddat: y.muddat, qaytarilgan: y.qaytarilgan })),
    reyting
  });
}));

// ================= KUTUBXONACHI =================
const kut = [kirganmi, rolKerak("kutubxonachi")];

app.get("/api/kutubxonachi/xulosa", ...kut, ish(async (req, res) => {
  const b = bugun(), maktab = { oquvchi: { maktabId: req.f.maktabId } };
  const [berildi, qaytdi, qolda, kech] = await Promise.all([
    prisma.yozuv.count({ where: { ...maktab, olingan: b } }),
    prisma.yozuv.count({ where: { ...maktab, qaytarilgan: b } }),
    prisma.yozuv.count({ where: { ...maktab, qaytarilgan: null, yoqolgan: null } }),
    prisma.yozuv.count({ where: { ...maktab, qaytarilgan: null, yoqolgan: null, muddat: { lt: b } } })
  ]);
  res.json({ berildi, qaytdi, qolda, kech });
}));

// tur: berildi | qaytdi | qolda | kech | tarix (tarix uchun ?dan=YYYY-MM-DD&gacha=YYYY-MM-DD ixtiyoriy)
app.get("/api/kutubxonachi/yozuvlar", ...kut, ish(async (req, res) => {
  const b = bugun(), tur = req.query.tur || "tarix";
  const where = { oquvchi: { maktabId: req.f.maktabId } };
  if (tur === "berildi") where.olingan = b;
  else if (tur === "qaytdi") where.qaytarilgan = b;
  else if (tur === "qolda") { where.qaytarilgan = null; where.yoqolgan = null; }
  else if (tur === "kech") { where.qaytarilgan = null; where.yoqolgan = null; where.muddat = { lt: b }; }
  else if (req.query.dan || req.query.gacha) {
    where.olingan = {};
    if (req.query.dan) where.olingan.gte = sana(req.query.dan);
    if (req.query.gacha) where.olingan.lte = sana(req.query.gacha);
  }
  const yozuvlar = await prisma.yozuv.findMany({
    where, include: { kitob: true, oquvchi: true },
    orderBy: tur === "qolda" || tur === "kech" ? { muddat: "asc" } : { olingan: "desc" },
    take: 500
  });
  res.json(yozuvlar.map(y => ({
    id: y.id, oquvchi: y.oquvchi.ism, sinf: y.sinf || y.oquvchi.sinf, // olingan paytdagi sinf (tarix o'zgarmaydi)
    otaOnaTel: y.oquvchi.otaOnaTel, // telefon faqat kutubxonachiga qaytariladi
    kitob: y.kitob.nomi, tur: y.kitob.tur, olingan: y.olingan, muddat: y.muddat, qaytarilgan: y.qaytarilgan, yoqolgan: y.yoqolgan
  })));
}));

// Kitoblar: har birida nechta nusxa hozir o'quvchilar qo'lida ekanini ham qaytaramiz
app.get("/api/kutubxonachi/kitoblar", ...kut, ish(async (req, res) => {
  const kitoblar = await prisma.kitob.findMany({
    where: { maktabId: req.f.maktabId }, orderBy: { nomi: "asc" },
    include: { _count: { select: { yozuvlar: { where: { qaytarilgan: null } } } } }
  });
  res.json(kitoblar.map(k => ({ id: k.id, nomi: k.nomi, muallif: k.muallif, nusxaSoni: k.nusxaSoni, qolda: k._count.yozuvlar, tur: k.tur, sinfRaqam: k.sinfRaqam })));
}));

app.post("/api/kutubxonachi/kitoblar", ...kut, ish(async (req, res) => {
  const nomi = String(req.body.nomi || "").trim(), muallif = String(req.body.muallif || "").trim();
  const nusxaSoni = Number(req.body.nusxaSoni);
  const tur = req.body.tur === "darslik" ? "darslik" : "kitob";
  const sinfRaqam = tur === "darslik" ? idOl(req.body.sinfRaqam) : null;
  if (nomi.length < 2) return res.status(400).json({ xato: "Kitob nomini yozing." });
  if (muallif.length < 2) return res.status(400).json({ xato: "Muallifni yozing." });
  if (!Number.isInteger(nusxaSoni) || nusxaSoni < 1 || nusxaSoni > 1000) return res.status(400).json({ xato: "Nusxa soni 1 dan 1000 gacha bo'lsin." });
  if (tur === "darslik" && (!sinfRaqam || sinfRaqam > 11)) return res.status(400).json({ xato: "Darslik uchun sinfni tanlang (1-11)." });
  const bor = await prisma.kitob.findFirst({ where: { maktabId: req.f.maktabId, tur, sinfRaqam, nomi: { equals: nomi, mode: "insensitive" }, muallif: { equals: muallif, mode: "insensitive" } } });
  if (bor) {
    // Bor kitob bo'lsa, yangi yozuv ochmaymiz, nusxalar sonini oshiramiz
    const k = await prisma.kitob.update({ where: { id: bor.id }, data: { nusxaSoni: bor.nusxaSoni + nusxaSoni } });
    return res.json({ ...k, qoshildi: false });
  }
  const k = await prisma.kitob.create({ data: { maktabId: req.f.maktabId, nomi, muallif, nusxaSoni, tur, sinfRaqam } });
  res.status(201).json({ ...k, qoshildi: true });
}));

// Kitob berish oynasi uchun maktab o'quvchilari ro'yxati (faqat faol o'quvchilar)
app.get("/api/kutubxonachi/oquvchilar", ...kut, ish(async (req, res) => {
  const oquvchilar = await prisma.foydalanuvchi.findMany({
    where: { maktabId: req.f.maktabId, rol: "oquvchi", holat: "faol" },
    select: { id: true, ism: true, sinf: true }, orderBy: [{ sinf: "asc" }, { ism: "asc" }]
  });
  res.json(oquvchilar);
}));

app.post("/api/kutubxonachi/berish", ...kut, ish(async (req, res) => {
  const oquvchiId = idOl(req.body.oquvchiId), kitobId = idOl(req.body.kitobId);
  if (!oquvchiId || !kitobId) return res.status(404).json({ xato: "O'quvchi yoki kitob topilmadi." });
  const kun = Math.min(Math.max(Number(req.body.kun) || MUDDAT_KUN, 1), 60);
  const [oquvchi, kitob] = await Promise.all([
    prisma.foydalanuvchi.findUnique({ where: { id: oquvchiId } }),
    prisma.kitob.findUnique({ where: { id: kitobId } })
  ]);
  if (!oquvchi || oquvchi.rol !== "oquvchi" || oquvchi.maktabId !== req.f.maktabId) return res.status(404).json({ xato: "O'quvchi topilmadi." });
  if (!kitob || kitob.maktabId !== req.f.maktabId) return res.status(404).json({ xato: "Kitob topilmadi." });
  if (kitob.tur === "darslik") return res.status(400).json({ xato: "Bu darslik. Darsliklar sinf bo'yicha 'Darsliklar' bo'limidan tarqatiladi." });
  const qolda = await prisma.yozuv.count({ where: { kitobId, qaytarilgan: null } });
  if (qolda >= kitob.nusxaSoni) return res.status(400).json({ xato: "Bu kitobning barcha nusxalari hozir o'quvchilarda." });
  const b = bugun();
  const y = await prisma.yozuv.create({ data: { oquvchiId, kitobId, olingan: b, muddat: kunQosh(b, kun), sinf: oquvchi.sinf } });
  res.status(201).json(y);
}));

app.post("/api/kutubxonachi/qaytarish/:id", ...kut, ish(async (req, res) => {
  const yId = idOl(req.params.id);
  if (!yId) return res.status(404).json({ xato: "Yozuv topilmadi." });
  const y = await prisma.yozuv.findUnique({ where: { id: yId }, include: { oquvchi: true } });
  if (!y || y.oquvchi.maktabId !== req.f.maktabId) return res.status(404).json({ xato: "Yozuv topilmadi." });
  if (y.qaytarilgan) return res.status(400).json({ xato: "Bu kitob allaqachon qaytarilgan." });
  if (y.yoqolgan) return res.status(400).json({ xato: "Bu kitob yo'qolgan deb qayd etilgan." });
  // O'chirmaymiz, faqat qaytarilgan sanani yozamiz: tarix saqlanib qoladi
  res.json(await prisma.yozuv.update({ where: { id: y.id }, data: { qaytarilgan: bugun() } }));
}));

// Yangi o'quvchi akkaunti: login va vaqtinchalik parol yaratiladi
const telTogri = t => /^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(t);
function loginAsos(ism) {
  const toza = s => s.toLowerCase().replace(/[‘’ʻʼ'`]/g, "").replace(/[^a-z]/g, "");
  const [a, b = ""] = ism.trim().split(/\s+/);
  return toza(a) + (toza(b) ? "." + toza(b)[0] : "");
}
app.post("/api/kutubxonachi/oquvchilar", ...kut, ish(async (req, res) => {
  const ism = String(req.body.ism || "").trim().replace(/\s+/g, " ");
  const sinf = String(req.body.sinf || "").trim();
  const otaOnaTel = String(req.body.otaOnaTel || ""), ozTel = req.body.ozTel ? String(req.body.ozTel) : null;
  if (ism.split(" ").length < 2) return res.status(400).json({ xato: "Ism va familiyani to'liq yozing." });
  if (!sinf) return res.status(400).json({ xato: "Sinfni kiriting." });
  if (sinfRaqamOl(sinf) === null) return res.status(400).json({ xato: "Sinf 1 dan 11 gacha bo'lishi kerak (masalan: 7-B)." });
  if (!telTogri(otaOnaTel)) return res.status(400).json({ xato: "Ota-ona telefoni +998 XX XXX XX XX ko'rinishida bo'lsin." });
  if (ozTel && !telTogri(ozTel)) return res.status(400).json({ xato: "O'quvchi telefoni to'liq emas." });
  if (req.body.rozilik !== true) return res.status(400).json({ xato: "Ota-ona roziligisiz akkaunt ochib bo'lmaydi." });

  const asos = loginAsos(ism);
  let login = asos, n = 2;
  while (await prisma.foydalanuvchi.findUnique({ where: { login } })) login = asos + n++;
  const harf = "abcdefghjkmnpqrstuvwxyz23456789";
  const parol = Array.from({ length: 8 }, () => harf[crypto.randomInt(harf.length)]).join("");

  await prisma.foydalanuvchi.create({ data: {
    login, parolHash: await bcrypt.hash(parol, 10), rol: "oquvchi", ism, sinf, sinfRaqam: sinfRaqamOl(sinf),
    maktabId: req.f.maktabId, otaOnaTel, ozTel, rozilik: true
  } });
  res.status(201).json({ login, parol }); // parol faqat shu bir marta ko'rsatiladi
}));

// ================= DARSLIKLAR VA SINF O'TKAZISH =================
// Har yili avgustda sinfga darslik tarqatiladi, may oxirida yig'iladi, keyin o'quvchilar keyingi sinfga o'tadi.
// Darslik yozuvining muddati har doim shu yilning 31-maydi.
const yilOxiri = yil => sana(`${yil}-05-31`);
const darslikSinf = req => idOl(req.body.sinfRaqam ?? req.query.sinfRaqam);

// Sinfning darsliklari, faol o'quvchilari soni va hali qaytarilmagan darsliklar ro'yxati
app.get("/api/kutubxonachi/darslik/holat", ...kut, ish(async (req, res) => {
  const sinfRaqam = darslikSinf(req);
  if (!sinfRaqam || sinfRaqam > 11) return res.status(400).json({ xato: "Sinfni tanlang (1-11)." });
  const [darsliklar, oquvchilar, ochiq] = await Promise.all([
    prisma.kitob.count({ where: { maktabId: req.f.maktabId, tur: "darslik", sinfRaqam } }),
    prisma.foydalanuvchi.count({ where: { maktabId: req.f.maktabId, rol: "oquvchi", holat: "faol", sinfRaqam } }),
    prisma.yozuv.findMany({
      where: { kitob: { maktabId: req.f.maktabId, tur: "darslik", sinfRaqam }, qaytarilgan: null, yoqolgan: null },
      include: { oquvchi: true, kitob: true }, orderBy: { id: "asc" }
    })
  ]);
  res.json({
    darsliklar, oquvchilar,
    ochiq: ochiq.map(y => ({ id: y.id, oquvchi: y.oquvchi.ism, kitob: y.kitob.nomi, muddat: y.muddat }))
  });
}));

// Sinfga darsliklarni tarqatish: har bir faol o'quvchiga, sinfdagi har bir darslik uchun bitta yozuv.
// Allaqachon berilgan (qaytarilmagan) darslik qayta yozilmaydi.
app.post("/api/kutubxonachi/darslik/tarqatish", ...kut, ish(async (req, res) => {
  const sinfRaqam = darslikSinf(req);
  if (!sinfRaqam || sinfRaqam > 11) return res.status(400).json({ xato: "Sinfni tanlang (1-11)." });
  const yil = idOl(req.body.yil) || joriyOquvYili();
  const [darsliklar, oquvchilar] = await Promise.all([
    prisma.kitob.findMany({ where: { maktabId: req.f.maktabId, tur: "darslik", sinfRaqam } }),
    prisma.foydalanuvchi.findMany({ where: { maktabId: req.f.maktabId, rol: "oquvchi", holat: "faol", sinfRaqam } })
  ]);
  if (!darsliklar.length) return res.status(400).json({ xato: `${sinfRaqam}-sinf uchun darslik yo'q. Avval katalogga darslik qo'shing.` });
  if (!oquvchilar.length) return res.status(400).json({ xato: `${sinfRaqam}-sinfda faol o'quvchi yo'q.` });

  const band = await prisma.yozuv.findMany({
    where: { kitobId: { in: darsliklar.map(k => k.id) }, oquvchiId: { in: oquvchilar.map(o => o.id) }, qaytarilgan: null },
    select: { oquvchiId: true, kitobId: true }
  });
  const bandlar = new Set(band.map(y => `${y.oquvchiId}:${y.kitobId}`));
  const olingan = bugun(), muddat = yilOxiri(yil);
  const yangilar = [];
  for (const o of oquvchilar) for (const k of darsliklar)
    if (!bandlar.has(`${o.id}:${k.id}`)) yangilar.push({ oquvchiId: o.id, kitobId: k.id, olingan, muddat, sinf: o.sinf });
  if (yangilar.length) await prisma.yozuv.createMany({ data: yangilar });
  res.status(201).json({ yaratildi: yangilar.length, allaqachon: oquvchilar.length * darsliklar.length - yangilar.length, muddat });
}));

// Sinfdagi hamma ochiq darslik qaytarildi deb belgilash (yig'ish kuni)
app.post("/api/kutubxonachi/darslik/yigish", ...kut, ish(async (req, res) => {
  const sinfRaqam = darslikSinf(req);
  if (!sinfRaqam || sinfRaqam > 11) return res.status(400).json({ xato: "Sinfni tanlang (1-11)." });
  const darsliklar = await prisma.kitob.findMany({ where: { maktabId: req.f.maktabId, tur: "darslik", sinfRaqam }, select: { id: true } });
  const r = await prisma.yozuv.updateMany({
    where: { kitobId: { in: darsliklar.map(k => k.id) }, qaytarilgan: null, yoqolgan: null },
    data: { qaytarilgan: bugun() }
  });
  res.json({ qaytarildi: r.count });
}));

// Bitta darslik yo'qolgan yoki yirtilgan deb qayd etiladi (tarix o'chmaydi)
app.post("/api/kutubxonachi/darslik/yoqolgan/:id", ...kut, ish(async (req, res) => {
  const yId = idOl(req.params.id);
  if (!yId) return res.status(404).json({ xato: "Yozuv topilmadi." });
  const y = await prisma.yozuv.findUnique({ where: { id: yId }, include: { oquvchi: true, kitob: true } });
  if (!y || y.oquvchi.maktabId !== req.f.maktabId || y.kitob.tur !== "darslik") return res.status(404).json({ xato: "Yozuv topilmadi." });
  if (y.qaytarilgan || y.yoqolgan) return res.status(400).json({ xato: "Bu darslik allaqachon yopilgan." });
  res.json(await prisma.yozuv.update({ where: { id: y.id }, data: { yoqolgan: bugun() } }));
}));

// Sinflarni keyingi sinfga o'tkazish. Har bir o'quvchi uchun sinf 1 ga oshadi, 11 dan keyin bitirgan bo'ladi.
// Bir o'quv yili uchun bir marta ishlaydi. Qaytarilmagan darslik bo'lsa, tasdiq so'raydi.
app.post("/api/kutubxonachi/sinf-otkazish", ...kut, ish(async (req, res) => {
  const yil = idOl(req.body.yil) || joriyOquvYili();
  const bor = await prisma.oquvYili.findUnique({ where: { yil } });
  if (bor?.sinfOtkazildi) return res.status(409).json({ xato: `${yil} o'quv yili uchun sinflar allaqachon o'tkazilgan.` });

  const ochiq = await prisma.yozuv.count({
    where: { oquvchi: { maktabId: req.f.maktabId }, kitob: { tur: "darslik" }, qaytarilgan: null, yoqolgan: null }
  });
  if (ochiq > 0 && req.body.tasdiq !== true)
    return res.status(409).json({ xato: `${ochiq} ta darslik hali qaytarilmagan. Baribir o'tkazasizmi?`, ochiq, tasdiqKerak: true });

  const oquvchilar = await prisma.foydalanuvchi.findMany({
    where: { maktabId: req.f.maktabId, rol: "oquvchi", holat: "faol" }, select: { id: true, sinf: true, sinfRaqam: true }
  });
  let bitirgan = 0;
  const amallar = oquvchilar.map(o => {
    const eski = o.sinfRaqam ?? sinfRaqamOl(o.sinf) ?? 1;
    const yangi = eski + 1;
    if (yangi > 11) { bitirgan++; return prisma.foydalanuvchi.update({ where: { id: o.id }, data: { sinfRaqam: 11, holat: "bitirgan" } }); }
    const sinfMatn = String(o.sinf || "").replace(/^\d{1,2}/, String(yangi));
    return prisma.foydalanuvchi.update({ where: { id: o.id }, data: { sinfRaqam: yangi, sinf: sinfMatn } });
  });
  amallar.push(prisma.oquvYili.upsert({
    where: { yil }, create: { yil, sinfOtkazildi: new Date() }, update: { sinfOtkazildi: new Date() }
  }));
  await prisma.$transaction(amallar);
  res.json({ otkazildi: oquvchilar.length - bitirgan, bitirgan, yil });
}));

// ================= BUYURTMALAR =================
// Yo'l: kutubxonachi -> direktor -> nazorat organi
app.post("/api/buyurtmalar", ...kut, ish(async (req, res) => {
  const kitobNomi = String(req.body.kitobNomi || "").trim(), soni = Number(req.body.soni);
  if (kitobNomi.length < 2) return res.status(400).json({ xato: "Kitob nomini yozing." });
  if (!Number.isInteger(soni) || soni < 1 || soni > 500) return res.status(400).json({ xato: "Nusxa soni 1 dan 500 gacha bo'lsin." });
  const b = await prisma.buyurtma.create({ data: {
    maktabId: req.f.maktabId, kitobNomi, soni,
    muallif: req.body.muallif ? String(req.body.muallif) : null,
    sabab: req.body.sabab ? String(req.body.sabab) : null,
    tarix: { create: { kim: "Kutubxonachi", matn: "Buyurtma yuborildi" } }
  }, include: { tarix: true } });
  res.status(201).json(b);
}));

app.get("/api/buyurtmalar", kirganmi, rolKerak("kutubxonachi", "direktor", "nazorat"), ish(async (req, res) => {
  // Nazorat organi faqat direktor tasdiqlagan buyurtmalarni ko'radi
  const where = req.f.rol === "nazorat"
    ? { holat: { in: ["nazorat", "tasdiqlandi", "rad_nazorat"] } }
    : { maktabId: req.f.maktabId };
  res.json(await prisma.buyurtma.findMany({ where, include: { tarix: { orderBy: { sana: "asc" } }, maktab: true }, orderBy: { id: "desc" } }));
}));

app.post("/api/buyurtmalar/:id/qaror", kirganmi, rolKerak("direktor", "nazorat"), ish(async (req, res) => {
  const ha = req.body.ha === true, izoh = req.body.izoh ? String(req.body.izoh).trim() : "";
  if (!ha && !izoh) return res.status(400).json({ xato: "Rad etish sababini yozing." });
  const bId = idOl(req.params.id);
  if (!bId) return res.status(404).json({ xato: "Buyurtma topilmadi." });
  const b = await prisma.buyurtma.findUnique({ where: { id: bId } });
  if (!b) return res.status(404).json({ xato: "Buyurtma topilmadi." });

  let yangi, kim;
  if (req.f.rol === "direktor") {
    if (b.maktabId !== req.f.maktabId || b.holat !== "direktor") return res.status(400).json({ xato: "Bu buyurtma sizning qaroringizni kutmayapti." });
    yangi = ha ? "nazorat" : "rad_direktor"; kim = "Direktor";
  } else {
    if (b.holat !== "nazorat") return res.status(400).json({ xato: "Avval direktor tasdiqlashi kerak." });
    yangi = ha ? "tasdiqlandi" : "rad_nazorat"; kim = "Nazorat organi";
  }
  const natija = await prisma.buyurtma.update({
    where: { id: b.id },
    data: { holat: yangi, tarix: { create: { kim, matn: ha ? (kim === "Direktor" ? "Tasdiqladi va nazoratga yubordi" : "Tasdiqladi") : "Rad etdi", izoh: izoh || null } } },
    include: { tarix: true }
  });
  res.json(natija);
}));

// ================= DIREKTOR (telefon raqamlarsiz) =================
const dir = [kirganmi, rolKerak("direktor")];

app.get("/api/direktor/xulosa", ...dir, ish(async (req, res) => {
  const b = bugun(), maktab = { oquvchi: { maktabId: req.f.maktabId } };
  const [shuOy, qolda, kech, oquvchilar, faol] = await Promise.all([
    prisma.yozuv.count({ where: { ...maktab, qaytarilgan: { gte: oyBoshi() } } }),
    prisma.yozuv.count({ where: { ...maktab, qaytarilgan: null, yoqolgan: null } }),
    prisma.yozuv.count({ where: { ...maktab, qaytarilgan: null, yoqolgan: null, muddat: { lt: b } } }),
    prisma.foydalanuvchi.count({ where: { maktabId: req.f.maktabId, rol: "oquvchi" } }),
    prisma.yozuv.groupBy({ by: ["oquvchiId"], where: { ...maktab, olingan: { gte: kunQosh(b, -30) } } }).then(g => g.length)
  ]);
  res.json({ shuOy, qolda, kech, oquvchilar, faol });
}));

// tur: shuoy | qolda | kech (telefon raqamlarisiz)
app.get("/api/direktor/yozuvlar", ...dir, ish(async (req, res) => {
  const b = bugun(), tur = req.query.tur || "qolda";
  const where = { oquvchi: { maktabId: req.f.maktabId } };
  if (tur === "shuoy") where.qaytarilgan = { gte: oyBoshi() };
  else if (tur === "kech") { where.qaytarilgan = null; where.muddat = { lt: b }; }
  else where.qaytarilgan = null;
  const yozuvlar = await prisma.yozuv.findMany({
    where, include: { kitob: true, oquvchi: { select: { ism: true, sinf: true } } },
    orderBy: tur === "shuoy" ? { qaytarilgan: "desc" } : { muddat: "asc" }, take: 500
  });
  res.json(yozuvlar.map(y => ({ id: y.id, oquvchi: y.oquvchi.ism, sinf: y.oquvchi.sinf, kitob: y.kitob.nomi,
    olingan: y.olingan, muddat: y.muddat, qaytarilgan: y.qaytarilgan })));
}));

// So'nggi 30 kunda kitob olgan o'quvchilar va olgan kitoblari
app.get("/api/direktor/faollar", ...dir, ish(async (req, res) => {
  const yozuvlar = await prisma.yozuv.findMany({
    where: { oquvchi: { maktabId: req.f.maktabId }, olingan: { gte: kunQosh(bugun(), -30) } },
    include: { kitob: true, oquvchi: { select: { id: true, ism: true, sinf: true } } }, orderBy: { olingan: "desc" }
  });
  const m = new Map();
  for (const y of yozuvlar) {
    const x = m.get(y.oquvchiId) || { ism: y.oquvchi.ism, sinf: y.oquvchi.sinf, soni: 0, oxirgi: y.olingan, kitoblar: [] };
    x.soni++;
    x.kitoblar.push({ nomi: y.kitob.nomi, olingan: y.olingan, qaytarilgan: y.qaytarilgan });
    m.set(y.oquvchiId, x);
  }
  res.json([...m.values()].sort((a, b) => b.soni - a.soni || b.oxirgi - a.oxirgi));
}));

// Sovg'a darajalari: shu yil o'qilgan (qaytarilgan) kitoblar soniga qarab
const SOVGA_DARAJA = [
  { min: 20, nom: "Oltin kitobxon",  sovga: "Kitoblar to'plami va faxriy yorliq", cls: "oltin" },
  { min: 10, nom: "Kumush kitobxon", sovga: "Sevimli kitobi va faxriy yorliq",    cls: "kumush" },
  { min: 5,  nom: "Bronza kitobxon", sovga: "Faxriy yorliq",                       cls: "bronza" }
];

// Direktor paneli statistikasi: oyma-oy, eng faollar, eng ko'p o'qilgan kitoblar, sovg'a jadvali
app.get("/api/direktor/statistika", ...dir, ish(async (req, res) => {
  const b = bugunMatn(), yil = Number(b.slice(0, 4)), oy = Number(b.slice(5, 7));
  const oylar = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(yil, oy - 12 + i, 1));
    return d.toISOString().slice(0, 7); // "2026-10"
  });
  const boshi = sana(oylar[0] + "-01"), yilB = yilBoshi();
  const yozuvlar = await prisma.yozuv.findMany({
    where: { oquvchi: { maktabId: req.f.maktabId }, OR: [{ olingan: { gte: boshi } }, { qaytarilgan: { gte: boshi } }] },
    include: { kitob: true, oquvchi: { select: { id: true, ism: true, sinf: true } } }
  });

  const oylik = oylar.map(o => ({ oy: o, soni: yozuvlar.filter(y => y.qaytarilgan && y.qaytarilgan.toISOString().startsWith(o)).length }));

  // Shu yil o'qilgan kitoblar, o'quvchi bo'yicha
  const shuYil = new Map();
  for (const y of yozuvlar.filter(y => y.qaytarilgan && y.qaytarilgan >= yilB)) {
    const x = shuYil.get(y.oquvchiId) || { oquvchiId: y.oquvchiId, ism: y.oquvchi.ism, sinf: y.oquvchi.sinf, soni: 0, kitoblar: [] };
    x.soni++;
    x.kitoblar.push({ nomi: y.kitob.nomi, sana: y.qaytarilgan });
    shuYil.set(y.oquvchiId, x);
  }
  const oquvchilar = [...shuYil.values()].sort((a, b) => b.soni - a.soni || a.ism.localeCompare(b.ism));
  oquvchilar.forEach(x => x.kitoblar.sort((a, b) => b.sana - a.sana));

  // Eng ko'p o'qilgan kitoblar (so'nggi 12 oyda olinganlar)
  const kitobMap = new Map();
  for (const y of yozuvlar.filter(y => y.olingan >= boshi)) {
    const k = kitobMap.get(y.kitobId) || { nomi: y.kitob.nomi, muallif: y.kitob.muallif, soni: 0, oquvchilar: [] };
    k.soni++;
    k.oquvchilar.push({ ism: y.oquvchi.ism, sinf: y.oquvchi.sinf });
    kitobMap.set(y.kitobId, k);
  }
  const kitoblar = [...kitobMap.values()].sort((a, b) => b.soni - a.soni).slice(0, 5);

  const berilgan = await prisma.sovga.findMany({ where: { yil, oquvchi: { maktabId: req.f.maktabId } } });
  const sovga = oquvchilar
    .map(x => ({ ...x, daraja: SOVGA_DARAJA.find(d => x.soni >= d.min) || null }))
    .filter(x => x.daraja)
    .map(x => ({ ...x, berildi: berilgan.find(s => s.oquvchiId === x.oquvchiId) || null }));

  res.json({ yil, oylik, faollar: oquvchilar.slice(0, 5), kitoblar, darajalar: SOVGA_DARAJA, sovga });
}));

app.post("/api/direktor/sovga", ...dir, ish(async (req, res) => {
  const oquvchiId = idOl(req.body.oquvchiId), yil = Number(bugunMatn().slice(0, 4));
  if (!oquvchiId) return res.status(404).json({ xato: "O'quvchi topilmadi." });
  const o = await prisma.foydalanuvchi.findUnique({ where: { id: oquvchiId } });
  if (!o || o.rol !== "oquvchi" || o.maktabId !== req.f.maktabId) return res.status(404).json({ xato: "O'quvchi topilmadi." });
  const soni = await prisma.yozuv.count({ where: { oquvchiId, qaytarilgan: { gte: yilBoshi() } } });
  const daraja = SOVGA_DARAJA.find(d => soni >= d.min);
  if (!daraja) return res.status(400).json({ xato: "Bu o'quvchi hali sovg'aga loyiq emas." });
  if (await prisma.sovga.findUnique({ where: { oquvchiId_yil: { oquvchiId, yil } } })) return res.status(400).json({ xato: "Bu o'quvchiga shu yil sovg'a berilgan." });
  res.status(201).json(await prisma.sovga.create({ data: { oquvchiId, yil, daraja: daraja.nom } }));
}));

// ================= NAZORAT ORGANI (ismlarsiz, faqat statistika) =================
// Hamma maktab bo'yicha bitta SQL so'rov: maktablar ko'payganda ham tez ishlaydi
app.get("/api/nazorat/maktablar", kirganmi, rolKerak("nazorat"), ish(async (req, res) => {
  const yB = yilBoshi();
  const qatorlar = await prisma.$queryRaw`
    SELECT m.id, m.nomi, m.tuman,
      (SELECT COUNT(*) FROM "Foydalanuvchi" f WHERE f."maktabId" = m.id AND f.rol = 'oquvchi')::int AS oquvchi,
      (SELECT COALESCE(SUM(k."nusxaSoni"), 0) FROM "Kitob" k WHERE k."maktabId" = m.id)::int AS fond,
      (SELECT COUNT(*) FROM "Yozuv" y JOIN "Foydalanuvchi" f ON f.id = y."oquvchiId"
         WHERE f."maktabId" = m.id AND y.qaytarilgan >= ${yB})::int AS oqilgan,
      (SELECT COUNT(*) FROM "Yozuv" y JOIN "Foydalanuvchi" f ON f.id = y."oquvchiId"
         WHERE f."maktabId" = m.id AND y.qaytarilgan >= ${yB} AND y.qaytarilgan > y.muddat)::int AS kechikkan
    FROM "Maktab" m ORDER BY m.nomi`;
  res.json(qatorlar.map(m => ({
    id: m.id, nomi: m.nomi, tuman: m.tuman, oquvchi: m.oquvchi, fond: m.fond, oqilgan: m.oqilgan,
    ortacha: m.oquvchi ? +(m.oqilgan / m.oquvchi).toFixed(1) : 0,
    kech: m.oqilgan ? Math.round(m.kechikkan / m.oqilgan * 100) : 0
  })));
}));

// ---------- Xatolar ----------
app.use((req, res) => res.status(404).json({ xato: "Bunday manzil yo'q." }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ xato: "Serverda xato yuz berdi." });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Server ishga tushdi: http://localhost:${PORT}`));
