// ================= SERVER BILAN ALOQA =================
// Hamma so'rovlar shu yerdan o'tadi: api("/kutubxonachi/xulosa") yoki api("/kirish", { method: "POST", body: {...} })

const Sessiya = {
  // "Meni eslab qol" belgilansa localStorage (brauzer yopilsa ham qoladi), aks holda sessionStorage
  ombor() {
    try { return localStorage.getItem("kutubxona_token") ? localStorage : sessionStorage; }
    catch { return null; }
  },
  oqi() {
    try {
      const o = this.ombor();
      return o ? { token: o.getItem("kutubxona_token"), rol: o.getItem("kutubxona_rol"), ism: o.getItem("kutubxona_ism") } : {};
    } catch { return {}; }
  },
  saqla({ token, rol, ism }, eslab) {
    try {
      this.tozala();
      const o = eslab ? localStorage : sessionStorage;
      o.setItem("kutubxona_token", token); o.setItem("kutubxona_rol", rol); o.setItem("kutubxona_ism", ism);
    } catch { /* xotira yopiq bo'lsa ham sayt ishlayveradi, faqat yangilanganda qayta kirish kerak */ }
    this.xotirada = { token, rol, ism };
  },
  tozala() {
    this.xotirada = null;
    try {
      for (const o of [localStorage, sessionStorage]) ["kutubxona_token", "kutubxona_rol", "kutubxona_ism"].forEach(k => o.removeItem(k));
    } catch {}
  },
  xotirada: null,
  get token() { return this.xotirada?.token || this.oqi().token || null; }
};

class ApiXato extends Error {
  constructor(matn, holat) { super(matn); this.holat = holat; }
}

async function api(yol, { method = "GET", body } = {}) {
  const sarlavha = { "Content-Type": "application/json" };
  if (Sessiya.token) sarlavha.Authorization = "Bearer " + Sessiya.token;

  let javob;
  yuklash(true);
  try {
    javob = await fetch(SOZLAMA.API_URL + "/api" + yol, {
      method, headers: sarlavha, body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiXato("Serverga ulanib bo'lmadi. Internet yoki server ishlayotganini tekshiring.", 0);
  } finally {
    yuklash(false);
  }

  let malumot = null;
  try { malumot = await javob.json(); } catch { /* javob JSON emas */ }

  // Token eskirgan bo'lsa: chiqib, kirish oynasiga qaytamiz
  if (javob.status === 401 && yol !== "/kirish") {
    tizimdanChiqish(true);
    throw new ApiXato("Sessiya tugadi. Qaytadan kiring.", 401);
  }
  if (!javob.ok) throw new ApiXato(malumot?.xato || `Serverda xato (${javob.status}).`, javob.status);
  return malumot;
}

// Xatoni foydalanuvchiga ko'rsatish (har bir catch'da ishlatiladi)
function xatoniKorsat(e) {
  if (e?.holat === 401) return;           // chiqish allaqachon qilindi
  console.error(e);
  toast(e?.message || "Kutilmagan xato yuz berdi.", true);
}
