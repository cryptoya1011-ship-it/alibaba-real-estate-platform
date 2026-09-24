# UI/UX — AREP

## 1. اصول کلی (بند 12)

- **Persian-first, RTL:** تمام UI راست‌به‌چپ, فونت فارسی (Vazirmatn یا مشابه), تاریخ شمسی (جلالی)
- **Mobile-first:** طراحی ابتدا برای موبایل, سپس Desktop
- **Touch-friendly:** حداقل 44px touch target, فاصله کافی
- **سریع, تمیز, مینیمال, حرفه‌ای, قابل فهم**

## 2. رنگ برند (بند 12) — پالت اجراشده در فاز ۱۶

پالت نهایی در `frontend/src/index.css` به‌صورت Design Token پیاده شده است
(جزئیات کامل: `docs/UI_REDESIGN_NOTES.md`):

- **Primary (Teal):** `#0d9488` — روشن / `#2dd4bf` — تیره → برند، CTA، آیتم فعال
- **Primary Soft:** `#ccfbf1` — روشن / `#134e4a` — تیره → چیپ، پس‌زمینه فعال
- **Gold (Accent):** `#b48d2d` — روشن / `#d6b25e` — تیره → قیمت، Badge، تأکید
- **Background:** `#f4f6f9` — روشن / `#070b12` — تیره
- **Surface (Card):** `#ffffff` — روشن / `#0f1622` — تیره
- **Border/Line:** `#e4e7ed` — روشن / `#232e3f` — تیره
- **Text:** `#111827` / `#e5eaf2` — ثانویه: `#6b7280` / `#8b96a8`

وضعیت‌ها: Success `#16a34a`/`#4ade80` — Warning `#d97706`/`#fbbf24` — Error `#dc2626`/`#f87171`.

> تم تیره و روشن هر دو پشتیبانی می‌شوند؛ انتخاب کاربر ذخیره و به `prefers-color-scheme` هم احترام گذاشته می‌شود.

## 3. Design System (بند 11)

### 3.1 Component List (الزامی از ابتدا)

- **Button:** Primary, Secondary, Ghost, Danger, با سایز sm/md/lg, loading state
- **Input:** Text, Number, Password, با label, error, helper, RTL
- **Select:** Single, Multi, Searchable
- **DatePicker:** شمسی, با تقویم فارسی
- **Modal:** برای Desktop
- **Drawer:** Side drawer برای Desktop
- **BottomSheet:** برای Mobile (جایگزین Modal)
- **Card:** Property Card, Customer Card
- **Badge:** Status (Draft, Published...), Type
- **Table:** با Pagination, Sort, EmptyState
- **Tabs:** برای Detail pages
- **Toast:** Success/Error/Info
- **Dialog:** Confirm Delete
- **EmptyState:** No data, با illustration + CTA
- **LoadingState:** Skeleton, Spinner
- **ErrorState:** با Retry

**قانون:** هیچ Feature نباید بدون دلیل Component اختصاصی مشابه موجود بسازد.

### 3.2 ساختار پیشنهادی

```
shared/ui/
├── Button/
│   ├── Button.tsx
│   ├── Button.module.css
│   └── index.ts
├── Input/
├── Modal/
├── BottomSheet/
└── ...
```

یا با Tailwind + cva (class-variance-authority) برای Variantها.

## 4. Mobile UX (بند 13)

**Mobile نباید Desktop کوچک‌شده باشد.**

- **Bottom Navigation:** 4-5 آیتم اصلی: خانه, جستجو, افزودن ملک, مشتریان, پروفایل
- **Bottom Sheet:** برای فیلترها, فرم‌ها, Detail کوتاه
- **Floating Action Button (FAB):** برای Add Property / Add Customer در صفحات لیست
- **Swipe:** Swipe to delete, swipe to archive
- **Large Touch Targets:** حداقل 44px
- **Pull to Refresh:** در لیست‌ها

**Desktop:**
- Sidebar + Content
- Header با Search + Notifications + Profile
- Table برای لیست‌ها

## 5. Dashboard (بند 14)

**Action-oriented, نه نمودارمحور**

**اولویت اول (بالای صفحه):**
- کارهای امروز (Today's Tasks)
- بازدیدهای امروز
- Follow-upها (پیگیری مشتریان)
- معاملات در جریان
- فایل‌های جدید

**اولویت دوم (پایین):**
- آمار کلی (تعداد ملک فعال, مشتری فعال...)
- نمودار ساده (اختیاری)
- گزارش کوتاه

**نباید با نمودارهای غیرضروری شلوغ شود.**

## 6. Property Flow (بند 98)

کاربر باید بدون آموزش طولانی بتواند:

```
ثبت ملک → جستجو → مشاهده → ثبت مشتری → ثبت درخواست → بازدید → پیگیری
```

### 6.1 ثبت ملک (Multi-step, Mobile-friendly)

Step 1: نوع ملک + نوع معامله
Step 2: مشخصات فیزیکی (متراژ, اتاق, طبقه...)
Step 3: موقعیت (شهر, محله, آدرس دقیق private)
Step 4: مالی (قیمت, رهن/اجاره, معاوضه)
Step 5: امکانات (چک‌باکس‌ها)
Step 6: تصاویر
Step 7: مالک / ثبت‌کننده (Owner vs Intermediary)

هر Step ذخیره موقت (Draft).

### 6.2 جستجو (بند 15)

**Structured Search (فاز اول):**
- نوع ملک (چند انتخابی)
- محدوده (شهر, محله)
- متراژ (min/max slider)
- قیمت (min/max)
- نوع معامله
- تعداد اتاق
- پارکینگ, آسانسور, انباری (toggle)

**Natural Language Search (آینده):**
- Input بزرگ: «آپارتمان ۱۵۰ متری مرداویج تا ۲۰ میلیارد, پارکینگ و آسانسور»
- AI Adapter تبدیل به Structured Query

**Saved Search + Favorites:** ذخیره جستجو → Notification برای ملک جدید Matching

### 6.3 نمایش ملک

- **Public View:** عکس, عنوان, محله (نه آدرس دقیق), متراژ, قیمت, امکانات, کد ملک, دکمه تماس با دفتر (نه شماره مالک)
- **Internal View:** + آدرس دقیق, شماره مالک, تاریخچه, یادداشت‌ها, Visitها

## 7. Public vs Internal (بند 60,61)

**Public Experience:**
- Search, View Listings, Favorites, Requests, Registration, Contact Office
- بدون نیاز به Login برای دیدن لیست (اختیاری)
- SEO friendly, Shareable

**Internal Experience:**
- CRM, Property Management, Customers, Visits, Deals, Reports, Users, Permissions
- نیاز به Login + Permission

**امنیت:** فقط مخفی کردن UI کافی نیست؛ Authorization باید Server-side باشد. Public DTO جدا.

## 8. Deep Links & Sharing (بند 62,81)

- هر ملک URL پایدار: `/p/AB-ISF-MJ-AP-S-2608-00124`
- Share: Telegram, WhatsApp, Copy Link
- اطلاعات Private هرگز در URL نباشد
- Open Graph: تصویر ملک + عنوان + قیمت برای Preview

## 9. PWA UX (بند 57)

- **Install Prompt:** دکمه نصب در Header یا Bottom
- **Splash Screen:** لوگو + رنگ برند
- **Offline Indicator:** بنر "شما آفلاین هستید" + Cached Data
- **Update Prompt:** "نسخه جدید موجود است — بروزرسانی"

## 10. Accessibility (بند 59)

- Keyboard-friendly: تمام interactiveها با Tab قابل دسترسی
- Screen-reader: aria-label فارسی
- Contrast: متن روی پس‌زمینه حداقل 4.5:1
- Touch: 44px minimum

## 11. Performance (بند 58,99)

- Lazy Loading برای تصاویر ملک
- Code Splitting per Route
- Virtualized List برای لیست‌های طولانی (1000+ ملک)
- Debounced Search (300ms)
- Image Optimization: WebP, thumbnail + full

## 12. نمونه Wireframe ذهنی (Mobile)

```
[Header: لوگو + Search + Notif]

[Bottom Navigation]
خانه | جستجو | + | مشتریان | من

[خانه]
- سلام علی, امروز 3 بازدید داری
- [کارت بازدید امروز]
- [کارت Follow-up]
- [آمار سریع]

[جستجو]
- [Input جستجوی متنی]
- [فیلترها: نوع, قیمت, متراژ...]
- [لیست کارت ملک]
- [FAB: ذخیره جستجو]

[ملک Detail]
- [گالری عکس swipeable]
- [عنوان + کد + قیمت]
- [مشخصات]
- [امکانات Badge]
- [دکمه‌ها: تماس دفتر, اشتراک, علاقه‌مندی]
- [BottomSheet برای اطلاعات بیشتر]
```

## 13. ابزار پیشنهادی

- **Styling:** Tailwind CSS + RTL plugin یا CSS Modules
- **Icons:** Lucide یا Heroicons
- **Date:** date-fns-jalali یا dayjs-jalali
- **State:** Zustand یا Jotai (سبک) — نه Redux سنگین فعلا
- **Form:** React Hook Form + Zod
- **PWA:** Vite PWA plugin
