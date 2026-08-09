# GeoCalc + GeoAI

GeoCalc — WGS84 koordinatalari bo‘yicha yer maydoni, koordinata formatlari va TIN asosidagi Cut & Fill hajmini hisoblash uchun veb-ilova. GeoAI esa sayt ichidagi universal AI yordamchi: umumiy savollar, matematika, dasturlash, tarjima, matn, rasm/fayl tahlili va geodeziya savollariga javob beradi.

## GeoAI qanday ishlaydi

GeoAI server orqali Gemini Developer API bilan ishlaydi. API kalit brauzerga chiqmaydi.

- Oddiy va murakkab savollar: bepul Gemini Flash/Flash-Lite modellaridan avtomatik tanlash va fallback.
- Dolzarb savollar (bugun, hozir, yangilik, narx, ob-havo, current/latest va h.k.): Gemini 2.5 Flash orqali bepul Google Search grounding.
- Search limiti tugasa: GeoAI butunlay to‘xtamaydi, oddiy modelga fallback qiladi va javob real vaqtda tekshirilmaganini aytadi.
- Geodezik hisoblar: GeoCalc’ning mavjud maydon, perimetr, DMS va Cut & Fill funksiyalarini function calling orqali chaqiradi.
- Murakkab hisob va tekshiruv: Gemini code execution vositasidan foydalanishi mumkin.
- Rasm: JPG/PNG/WebP inline multimodal input sifatida Gemini’ga yuboriladi.
- KML/CSV/DXF/TXT/XYZ: matn sifatida tahlil qilinadi.

## Vercel’da faqat bitta ENV kerak

Google AI Studio’dan Gemini API key oling. So‘ng:

**Vercel → GeoCalc project → Settings → Environment Variables → Add New**

```env
GEMINI_API_KEY=BU_YERGA_GEMINI_API_KEY
```

Environment sifatida **Production**, **Preview** va **Development** ni belgilang. Keyin **Redeploy** qiling.

Muhim:

- `NEXT_PUBLIC_GEMINI_API_KEY` ishlatmang.
- API key’ni source code ichiga yozmang.
- Eski `GEMINI_MODEL` va `GEMINI_API_URL` ENV’lari endi kerak emas; xohlasangiz Vercel’dan o‘chirib tashlang. Kod ularni ishlatmaydi.

## Google orqali kirish

Loyiha Firebase project `geocalc-64d8b` bilan ulangan.

1. Firebase Console → Authentication → Sign-in method → Google yoqilgan bo‘lsin.
2. Authentication → Settings → Authorized domains ichida `geocalc.uz` va Vercel domeni bo‘lsin.
3. GeoAI POST endpoint Firebase ID tokenni tekshiradi; login qilmagan foydalanuvchi AI’dan foydalana olmaydi.

## Deployment

```bash
npm ci
npm run build:vercel
```

Vercel `vercel.json` orqali `npm run build:vercel` ishlatadi.

Deploydan keyin:

- `https://geocalc.uz/api/geoai` — konfiguratsiya holatini ko‘rsatadi; bu endpoint Gemini generation qilmaydi.
- Haqiqiy AI tekshiruvi uchun saytga Google orqali kirib GeoAI chatida `Salom, o‘zingni tanishtir` deb yuboring.

## GeoCalc matematik logikasi

GeoCalc’ning mavjud geodezik hisoblash algoritmlari o‘zgartirilmagan:

- WGS84 → UTM proyeksiya va Shoelace maydon hisobi.
- Metric perimeter.
- O‘nli koordinata ↔ GMS.
- Delaunay TIN asosidagi Cut & Fill integratsiyasi.

Qurilish, kadastr yoki huquqiy qaror oldidan natijani professional geodezist bilan tekshirish tavsiya etiladi.
