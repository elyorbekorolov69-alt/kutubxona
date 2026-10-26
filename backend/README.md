# Maktab kutubxonasi: backend

Node.js + Express + Prisma + PostgreSQL. Ishlab chiqish davrida baza bepul **Supabase**'da turadi,
pilot maktabdan oldin O'zbekistondagi serverga ko'chiriladi.

> Muhim: Supabase serverlari chet elda. Unga faqat **o'ylab topilgan (namuna) ma'lumotlar** yoziladi.
> Haqiqiy o'quvchilar ma'lumotlari faqat O'zbekistondagi serverdagi bazaga yoziladi.

## 1. Bir martalik sozlash

1. [Node.js](https://nodejs.org) 20 yoki undan yangisini o'rnating.
2. [supabase.com](https://supabase.com) da bepul akkaunt va yangi loyiha oching
   (region: Yevropa, masalan Frankfurt). Ma'lumotlar bazasi parolini yozib qo'ying.
3. Supabase: **Project Settings → Database → Connection string → URI** ni nusxalang.
4. Shu papkada:

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

5. `.env` ichida `DATABASE_URL` ga 3-qadamdagi manzilni, `JWT_SECRET` ga uzun tasodifiy satr yozing.

## 2. Bazani yaratish va namuna ma'lumotlar

```bash
npm run db:push    # schema.prisma bo'yicha jadvallarni yaratadi
npm run db:seed    # namuna akkauntlar, kitoblar, yozuvlar
npm run db:studio  # bazani brauzerda ko'rish (ixtiyoriy)
```

## 3. Serverni ishga tushirish

```bash
npm run dev
```

Brauzerda **http://localhost:3000** ni oching: server `../frontend` papkasidagi saytni ham beradi.

Tekshirish (boshqa terminalda):

```bash
curl -X POST http://localhost:3000/api/kirish -H "Content-Type: application/json" \
  -d '{"login":"aziza.k","parol":"aziza2026"}'
```

Javobda `token` keladi. Keyingi so'rovlarda uni `Authorization: Bearer <token>` sarlavhasi bilan yuboring.

## Sinov akkauntlari (faqat namuna bazada)

| Login | Parol | Rol |
| --- | --- | --- |
| dilnoza.r | kutub2026 | kutubxonachi |
| direktor12 | direktor2026 | direktor |
| xtb.toshkent | nazorat2026 | nazorat |
| aziza.k | aziza2026 | o'quvchi |
| sardor.n | sardor2026 | o'quvchi |
| bekzod.o | bekzod2026 | o'quvchi |

## API manzillari

| Usul | Manzil | Kim uchun | Nima qiladi |
| --- | --- | --- | --- |
| POST | /api/kirish | hamma | login + parol → token va rol |
| GET | /api/men | kirgan har kim | o'zi haqida ma'lumot |
| GET | /api/oquvchi/kabinet | o'quvchi | qo'lidagi kitob, tarix, maqsad, sinf reytingi |
| GET | /api/kutubxonachi/xulosa | kutubxonachi | bugun berildi/qaytdi, qo'lda, kechikkan |
| GET | /api/kutubxonachi/yozuvlar?tur=qolda | kutubxonachi | ro'yxatlar: berildi, qaytdi, qolda, kech, tarix |
| GET | /api/kutubxonachi/kitoblar | kutubxonachi | katalog, har birida nechta nusxa qo'lda |
| POST | /api/kutubxonachi/kitoblar | kutubxonachi | katalogga kitob qo'shish (`nomi`, `muallif`, `nusxaSoni`) |
| GET | /api/kutubxonachi/oquvchilar | kutubxonachi | maktab o'quvchilari (kitob berish uchun) |
| POST | /api/kutubxonachi/berish | kutubxonachi | kitob berish (`oquvchiId`, `kitobId`, `kun`), bo'sh nusxa bo'lmasa rad etadi |
| POST | /api/kutubxonachi/qaytarish/:id | kutubxonachi | kitobni qaytarib olish (tarix o'chmaydi) |
| POST | /api/kutubxonachi/oquvchilar | kutubxonachi | yangi o'quvchi akkaunti, login va parol qaytaradi |
| POST | /api/buyurtmalar | kutubxonachi | kitob buyurtmasi |
| GET | /api/buyurtmalar | kutubxonachi, direktor, nazorat | buyurtmalar (nazorat faqat direktor tasdiqlaganlarini ko'radi) |
| POST | /api/buyurtmalar/:id/qaror | direktor, nazorat | `{ "ha": true/false, "izoh": "..." }` |
| GET | /api/direktor/xulosa | direktor | maktab ko'rsatkichlari (telefonlarsiz) |
| GET | /api/direktor/yozuvlar?tur=qolda | direktor | ro'yxatlar: shuoy, qolda, kech (telefonlarsiz) |
| GET | /api/direktor/faollar | direktor | so'nggi 30 kunda kitob olganlar |
| GET | /api/direktor/statistika | direktor | oyma-oy, eng faollar, eng ko'p o'qilgan kitoblar, sovg'a jadvali |
| POST | /api/direktor/sovga | direktor | sovg'a berildi deb belgilash (`oquvchiId`) |
| GET | /api/nazorat/maktablar | nazorat | maktablar statistikasi (ismlarsiz) |

## Xavfsizlik

- Parollar bcrypt bilan xeshlanadi, ochiq saqlanmaydi.
- 5 marta xato login → 10 daqiqa blok.
- Har bir so'rovda rol tekshiriladi; telefonlar faqat kutubxonachiga qaytariladi.
- `yozuvlar` jadvalidan o'chirish yo'li yo'q.
- `.env` hech qachon GitHub'ga yuklanmaydi.
