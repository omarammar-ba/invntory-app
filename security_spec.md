# Production Security Notes — Firebase Spark

## مبادئ الحماية
- لا يوجد Demo login أو تبديل وهمي بين مدير وموظف.
- بيانات الدخول محفوظة في Firebase Authentication فقط؛ كلمات المرور لا تحفظ في Firestore.
- كل مستخدم يحتاج وثيقة `staff/{uid}` فعالة حتى يستطيع الوصول للمخزون.
- `admin` يدير الأقسام والموظفين والنسخ الاحتياطي.
- `employee` يصل فقط للأقسام التي `visibleToEmployees == true`.
- الحساب الذي `status == inactive` لا يملك صلاحية قراءة أو كتابة المخزون حتى لو ظل حساب Authentication موجودًا.
- المدير الرئيسي `isPrimaryAdmin == true` لا يمكن تعطيله عبر التطبيق أو Firestore Rules.
- حقول `createdBy*` لا يمكن تغييرها أثناء تعديل الصنف. `updatedBy*` لا تنشأ إلا عند تعديل/حجز فعلي، وترتبط بالـUID والاسم الفعلي في وثيقة الموظف وبوقت الخادم.
- السجل الجديد مربوط بالـUID والاسم و`request.time` ولا يمكن تعديله أو حذفه من العميل.
- `tiles` و`ceramics` لا يمكن حذف metadata أقسامهما.
- الاسترجاع الاحتياطي Merge Only: لا يستبدل وثيقة موجودة بنفس الـID.

## Firebase Web Config
قيم `VITE_FIREBASE_*` وبيانات تحديد البريد الرئيسي توضع في `.env`، والملف ممنوع من Git عبر `.gitignore`.

هذه القيم ليست بديلًا عن Firestore Rules. أي Secret حقيقي مثل Service Account أو Private Key يجب ألا يدخل مشروع الواجهة نهائيًا.

## حدود Spark بدون Admin SDK
إنشاء الموظف يتم بحساب Firebase Auth ثانوي ثم إنشاء وثيقة staff من جلسة المدير الأصلية. عند فشل إنشاء وثيقة staff يحاول التطبيق حذف حساب Auth الجديد كـrollback.

تعطيل الموظف لا يغيّر خاصية `disabled` داخل Firebase Authentication لأن ذلك يحتاج Admin SDK، لكنه يمنع الوصول فعليًا عبر `staff.status` + Firestore Rules + فحص التطبيق عند تسجيل الدخول.
