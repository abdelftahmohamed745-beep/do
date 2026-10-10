# تطبيق دوري (Dawry) - نظام إدارة وحجز وتتبع أدوار العيادات الطبية

نظام متكامل، إلكتروني وآمن لإدارة طوابير الانتظار وتتبع أرقام الحجز في العيادات والمراكز الطبية لحظياً بمرونة وسلاسة.

---

## 🌟 مميزات المشروع الرئيسية

- **تتبع حي ولحظي (Real-time Firestore Sync):** تحديث أرقام الدور والانتظار فورياً لجميع المرضى والأطباء بدون الحاجة لتحديث الصفحة.
- **فصل كامل لبيانات العيادات (Multi-Clinic Isolation):** كل عيادة وطبيب لديهم طابور وحسابات ومسار حجز مستقل بالكامل (`/queues/{doctorId}/patients`).
- **نظام إشعارات اقتراب الدور (FCM & Web Push):** إرسال تنبيهات مباشرة للمريض قبل دوره بدورين أو دور واحد أو قبل الموعد بـ 10 دقائق.
- **خيارات إلغاء الحجز وتغيير الموعد:** تمكين المريض من متابعة التذكرة أو إلغائها مع التحديث التلقائي لطابور الانتظار.
- **تأكيد الهوية بـ Firebase Auth:** تسجيل دخول وإدارة صلاحيات الأطباء والمشرفين بـ Firebase Authentication وحماية البيانات بقواعد `firestore.rules`.
- **زر الرجوع الذكي (Dynamic Back Navigation):** للرجوع خطوة واحدة للخلف في سجل التصفح الداخلي بدون فقدان حالة التطبيق.
- **خادم Express + Vite مدمج:** لتشغيل واجهة سريعة واستدعاء الخدمات الأمنية الحساسة كحذف الحسابات وتخصيص صلاحيات الإدارة عبر API خادمي محمي.

---

## 📁 هيكلية المشروع (Directory Structure)

```text
├── src/
│   ├── components/            # مكونات الواجهة البرمجية (React Components)
│   │   ├── AdminDashboard.tsx           # لوحة تحكم مشرف المنصة
│   │   ├── AuthPage.tsx                 # تسجيل دخول وإنشاء حسابات الأطباء
│   │   ├── ClinicDashboard.tsx          # لوحة إدارة العيادة والدور اليومي للطبيب
│   │   ├── ClinicProfilePage.tsx        # صفحة العيادة العامة والتفاصيل
│   │   ├── DoctorsDirectory.tsx         # دليل العيادات والأطباء للزوار
│   │   ├── FloatingWhatsApp.tsx         # زر التواصل والدعم الفني
│   │   ├── Navbar.tsx                   # شريط التنقل العلوي والإشعارات
│   │   ├── NotificationSettingsModal.tsx# نافذة تخصيص إشعارات قرب الدور
│   │   ├── PatientBooking.tsx           # نموذج حجز دور جديد
│   │   ├── PatientTicket.tsx            # تذكرة الحجز وتتبع الدور اللحظي
│   │   ├── QRModal.tsx                  # كود QR الخاص برابط حجز العيادة
│   │   ├── QRScannerModal.tsx           # ماسح كود QR
│   │   ├── SettingsModal.tsx            # إعدادات حساب الطبيب والبيانات
│   │   ├── SubscriptionPage.tsx         # إدارة باقات واشتراكات العيادات
│   │   └── Toast.tsx                    # التنبيهات المنبثقة
│   │
│   ├── firebase/
│   │   └── config.ts                    # تهيئة Firebase App & Firestore Client
│   │
│   ├── services/
│   │   ├── firebaseService.ts           # جميع عمليات Firestore وAuth والاستعلامات
│   │   ├── fcmService.ts                # إدارة إشعارات FCM والتنبيهات المباشرة
│   │   └── cloudFunctionsTemplate.ts    # قالب دوال Firebase Cloud Functions
│   │
│   ├── types.ts                         # واجهات ومخططات TypeScript الموحدة
│   ├── App.tsx                          # المكون الرئيسي للمشروع وإدارة التنقل
│   ├── main.tsx                         # نقطة الانطلاق لتطبيق React
│   └── index.css                        # تنسيقات Tailwind CSS الشاملة
│
├── public/
│   ├── firebase-messaging-sw.js         # Service Worker الخاص بإشعارات Web Push
│   └── favicon.ico                      # أيقونة الموقع
│
├── server.ts                            # خادم Express لتنفيذ العمليات الأمنية وخدمة Vite
├── firestore.rules                      # قواعد أمان وخصوصية قاعدة البيانات Firestore
├── metadata.json                        # معلومات التطبيق وصلاحيات الإطار
├── package.json                         # المكتبات والاعتماديات وأوامر التشغيل
├── tsconfig.json                        # إعدادات TypeScript
├── vite.config.ts                       # إعدادات بناء مشروع Vite
└── .env.example                         # نموذج المتغيرات البيئية
```

---

## 🛠️ أوامر التثبيت والتشغيل المحلي (Setup & Run Commands)

### 1. تثبيت الحزم والاعتماديات
```bash
npm install
```

### 2. تشغيل بيئة التطوير (Development Mode)
```bash
npm run dev
```
سيعمل التطبيق على الرابط المحلي: `http://localhost:3000`

### 3. بناء وتجهيز المشروع للإنتاج (Production Build)
```bash
npm run build
```

### 4. تشغيل خادم الإنتاج (Start Production Server)
```bash
npm start
```

---

## 🔒 قواعد أمان Firestore (Firestore Security Rules)

يتم نشر قواعد الأمان في ملف `firestore.rules` لضمان حماية بيانات المرضى والأطباء ومنع التلاعب:

```playground
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() && request.auth.token.admin == true;
    }

    // Doctors collection
    match /doctors/{doctorId} {
      allow read: if true; // القراءة متاح للجمهور لجميع العيادات النشطة
      allow create: if isOwner(doctorId) || isAdmin();
      allow update: if isOwner(doctorId) || isAdmin();
      allow delete: if isAdmin();
    }

    // Queues and Patients subcollection (حجز وتتبع الأدوار)
    match /queues/{doctorId}/patients/{patientId} {
      allow read: if true; // متابعة رقم الدور لحظياً
      allow create: if request.resource.data.name is string 
        && request.resource.data.phone is string
        && request.resource.data.sequenceNumber > 0
        && request.resource.data.status == 'waiting';
      allow update: if isOwner(doctorId) 
        || isAdmin() 
        || (resource.data.phone == request.resource.data.phone && request.resource.data.status == 'cancelled');
      allow delete: if isOwner(doctorId) || isAdmin();
    }

    // User FCM Tokens & Settings
    match /users/{userId}/fcmTokens/{tokenId} {
      allow read, write: if isOwner(userId) || isAdmin();
    }
    match /users/{userId}/settings/notifications {
      allow read, write: if isOwner(userId) || isAdmin();
    }
    match /users/{userId}/notifications/{notificationId} {
      allow read, update, delete: if isOwner(userId) || isAdmin();
      allow create: if isAuthenticated() || isAdmin();
    }

    // Audit Logs
    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow create: if true;
      allow update, delete: if false;
    }
  }
}
```

---

## 📦 كيفية تصدير وحفظ كود المشروع كاملاً (ZIP / GitHub)

يمكنك تحميل كافة ملفات المصدر للمشروع في أي وقت من خلال واجهة **Google AI Studio**:

1. اضغط على قائمة **Settings** (أو أيقونة التعديل والإعدادات) في أعلى الزاوية.
2. اختر **Export Project (ZIP)** لتنزيل كود المشروع كاملاً بمجلداته الأصلية، أو اختر **Push to GitHub** لرفعه مباشرة على حسابك في GitHub.
