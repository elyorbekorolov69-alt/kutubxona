# Maktab kutubxonasi platformasi

```
kutubxona/
├── backend/    Node.js + Express + Prisma + PostgreSQL (server va baza)
└── frontend/   HTML + CSS + JavaScript (sayt), qurish (build) kerak emas
```

## Tez ishga tushirish

1. `backend/README.md` dagi 1–2-qadamlarni bajaring (Supabase, `.env`, `npm install`, `db:push`, `db:seed`).
2. `backend` papkasida:

```bash
npm run dev
```

3. Brauzerda **http://localhost:3000** ni oching. Backend frontendni ham o'zi beradi, alohida server kerak emas.

Sinov akkauntlari kirish oynasidagi "Sinov akkauntlari" bo'limida turibdi.

## Frontend tuzilishi

| Fayl | Nima qiladi |
| --- | --- |
| `index.html` | Barcha oynalar: bosh oyna, kirish, o'quvchi, kutubxonachi, ro'yxat, buyurtma, direktor, nazorat |
| `css/style.css` | Barcha ko'rinish: ranglar, kartochkalar, animatsiyalar |
| `js/config.js` | **Sozlamalar**: backend manzili va sinov rejimi (`DEMO`) |
| `js/umumiy.js` | Yordamchilar: sanalar, xabarlar, oyna ochish, varaqlash animatsiyasi |
| `js/api.js` | Server bilan aloqa: `api("/manzil")`, token saqlash |
| `js/animatsiya.js` | Bosh oyna: motivatsiya so'zlari va kitob tushadigan animatsiya |
| `js/kirish.js` | Kirish: login va parol, rolga qarab oynani ochish, chiqish |
| `js/oquvchi.js` | O'quvchi kabineti |
| `js/kutubxonachi.js` | Kutubxonachi paneli, kitob berish, yangi kitob, yangi o'quvchi |
| `js/royxat.js` | Ko'rsatkich bosilganda ochiladigan ro'yxat oynasi |
| `js/buyurtma.js` | Kitob buyurtmalari: kutubxonachi → direktor → nazorat |
| `js/direktor.js` | Direktor paneli va sovg'a jadvali |
| `js/nazorat.js` | Nazorat organi paneli |

Skriptlar `index.html` oxirida shu tartibda ulanadi; `kirish.js` eng oxirida, chunki boshqalardagi funksiyalarni ishlatadi.

## Frontendni alohida ochish (ixtiyoriy)

VS Code'ning **Live Server** kengaytmasi bilan `frontend/index.html` ni ochsangiz (5500-port), sayt avtomatik
`http://localhost:3000` dagi backendga ulanadi. Backend `.env` faylida `FRONTEND_URL="http://localhost:5500"` bo'lishi kerak.

## Haqiqiy maktabda ishga tushirishdan oldin

- [ ] `frontend/js/config.js` da `DEMO: false` qiling (sinov parollari ko'rinmasin)
- [ ] Bazani O'zbekistondagi serverga ko'chiring (Supabase faqat sinov uchun)
- [ ] HTTPS va kunlik zaxira nusxani sozlang
- [ ] `npm run db:seed` ni haqiqiy bazada ISHLATMANG: u hamma ma'lumotni o'chiradi
