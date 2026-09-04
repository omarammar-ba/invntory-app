# نظام إدارة المخزون — نسخة الإنتاج (Spark)

هذه النسخة مجهزة للعمل على Firebase **Spark** بدون Cloud Functions، وتحافظ على بنية البيانات القديمة (`tiles`, `ceramics`, `logs`) بدون أي ترحيل جماعي أو حذف تلقائي.

## 1) إعداد `.env`
انسخ `.env.example` إلى `.env` وضع Firebase Web Config من:
Firebase Console → Project Settings → Your apps → Web app.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_PRIMARY_ADMIN_EMAIL=
VITE_PRIMARY_ADMIN_NAME=عمر
```

ملف `.env` موجود في `.gitignore` ولن يرفع إلى GitHub.

> ملاحظة: Firebase Web Config ليس Service Account ولا Private Key. لا تضع Service Account JSON أو `private_key` داخل هذا المشروع.

## 2) أول تشغيل فقط — إنشاء المدير الرئيسي بأمان
قاعدة البيانات الحالية لديك تستخدم القاعدة القديمة:
`allow read, write: if request.auth != null;`

قبل نشر `firestore.rules` الجديدة:
1. املأ `.env` بالبريد الحالي الموجود في Firebase Authentication داخل `VITE_PRIMARY_ADMIN_EMAIL`.
2. شغّل التطبيق محليًا وسجّل الدخول بنفس الحساب الحالي.
3. التطبيق سينشئ فقط `staff/{UID}` للمدير باسم **عمر**، ويضيف metadata الأقسام المفقودة (`tiles`, `ceramics`, `shower_box`).
4. لا يتم تعديل أو حذف أي وثيقة داخل `tiles` أو `ceramics` أو `logs`.
5. بعد نجاح الدخول وظهور البيانات، انشر `firestore.rules` الجديدة.

بعد هذه الخطوة لا يحتاج bootstrap مرة ثانية.

## 3) الموظفون بدون Blaze / Functions
المدير ينشئ الموظف من شاشة الموظفين. التطبيق يستخدم Firebase App ثانوي مؤقت لإنشاء حساب Authentication حتى لا يتم تسجيل خروج المدير.

تعطيل الموظف على Spark يتم عبر `staff.status = inactive`. حساب Authentication يبقى موجودًا، لكن التطبيق وFirestore Rules يمنعان الحساب المعطل من الوصول للمخزون بالكامل.

## 4) التتبع
الأصناف الجديدة تحفظ هوية وتاريخ الإضافة:
- `createdAt`, `createdBy`, `createdByUid`

ولا يتم إنشاء `updatedAt` إلا عند أول تعديل أو تحديث حجوزات فعلي، لذلك الصنف الذي لم يُعدّل يظهر له `آخر تحديث: غير معروف`. الأصناف القديمة كذلك لا يتم تعديلها تلقائيًا.

## 5) الأيقونة / التثبيت
التطبيق PWA ويعمل Standalone على الكمبيوتر وAndroid وiPhone. عند تجهيز الشعار استبدل الملفات فقط بنفس الأسماء:
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/maskable-512.png`
- `public/icons/apple-touch-icon.png`

## 6) أوامر المشروع
```bash
npm install
npm run lint
npm run build
npm run dev
```

ولا تستخدم `npm ci` قبل إنشاء `package-lock.json` جديد بواسطة `npm install`، لأن lock القديم من المشروع الأصلي كان غير متطابق مع `package.json` وتم حذفه عمدًا.
