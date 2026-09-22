# CONTRIBUTING — AREP

## 1. اصول کلی (بند 68, 92)

- قبل از هر تغییر بزرگ: Inspect → Analyze → Identify modules → Plan → Ask approval → Implement → Test → Review → Document → Commit → Update CURRENT_STATE.md
- Business Logic فقط در Service Layer, نه در API, نه در Frontend
- `organization_id` هرگز از ورودی کاربر خوانده نمی‌شود؛ فقط از Request Context
- هیچ Secret وارد Git نمی‌شود
- هر Feature باید Test داشته باشد
- خطا را با حذف قابلیت حل نکن

## 2. Branching (بند 71)

- `main` همیشه قابل بازیابی و قابل Deploy
- برای Featureهای بزرگ: `feature/<name>` از `main`
- برای Fix: `fix/<name>`
- این Session: `arena/01a0c452-alibaba-real-estate-platform` — تمام کار روی همین Branch
- قبل از Merge: Tests پاس, CURRENT_STATE.md Update, CHANGELOG.md Update

## 3. Commit Convention (بند 70)

فرمت: `type(scope): message`

Types:
- `feat`: Feature جدید
- `fix`: Bug fix
- `refactor`: Refactor بدون تغییر رفتار
- `docs`: Documentation
- `chore`: Tooling, scripts
- `test`: Tests
- `perf`: Performance
- `security`: Security fix

Examples:
```
feat(properties): add property registration with code generator
fix(crm): prevent duplicate customer by phone per org
feat(auth): validate telegram init data with HMAC
refactor(db): improve tenant isolation in repository
docs(architecture): add property domain design
chore(scripts): add termux start script
test(properties): add tenant isolation tests
```

- Commitها معنی‌دار و کوچک
- هر Commit یک منطق

## 4. Testing (بند 69)

سطوح:
- Unit (Service logic)
- Repository (DB queries با Tenant filter)
- API (endpoint + auth + permission)
- Integration (چند Domain)
- E2E (آینده)

قوانین:
- هر Feature مهم باید Test داشته باشد
- تست‌های سنگین فقط وقتی ارزش واقعی دارند
- `bash scripts/test.sh` باید پاس باشد قبل از Commit مهم
- Test DB: SQLite isolated `test_arep.db` — هیچ وابستگی خارجی

اجرای تست:
```bash
cd backend
pytest -v
# یا
bash ../scripts/test.sh
```

## 5. Database & Migrations (بند 21)

- ORM: SQLAlchemy 2 async
- هر تغییر Schema → Migration
```bash
cd backend
alembic revision --autogenerate -m "add properties table"
alembic upgrade head
```
- Migration باید upgrade و downgrade هر دو کار کند (تست roundtrip)
- دستی DB را تغییر نده
- قبل از Migration خطرناک: Backup (`cp *.db *.db.bak`)

## 6. Code Style

**Backend (Python):**
- Python 3.12+
- FastAPI + SQLAlchemy 2
- Type hints الزامی
- Pydantic v2 برای Schemas
- Async everywhere برای DB
- از `BigInt` برای PK/FK استفاده کن (SQLite compatible)

**Frontend (TS):**
- React + TypeScript strict
- Feature-Based: هر Feature در `features/<name>/` با api, components, hooks, types خودش
- Design System: از `shared/ui/` استفاده کن؛ Component تکراری نساز
- Forms: React Hook Form + Zod
- State: Zustand (سبک)

## 7. Security Checklist

قبل از هر PR:

- [ ] `organization_id` از Context نه از Body?
- [ ] Tenant دیگر → 404 نه 403?
- [ ] Public DTO جدا از Internal DTO? (آدرس دقیق, شماره مالک)
- [ ] Permission guard دارد? (`require_permission`)
- [ ] Optimistic Locking برای PATCH?
- [ ] Idempotency برای POST حساس?
- [ ] هیچ Secret در کد نیست?
- [ ] Error Handler اطلاعات خام DB را افشا نمی‌کند?

## 8. Documentation (بند 63,64)

هر تغییر مهم باید Docs را Update کند:

- `ARCHITECTURE.md` اگر معماری تغییر کرد
- `DATABASE.md` اگر جدول جدید
- `API_CONTRACT.md` اگر endpoint جدید
- `UI_UX.md` اگر Flow جدید
- `CURRENT_STATE.md` بعد از هر Sprint
- `CHANGELOG.md` برای هر Release
- `ADR` برای تصمیم معماری مهم → `docs/decisions/ADR-XXXX.md`

## 9. ADR (بند 64)

هر ADR شامل:

- **Context:** مسئله چیست؟
- **Decision:** چه تصمیمی گرفتیم؟
- **Alternatives:** چه گزینه‌های دیگری بود؟
- **Consequences:** چه عواقبی دارد؟

نام‌گذاری: `ADR-0009-title-with-dashes.md`

## 10. Local Development (بند 75)

**Termux (Android):**
```bash
cd ~/alibaba-real-estate-platform
bash scripts/termux_setup.sh   # یک‌بار
bash scripts/termux_start.sh   # هر بار
# http://127.0.0.1:8000/docs
```

**Linux/Mac:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev -- --host
```

**Tests:**
```bash
bash scripts/test.sh
```

## 11. Secrets (بند 73)

- `.env` در `.gitignore` است — هرگز کامیت نکن
- `.env.example` در ریپو — نمونه
- `ENV=production` → Guard فعال: JWT_SECRET باید set باشد, ALLOW_DEV_LOGIN=false, BOT_TOKEN set

## 12. Definition of Done (بند 95)

یک Feature زمانی Done است که:

- [ ] Code complete
- [ ] Tests pass
- [ ] Security checked (چک‌لیست بالا)
- [ ] Migration ready (اگر DB تغییر)
- [ ] Documentation updated
- [ ] UI usable (Mobile checked)
- [ ] API documented (در API_CONTRACT.md + OpenAPI)
- [ ] Git committed با پیام معنی‌دار
- [ ] CURRENT_STATE.md Update
- [ ] CHANGELOG.md Update

## 13. AI Handoff (بند 93,94)

قبل از پایان کار مهم:

1. تغییرات را Commit کن
2. Tests را اجرا کن
3. CURRENT_STATE را Update کن
4. CHANGELOG را Update کن
5. Migrationها را ثبت کن
6. کارهای باقی‌مانده را مستند کن

AI جدید باید بتواند فقط با Repository ادامه دهد (بند 65).

## 14. ارتباطات

- زبان اصلی: فارسی (Persian-first) برای UI و مستندات کاربر
- کد و کامیت: انگلیسی
- مستندات فنی: فارسی یا انگلیسی بسته به مخاطب — ترجیح فارسی برای Handoff داخلی
