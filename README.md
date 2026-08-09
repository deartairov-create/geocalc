# GeoCalc

GeoCalc — WGS84 koordinatalari bo‘yicha yer maydoni, koordinata formatlari va TIN asosidagi Cut & Fill hajmini hisoblash uchun modern veb-ilova. GeoAI geodeziya savollari, KML/CSV/DXF matn fayllari va rasmdagi koordinatalarni tahlil qilishga yordam beradi.

## Asosiy imkoniyatlar

- Asl GeoCalc maydon formulalari va UTM zona tanlovi o‘zgartirilmagan.
- O‘nli gradus ↔ GMS konvertori asl formulalar bilan ishlaydi.
- Delaunay TIN, chiziqli balandlik interpolatsiyasi va nol konturi bo‘yicha alohida Cut/Fill integratsiyasi.
- Firebase orqali majburiy Google kirish va har bir foydalanuvchi uchun alohida lokal tarix.
- KML, CSV, DXF, XYZ va rasmlar uchun GeoAI chat; Google Search, kod orqali hisoblash va GeoCalc funksiyalari.
- Server tomondagi Gemini API proksi; maxfiy kalit brauzerga yuborilmaydi.
- Responsiv dizayn, tungi/yorug‘ rejim va mahalliy hisoblash tarixi.

## Mahalliy ishga tushirish

Talab: Node.js 22.13 yoki yangiroq.

```bash
npm ci
cp .env.example .env.local
npm run dev:vercel
```

`.env.local` ichiga yangi Gemini auth key kiriting:

```env
GEMINI_API_KEY=your_new_key
GEMINI_MODEL=gemini-3.6-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/interactions
```

API kalitiga hech qachon `NEXT_PUBLIC_` prefiksini bermang va `.env.local` faylini Git'ga qo‘shmang. `gemini-1.5-flash` 2025-09-29 dan beri o‘chirilgan; eski environment qiymati qolib ketgan bo‘lsa, GeoAI uni avtomatik `gemini-3.6-flash` ga almashtiradi.

## Google orqali kirish

Loyiha avvalgi GeoCalc Firebase loyihasiga (`geocalc-64d8b`) ulangan. Firebase Console ichida:

1. **Authentication → Sign-in method → Google** provayderini yoqing.
2. **Authentication → Settings → Authorized domains** bo‘limiga `geocalc.uz`, Vercel domeni va foydalaniladigan boshqa ishlab chiqarish domenlarini qo‘shing.
3. Firebase web konfiguratsiyasi ommaviy identifikator hisoblanadi; haqiqiy maxfiy Gemini kaliti esa faqat server muhitida qoladi.

GeoAI API har bir so‘rovdagi Firebase ID tokenni serverda tekshiradi. Google orqali kirmagan foydalanuvchi GeoAI endpointdan foydalana olmaydi.

## Vercel deployment

1. Loyihani GitHub repozitoriyasiga yuklang.
2. Vercel'da **Add New → Project** orqali repozitoriyni tanlang.
3. Framework preset avtomatik `Next.js` bo‘ladi; `vercel.json` build buyruğini sozlaydi.
4. **Settings → Environment Variables** ichida `GEMINI_API_KEY` ni Production, Preview va Development uchun kiriting. `GEMINI_MODEL` uchun `gemini-3.6-flash` tavsiya etiladi.
5. Kerak bo‘lsa `GEMINI_MODEL` va `GEMINI_API_URL` ni ham `.env.example` dagi qiymatlar bilan qo‘shing.
6. Deploy tugmasini bosing va `geocalc.uz` domenini loyiha domenlariga ulang.
7. Yangi Vercel domenini Firebase **Authorized domains** ro‘yxatiga ham qo‘shing.

## Tekshiruv

```bash
npm run build:vercel
npm run lint
```

GeoAI endpointda vaqtinchalik tezlik cheklovi, so‘rov hajmi nazorati va server-only API kalit ishlatilgan. `GET /api/geoai` orqali server konfiguratsiyasi tayyorligini tekshirish mumkin; bu endpoint API kalitini oshkor qilmaydi. Ishlab chiqarishda Gemini billing/usage alertlarini ham yoqish tavsiya etiladi.

## Hisoblash metodlari

### Maydon

Asl koddagi yo‘l saqlangan: WGS84 nuqtalari o‘rtacha uzunlik bo‘yicha UTM 41/42/43 zonaga proyeksiya qilinadi, so‘ng Shoelace formulasi bilan m² hisoblanadi.

### Hajm

Nuqtalar Delaunay TIN ga bo‘linadi. Har uchburchakda `loyiha Z − mavjud Z` chiziqli interpolatsiya qilinadi. Belgisi o‘zgaradigan uchburchak nol konturi bo‘yicha kesiladi; musbat va manfiy qismlar alohida integratsiya qilinadi.

Muhim: qurilish, kadastr yoki huquqiy qaror oldidan natijani sertifikatlangan geodezist bilan tekshiring.
