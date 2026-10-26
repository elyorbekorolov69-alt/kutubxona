// Namuna ma'lumotlar: faqat sinov uchun! Haqiqiy o'quvchilar ma'lumotini bu yerga yozmang.
// Ishga tushirish: npm run db:seed

require("dotenv").config();
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const bugunMatn = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
const BUGUN = new Date(bugunMatn() + "T00:00:00Z");
const kunOldin = n => new Date(BUGUN.getTime() - n * 864e5);
const kunQosh = (d, n) => new Date(d.getTime() + n * 864e5);
// Joriy o'quv yili tugash yili (sentabrdan keyin keyingi yil)
const joriyOquvYiliSeed = () => (Number(bugunMatn().slice(5, 7)) >= 8 ? Number(bugunMatn().slice(0, 4)) + 1 : Number(bugunMatn().slice(0, 4)));

async function main() {
  // Tozalash (faqat sinov bazasida!)
  await prisma.sovga.deleteMany();
  await prisma.buyurtmaTarixi.deleteMany();
  await prisma.buyurtma.deleteMany();
  await prisma.yozuv.deleteMany();
  await prisma.kitob.deleteMany();
  await prisma.oquvYili.deleteMany();
  await prisma.foydalanuvchi.deleteMany();
  await prisma.maktab.deleteMany();

  const maktab = await prisma.maktab.create({ data: { nomi: "12-maktab", tuman: "Chilonzor", viloyat: "Toshkent sh." } });
  const hash = p => bcrypt.hash(p, 10);

  await prisma.foydalanuvchi.createMany({ data: [
    { login: "dilnoza.r", parolHash: await hash("kutub2026"), rol: "kutubxonachi", ism: "Dilnoza Rahimova", maktabId: maktab.id },
    { login: "direktor12", parolHash: await hash("direktor2026"), rol: "direktor", ism: "Rustam Aliyev", maktabId: maktab.id },
    { login: "xtb.toshkent", parolHash: await hash("nazorat2026"), rol: "nazorat", ism: "Toshkent sh. XTB" }
  ] });

  // Parol avval bcrypt bilan xeshlanadi, bazaga faqat xesh yoziladi
  const yarat = async (login, parol, ism, sinf, tel, maqsad) => prisma.foydalanuvchi.create({ data: {
    login, parolHash: await hash(parol), rol: "oquvchi", ism, sinf, sinfRaqam: parseInt(sinf, 10), maktabId: maktab.id, otaOnaTel: tel, rozilik: true, yillikMaqsad: maqsad
  } });
  const aziza = await yarat("aziza.k", "aziza2026", "Aziza Karimova", "7-B", "+998 90 214 37 51", 25);
  const sardor = await yarat("sardor.n", "sardor2026", "Sardor Nazarov", "7-B", "+998 91 742 05 39", 10);
  const bekzod = await yarat("bekzod.o", "bekzod2026", "Bekzod Olimov", "5-A", "+998 90 623 71 04", 5);

  const nomlar = [
    ["Sariq devni minib", "Xudoyberdi To'xtaboyev"], ["Shum bola", "G'afur G'ulom"], ["Bolalik", "Oybek"],
    ["Dunyoning ishlari", "O'tkir Hoshimov"], ["O'tkan kunlar", "Abdulla Qodiriy"], ["Alpomish", "Xalq dostoni"],
    ["Kecha va kunduz", "Cho'lpon"], ["Kichkina shahzoda", "Antuan de Sent-Ekzyuperi"], ["Robinzon Kruzo", "Daniel Defo"]
  ];
  const kitoblar = [];
  for (const [nomi, muallif] of nomlar) kitoblar.push(await prisma.kitob.create({ data: { maktabId: maktab.id, nomi, muallif, nusxaSoni: 5 } }));
  // Darsliklar: sinf bo'yicha to'plam (avgustda tarqatiladi, mayda yig'iladi)
  const darsliklar = [];
  for (const [nomi, muallif, sinfRaqam] of [["Ona tili 7", "Maktab nashriyoti", 7], ["Algebra 7", "Maktab nashriyoti", 7], ["Matematika 5", "Maktab nashriyoti", 5]])
    darsliklar.push(await prisma.kitob.create({ data: { maktabId: maktab.id, nomi, muallif, nusxaSoni: 10, tur: "darslik", sinfRaqam } }));

  const k = nomi => [...kitoblar, ...darsliklar].find(x => x.nomi === nomi).id;
  const yoz = (o, kitob, oldin, qaytdiKun) => {
    const olingan = kunOldin(oldin);
    return prisma.yozuv.create({ data: { oquvchiId: o.id, kitobId: k(kitob), olingan, muddat: kunQosh(olingan, 14),
      qaytarilgan: qaytdiKun == null ? null : kunQosh(olingan, qaytdiKun), sinf: o.sinf } });
  };

  // Aziza: ko'p o'qiydi, hozir qo'lida bitta kitob
  const azizaKitoblar = nomlar.map(n => n[0]).filter(n => n !== "Kichkina shahzoda");
  for (let i = 0; i < azizaKitoblar.length; i++) await yoz(aziza, azizaKitoblar[i], 20 + i * 11, 9);
  await yoz(aziza, "Kichkina shahzoda", 9, null);
  // Sardor: kitobni 6 kun kechiktirgan
  await yoz(sardor, "Shum bola", 60, 21);
  await yoz(sardor, "Dunyoning ishlari", 20, null);
  // Bekzod: endi boshlagan
  await yoz(bekzod, "Sariq devni minib", 30, 10);
  // Darsliklar: joriy o'quv yili (muddat 31-may). Aziza va Sardor hali qo'lida.
  const oquvYil = joriyOquvYiliSeed();
  for (const [o, kitob] of [[aziza, "Ona tili 7"], [aziza, "Algebra 7"], [sardor, "Ona tili 7"], [bekzod, "Matematika 5"]])
    await prisma.yozuv.create({ data: { oquvchiId: o.id, kitobId: k(kitob), olingan: kunOldin(10),
      muddat: new Date(`${oquvYil}-05-31T00:00:00Z`), sinf: o.sinf } });

  // Bitta buyurtma: direktor ko'rib chiqmoqda
  await prisma.buyurtma.create({ data: { maktabId: maktab.id, kitobNomi: "Kichkina shahzoda", muallif: "Antuan de Sent-Ekzyuperi",
    soni: 15, sabab: "7-sinflarda navbat bor.", tarix: { create: { kim: "Kutubxonachi", matn: "Buyurtma yuborildi" } } } });

  console.log("Namuna ma'lumotlar yozildi.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
