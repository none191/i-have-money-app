# I Have Money

Mobile-first PWA สำหรับจดรายรับรายจ่ายเอง ใช้ง่าย เห็นสรุปรายวันในปฏิทิน พร้อมหน้า Login / สมัครสมาชิก / งบประมาณ / กราฟ / Backup

## Features ในเวอร์ชันนี้
- สมัครสมาชิก / เข้าสู่ระบบ / บัญชีทดลอง
- แยกข้อมูลตามบัญชีผู้ใช้ในเครื่อง
- บันทึกรายรับ / รายจ่าย
- เลือกวันที่ หมวดหมู่ จำนวนเงิน รายละเอียด
- แนบรูปใบเสร็จ 1 รูปต่อรายการ พร้อมบีบอัดรูปก่อนเก็บ
- ปฏิทินรายเดือน เห็นยอดสุทธิของแต่ละวัน
- สรุปรายวัน / สัปดาห์ / เดือน
- ตั้งงบประมาณรายหมวดต่อเดือน
- แสดงสถานะใช้งบ เช่น ปกติ / ใกล้เต็ม / เกินงบ
- กราฟรายรับ-รายจ่ายย้อนหลัง 6 เดือน
- สรุปรายจ่ายตามหมวดหมู่
- Export CSV
- สำรองข้อมูล / นำข้อมูลกลับ ด้วยไฟล์ JSON
- Google Login และ Google Drive Sync ผ่าน `drive.appdata`
- Dark mode
- PWA เปิดบนมือถือแล้ว Add to Home Screen ได้
- เก็บข้อมูลในเครื่องด้วย localStorage

## หมายเหตุสำคัญ
เวอร์ชันนี้เป็นต้นแบบที่รันได้ทันทีโดยไม่ต้องมี Server ข้อมูล Login, รายการเงิน, รูปใบเสร็จ และงบประมาณจะเก็บในเครื่องของผู้ใช้ก่อน

แนวทางปัจจุบันไม่ใช้ Supabase แล้ว ข้อมูลหลักยังอยู่ใน `localStorage` เพื่อใช้งาน offline และสามารถซิงก์/สำรองเป็นไฟล์ `i-have-money-backup.json` ใน Google Drive appDataFolder ของบัญชี Google ผู้ใช้

## Development / Testing
โปรเจกต์นี้ไม่มี build step (ไม่มี bundler) แต่มี unit test runtime แบบเบา ใช้ `node:test` ในตัว Node.js ไม่มี dependency ภายนอก

```bash
npm test          # รัน unit tests ทั้งหมด (tests/*.test.mjs) — เร็ว ไม่ต้องมี Docker/nginx
npm run test:smoke  # ตรวจ nginx -t + docker compose config เสมอ, ตรวจ container จริงถ้ามี Docker daemon
```

Logic ที่ไม่ผูกกับ DOM/localStorage (validation, migration, storage-error handling, service worker routing, CSV escaping) แยกไว้ที่ `lib/*.mjs` เพื่อให้ test ได้ตรง ๆ โดยไม่ต้องจำลอง browser — ดูรายละเอียดใน `PROJECT_MEMORY.md`

### รัน production ด้วย Docker
```bash
# local/generic (ไฟล์ base อย่างเดียว)
docker compose up -d

# NAS/production (base + override เฉพาะ NAS: pin nginx version, healthcheck, logging, no-new-privileges)
docker compose -f docker-compose.yml -f docker-compose.nas.yml up -d

# ตรวจค่าที่ merge แล้วก่อน apply จริง
docker compose -f docker-compose.yml -f docker-compose.nas.yml config
```

## วิธีเปิดใช้งาน
1. แตกไฟล์ ZIP
2. เปิด `index.html` ด้วยเบราว์เซอร์
3. หรือรัน local server เพื่อให้ PWA/offline ทำงานเต็มขึ้น

```bash
python3 -m http.server 8080
```

แล้วเปิด `http://localhost:8080`

## บัญชีทดลอง
กดปุ่ม “ทดลองใช้งานด้วยบัญชีตัวอย่าง” ในหน้า Login

## สิ่งที่ควรให้ Codex ทำต่อ
- ปรับปรุง Google Drive conflict resolution ให้เป็น UI modal แทน `prompt`
- แยกรูปใบเสร็จเป็นไฟล์ใน Google Drive แล้วให้ JSON เก็บ `fileId`
- เพิ่ม PIN / Face ID สำหรับมือถือ
- เพิ่มกราฟละเอียดรายวัน รายสัปดาห์ รายปี
- ทำ OCR อ่านใบเสร็จ

## เพิ่มใน v3
- เลือก Theme สีของแอปได้ 6 โทน: Money Green, Trust Blue, Premium Purple, Soft Rose, Warm Amber, Minimal Slate
- เลือก Light / Dark Mode จากหน้าตั้งค่า
- จำ Theme แยกตามบัญชีผู้ใช้
- Theme ถูกเก็บรวมในไฟล์ Backup JSON


## v4 Custom Categories
- พิมพ์หมวดรายรับ/รายจ่ายใหม่ได้จากหน้าเพิ่มรายการ
- ระบบบันทึกหมวดใหม่ไว้ใช้ครั้งถัดไปอัตโนมัติ
- ตั้งงบประมาณด้วยหมวดใหม่ที่พิมพ์เองได้
- มีหน้าจัดการหมวดในเมนูตั้งค่า: เพิ่ม / ลบหมวดที่สร้างเอง / ใส่ไอคอน Emoji
- Backup JSON จะรวมหมวดและไอคอนที่สร้างเองไว้ด้วย


## v4 Reviewed Fixes
- ปรับช่องหมวดจาก Dropdown ใหญ่บนมือถือ เป็นช่องพิมพ์พร้อม Datalist และปุ่ม Chip เลือกเร็ว
- เพิ่มการตรวจไฟล์ใบเสร็จ เฉพาะรูปภาพ และจำกัดขนาด 8 MB
- เพิ่ม fallback สำหรับกราฟในบางเบราว์เซอร์ที่ไม่มี `canvas.roundRect`
- ปรับรหัสผ่านจาก plain text เป็น hash ในเครื่องสำหรับบัญชีใหม่ พร้อม migrate บัญชีเก่าเมื่อ login
- อัปเดต service worker cache name และเพิ่ม skipWaiting/clients.claim
- Reset ค่าเลือกไฟล์หลัง Restore เพื่อเลือกไฟล์เดิมซ้ำได้
- เพิ่ม fallback ID เมื่อ browser ไม่มี `crypto.randomUUID()`

หมายเหตุ: Google Drive Sync ใช้ browser Google Identity Services และ Drive API โดยยังมี `localStorage` เป็น fallback/offline

## v4.1 — รอบตรวจสอบล่าสุด (Bug fixes & UX)

**Bug ที่แก้**
- **ไอคอนหมวดถูกเขียนทับโดยไม่ตั้งใจ**: เดิมทุกครั้งที่พิมพ์ชื่อหมวดเดิมซ้ำตอนเพิ่มรายการ/ตั้งงบ ระบบจะรีเซ็ตไอคอนของหมวดนั้นกลับเป็นค่าเริ่มต้น (📝 หรือ 🎯) ทำให้ไอคอนที่ตั้งเองหายไปเรื่อย ๆ ตอนนี้ระบบจะเขียนทับไอคอนเฉพาะตอนสร้างหมวดใหม่จริง ๆ หรือแก้ไขหมวดผ่านหน้าจัดการหมวดเท่านั้น
- **ไอคอนหมวดข้ามบัญชีผู้ใช้**: เดิมถ้าออกจากระบบแล้วเข้าใช้บัญชีอื่นในเครื่องเดียวกัน ไอคอนหมวดที่ตั้งเองของบัญชีก่อนหน้ายังค้างอยู่ในหน่วยความจำ (ไม่ล้างค่า) ตอนนี้ระบบจะล้างและสร้าง iconMap ใหม่ทุกครั้งที่ Login หรือ Restore ข้อมูล
- **Backup มี password hash ติดไปด้วย**: ไฟล์ Backup JSON เดิมแนบ passwordHash ของผู้ใช้ไปด้วย ซึ่งไม่ควรอยู่ในไฟล์ที่อาจแชร์ต่อ ตอนนี้ Backup จะเก็บเฉพาะชื่อ/อีเมล/วันที่สมัคร
- **Restore ไม่ดึงค่า Sync Settings กลับมา**: เดิม Restore JSON ไม่คืนค่าการตั้งค่า Sync mode ตอนนี้ Restore แล้วจะคืนค่าครบ
- **ลำดับตรวจสอบฟอร์มเพิ่มรายการ**: ปรับให้ตรวจวันที่ก่อนดึงค่าหมวด และหยุดบันทึกทันทีถ้าหมวดว่าง กันกรณี edge case ที่ validation ของ browser ถูกข้าม

**เพิ่มใหม่**
- หน้าจัดการหมวด (ตั้งค่า → จัดการหมวดรายรับ-รายจ่าย) เพิ่มปุ่ม **"แก้ไข"** ให้เปลี่ยนชื่อ/ไอคอนของหมวดที่สร้างเอง โดยจะปรับปรุงรายการที่บันทึกไว้แล้วและงบประมาณที่ผูกกับหมวดนั้นให้อัตโนมัติ

**UX มือถือ**
- ปรับระยะขอบล่างของหน้าจอและเมนูล่างให้เว้นพื้นที่ `safe-area-inset-bottom` เพื่อไม่ให้ชนแถบ Home Indicator บน iPhone รุ่นใหม่
- ช่องกรอกงบประมาณต่อเดือนเปลี่ยนเป็นคีย์บอร์ดตัวเลขบนมือถือ (`inputmode="decimal"`)

**PWA**
- เพิ่มไอคอนแอปแบบ PNG ขนาด 192x192 และ 512x512 พร้อมไอคอนแบบ maskable สำหรับ Android/Chrome
- เพิ่ม apple-touch-icon แบบ PNG 180x180 (ของเดิมใช้ SVG ซึ่ง iOS Safari รองรับไม่แน่นอน)
- เพิ่ม meta tag `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` ให้เปิดจากหน้าจอโฮมแล้วแสดงผลแบบเต็มจอ
- เพิ่ม `id`, `scope`, `lang`, `categories` ใน manifest.webmanifest ให้ครบตามมาตรฐาน PWA
- อัปเดต service worker cache name เป็น v4-reviewed-2 พร้อมไฟล์ไอคอนใหม่ทั้งหมด (แคชเก่าจะถูกลบอัตโนมัติตอนเปิดแอปครั้งถัดไป)

**ไฟล์ที่เปลี่ยนแปลง**
- `app.js` — แก้ bug ไอคอนหมวด/ข้ามบัญชี, Backup/Restore, validation ฟอร์ม, เพิ่มฟีเจอร์แก้ไขหมวด
- `index.html` — meta tag PWA, apple-touch-icon, inputmode ของช่องงบประมาณ
- `styles.css` — safe-area ของเมนูล่าง/หน้าจอ, สไตล์ปุ่มแก้ไขหมวด
- `manifest.webmanifest` — โครงสร้างไอคอน/ข้อมูล PWA ใหม่ทั้งหมด
- `service-worker.js` — cache name ใหม่ + ไฟล์ไอคอนที่เพิ่ม
- `icons/` (ใหม่) — icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
- `icons/icon-maskable-512.png` (ใหม่) — ไอคอน maskable สำหรับ Android/Chrome (ไฟล์ต้นฉบับ SVG ถูกลบออกใน Phase 2 cleanup เหลือเฉพาะ PNG ที่ generate แล้ว)

## v4.2 — Mobile Sync/Backup polish & hardening

**UX / Copy**
- เปลี่ยนหน้า “Sync / Backup” เป็น “ซิงก์และสำรองข้อมูล” พร้อมคำอธิบายสั้น ๆ ว่าข้อมูลยังเก็บในเครื่องและไฟล์ JSON ใช้ย้ายเครื่อง/กู้คืน
- เปลี่ยนปุ่ม **“Backup เป็น JSON”** เป็น **“สำรองข้อมูล”**
- เปลี่ยน **“Restore JSON”** เป็น **“นำข้อมูลกลับ”**
- เคยซ่อน provider credentials ไว้ใต้ **“ตั้งค่าขั้นสูง”**; แนวทางปัจจุบันใช้ `google.config.js` ภายนอกแทนการกรอกใน UI
- ปรับปุ่มสำรอง/นำข้อมูลกลับบนมือถือให้เป็นปุ่มเต็มแถวเมื่อหน้าจอแคบ และคง touch target อย่างน้อย 48px

**Bug / Security hardening**
- แก้ XSS edge case ในรายงานหมวด งบประมาณ และหน้าจัดการหมวด โดย escape ชื่อหมวด/ไอคอนที่มาจากผู้ใช้หรือไฟล์ restore ก่อน render
- กันชื่อหมวด/งบประมาณที่เป็น object key อันตราย เช่น `__proto__`, `prototype`, `constructor`
- Normalize budgets, category icons และ sync settings ตอน load/restore เพื่อกัน data shape เพี้ยนจาก localStorage หรือไฟล์สำรอง
- แก้ Backup timestamp ให้ payload ในไฟล์ JSON และ UI ใช้เวลาเดียวกัน
- เพิ่ม CSV formula-injection guard ตอน Export CSV
- เพิ่ม error path ให้การอ่าน/บีบอัดรูปใบเสร็จ ไม่ค้างเงียบเมื่อไฟล์รูปเสีย
- เพิ่ม favicon link เพื่อลด `/favicon.ico` 404
- แก้ service worker install ให้ bypass HTTP cache ด้วย `cache: "reload"` ตอน precache asset หลัง bump version

**สถานะ Backend**
- รอบนี้ยังเป็น mock/config UI; แนวทางปัจจุบันเปลี่ยนเป็น Google Drive appDataFolder เท่านั้น

## v4.3 — Responsive UX/UI pass

- ปรับ layout จาก mobile-only shell เป็น responsive shell ที่รองรับทั้งมือถือและ PC
- หน้าเพิ่มรายการแก้ overflow ของ `date`, `number`, `text`, `file`, segmented control, chips และปุ่มบันทึก ให้อยู่ใน card เสมอ
- หมวดหมู่แบบ chip เปลี่ยนจากเลื่อนแนวนอนเป็น wrap ลงบรรทัด เพื่อไม่มี horizontal overflow บนมือถือ
- เพิ่ม desktop grid ให้ Dashboard / Budget / Reports / Settings ใช้พื้นที่จอกว้างได้ดีขึ้น โดยยังคง navigation และฟีเจอร์เดิม
- เพิ่ม CSS guard เช่น `min-width: 0`, `max-width: 100%`, `overflow-x: hidden` และ versioned stylesheet URL เพื่อกัน PWA cache ส่ง CSS เก่า

## v4.4 — Cozy SVG menu icons

- เปลี่ยน Bottom Navigation จาก emoji เป็น SVG ใน `icons/menu/`
- เปลี่ยนปุ่มด้านบน Sync และ Dark Mode เป็น SVG icon
- เพิ่มไอคอน SVG ในปฏิทิน และปุ่มเลือกประเภทรายรับ/รายจ่าย
- เพิ่ม class `.nav-icon`, `.top-icon`, `.cozy-icon` เพื่อควบคุมขนาดไอคอนให้ไม่ล้นปุ่ม
- ปรับ active/hover ของ nav และ top buttons เป็นโทน minimal cozy: cream, beige, sage green, warm brown พร้อม shadow นุ่ม
- เพิ่ม SVG menu ทั้งหมดเข้า service worker precache และ version `styles.css` / `app.js` เพื่อกัน cache เก่าทับไอคอน

## v4.5 — Login brand logo

- เพิ่มโลโก้หน้า Auth (ต่อมาเปลี่ยนเป็น `icons/login/login-brand-transparent.png` ใน v4.7 และลบไฟล์เดิมออกใน Phase 2 cleanup)
- เปลี่ยน brand logo หน้า Login/Register เป็น `<img alt="I Have Money">`
- เพิ่ม `.brand-logo-img` และปรับขนาด logo ให้เหมาะกับ mobile/desktop โดยไม่ล้นกรอบ
- เพิ่มรูป logo เข้า service worker precache และ version stylesheet เพื่อกัน cache เก่า

## v4.6 — Google Login preparation

- เพิ่มปุ่ม **“เข้าสู่ระบบด้วย Google”** ใต้ปุ่มเข้าสู่ระบบเดิม และเหนือบัญชีทดลอง
- ปุ่ม Google Login จะ disabled ถ้ายังไม่มี config
- แนวทาง Supabase เดิมถูกยกเลิกใน v4.8

## v4.7 — Light cozy Auth palette

- แยกชุดสี Auth/Login/Register ให้เป็นโทนสว่าง cream / beige / sage green แม้เปิด app dark mode
- ปรับ `.auth-screen`, `.brand-card`, `.auth-card`, `.auth-tabs`, input, Google button และ demo button ให้อ่านง่ายขึ้น
- เปลี่ยนโลโก้หน้า Auth ไปใช้ `icons/login/login-brand-transparent.png` เพื่อแก้พื้น checkerboard/กล่องติดมากับไฟล์เดิม
- เพิ่มโลโก้โปร่งใสเข้า service worker precache และ version stylesheet เป็น `auth-light-1`
## v4.8 — Google Account + Google Drive appDataFolder

- ถอด Supabase ออกจาก flow หลักทั้งหมด และย้าย schema เดิมไป `docs/archive/supabase-schema.sql`
- เพิ่ม `google.config.example.js` และ ignore `google.config.js`
- Google Login ใช้ Google Identity Services และเก็บ profile พื้นฐาน: `email`, `name`, `picture`, `googleId`
- Google Drive Sync ใช้ scope `https://www.googleapis.com/auth/drive.appdata`
- Drive backup ใช้ไฟล์ `i-have-money-backup.json` ใน appDataFolder ของบัญชี Google ผู้ใช้
- Backup payload ใช้ `buildBackupPayload()` และ Restore ใช้ `restoreFromBackupPayload(payload)` ทั้ง JSON local และ Drive
- เมื่อ login Google และพบ backup บน Drive แอปจะถามก่อนว่าจะใช้ข้อมูลบนเครื่อง, ใช้ข้อมูลจาก Drive, หรือ merge
- ก่อน restore จะสร้าง local backup อัตโนมัติไว้ใน `localStorage`
- Receipt image ยังเก็บ base64 ใน JSON เหมือนเดิม ถ้า backup ใหญ่เกินจะแจ้ง TODO ให้แยกรูปเป็นไฟล์ Drive ภายหลัง
- Email/password login และ demo account เดิมยังใช้งานได้

### วิธีตั้งค่า Google Cloud

1. สร้าง OAuth Client ID แบบ Web application ใน Google Cloud Console
2. เพิ่ม `http://localhost:8080` ใน Authorized JavaScript origins
3. เปิด Google Drive API
4. คัดลอก `google.config.example.js` เป็น `google.config.js`
5. ใส่ `GOOGLE_CLIENT_ID`
6. เปิดแอปผ่าน local server แล้วกด “เข้าสู่ระบบด้วย Google”

## v5 — Minimal cozy app icons

- เปลี่ยน favicon/browser tab icon ไปใช้ `icons/favicon.svg?v=5`
- สร้าง PWA icon ชุดใหม่จากสไตล์ minimal cozy: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png`
- ตั้ง `manifest.webmanifest?v=5`, `theme_color` และ `background_color` เป็น `#faf7f1`
- อัปเดต service worker cache เป็น `i-have-money-v5-minimal-icons-2`

## Phase 1 — Restore safety & manifest fix

**Bug ที่แก้**
- `restoreJson()`: เพิ่ม `confirm()` เตือนผู้ใช้ก่อนเขียนทับข้อมูล พร้อมแจ้งว่าระบบจะสำรองข้อมูลปัจจุบันอัตโนมัติก่อน; ถ้ากด "ยกเลิก" จะไม่ restore เลยและไม่มี alert ใด ๆ
- `restoreFromBackupPayload()`: เพิ่มเช็ค email mismatch — ถ้าไฟล์ backup เป็นของบัญชีอื่น ระบบจะแจ้งชื่อบัญชีทั้งสองฝั่งและถามยืนยันก่อน; ถ้ากด "ยกเลิก" จะไม่แตะข้อมูลใด ๆ เลย; ฟังก์ชันเปลี่ยนจาก `void` เป็น `boolean` เพื่อให้ caller ทุกจุดรู้ว่า restore เกิดขึ้นจริงหรือไม่
- `syncFromGoogleDrive()` และ `resolveDriveConflict()`: ปรับให้เช็คค่า return จาก `restoreFromBackupPayload()` เพื่อไม่ให้ขึ้น "เรียบร้อย" หลอกตอนผู้ใช้ยกเลิกกลางทาง

**Manifest**
- `manifest.webmanifest`: เปลี่ยน `"id": "/"` → `"id": "./"` ให้ตรงกับ `scope`/`start_url` และใช้งานบน GitHub Pages project site ได้ถูกต้อง

**ไฟล์ที่เปลี่ยน**: `app.js`, `manifest.webmanifest`

## Phase 2 — Asset cleanup & service worker update

**ลบไฟล์ที่ไม่ได้ใช้งาน** (ตรวจ grep ทั้งโปรเจกต์ก่อนลบทุกไฟล์)
- `icon.svg` (root) — ถูกแทนที่โดย `icons/favicon.svg` ไม่มีที่ไหนอ้างอิงใน html/js/manifest
- `icon-maskable.svg` (root) — ไม่มีที่ไหนอ้างอิงใน html/js/manifest
- `icons/login/login-brand.png` — ไม่ถูกใช้งาน (แทนที่โดย `login-brand-transparent.png` ตั้งแต่ v4.7)
- `icons/menu/login-brand.png` — ซ้ำกับไฟล์ข้างต้น ไม่มีที่ไหนอ้างอิง

**บีบอัดรูป**
- `icons/login/login-brand-transparent.png`: 1105×1089 px / 1.23 MB → 360×355 px / 114 KB (ลด 90.9%) ยังคง RGBA transparent, คมพอสำหรับแสดงบนหน้า Login ทั้ง mobile/desktop

**Service worker**
- `CACHE_NAME` ใหม่: `i-have-money-v5-phase2-cleanup`
- เพิ่ม `?v=2` ใน URL ของโลโก้ (`login-brand-transparent.png?v=2`) เพื่อบังคับ browser โหลดไฟล์ที่ย่อแล้ว
- ตรวจ cache list ทั้งหมด: ทุก path ยังมีไฟล์จริงบนดิสก์ครบ (22 entries, ALL OK)
- ไม่มี `google.config.js` ใน cache list

**ไฟล์ที่เปลี่ยน**: `service-worker.js`, `index.html`, `icons/login/login-brand-transparent.png`
**ไฟล์ที่ลบ**: `icon.svg`, `icon-maskable.svg`, `icons/login/login-brand.png`, `icons/menu/login-brand.png`

## Safety & PWA Hardening Pass (branch: improve/safety-pwa-hardening)

รอบตรวจสอบและแก้ไขที่ครอบคลุม Backup/Restore, localStorage safety, Service Worker/PWA, nginx, Docker/NAS และ Tests/CI ตาม findings report (Critical/High/Medium/Low) — **ไม่แก้ระบบ Login, ไม่เพิ่ม Supabase/backend ใหม่, ไม่ deploy ไป NAS**

### Critical
- **Restore ปลอดภัยขึ้นทั้งหมด**: `restoreFromBackupPayload()` validate + normalize ข้อมูลทั้งไฟล์ใน memory ก่อนเสมอ (ผ่าน `lib/backupSchema.mjs`), ปฏิเสธทั้งไฟล์ถ้ามี transaction ใดผิด schema (ไม่ import บางส่วน), snapshot ทุก key ที่จะเขียนทับก่อนเขียนจริง แล้วคืนค่ากลับถ้าเขียนล้มเหลว (`lib/storageSafety.mjs`) — ระบุชัดเจนว่า localStorage ไม่มี transaction จริง จึงเป็น best-effort ไม่ใช่ atomic 100%
- **`localStorage.setItem` ทั้ง 26 จุดครอบด้วย `safeSetItem()`**: จับ `QuotaExceededError` (synchronous throw) แล้วแจ้งผู้ใช้ชัดเจนแทนที่จะปล่อยให้แอป crash กลางฟังก์ชัน

### High
- **Service Worker เขียนใหม่เป็น module worker**: import `lib/swPolicy.mjs` เพื่อ classify ทุก request ก่อนตัดสินใจ cache — cross-origin (Google API) ไม่ถูก intercept เลย, navigation ใช้ network-first + fallback index.html เฉพาะตอน offline จริง, static asset ใช้ stale-while-revalidate และ**ไม่คืน index.html ให้ image/script/API ที่ fail**
- **Backup schema validation ระดับ field**: ตรวจ type/amount/date/category ของทุก transaction, ตรวจ version พร้อม migration path (`BACKUP_SCHEMA_VERSION`), ป้องกัน prototype pollution ทุกชั้นของ JSON
- **nginx security headers**: เพิ่ม CSP (เริ่ม Report-Only), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy ผ่าน shared snippet (แก้ nginx gotcha: add_header ใน location บล็อกการ inherit จาก server level)
- **บล็อกไฟล์ที่ไม่ควร serve**: `.git/`, `README.md`, `PROJECT_MEMORY.md`, `docker-compose*.yml`, `docs/*.sql` ถูก deny แล้ว (เดิม mount ทั้ง repo เข้า nginx โดยไม่มีการกันเลย)

### Medium
- เพิ่ม UI "จุดคืนค่าอัตโนมัติ" ใน Settings — กู้คืนได้สูงสุด 5 จุดล่าสุด พร้อมข้อความอธิบายว่าไม่ใช่ off-device backup
- เพิ่ม update notification banner สำหรับ Service Worker เวอร์ชันใหม่ พร้อมปุ่ม "รีโหลดเพื่ออัปเดต"
- แยก `docker-compose.yml` (generic) กับ `docker-compose.nas.yml` (override เฉพาะ production: pin nginx version, healthcheck, logging rotation, no-new-privileges)
- `restoreJson()` ตรวจ file type และจำกัดขนาดไฟล์ 20 MB ก่อน parse

### Tests
- เพิ่ม `package.json` + `node --test` เป็น test runtime (ไม่มี dependency ภายนอก)
- 63 unit tests ครอบคลุม backup validation/migration, prototype pollution, storage quota handling, service worker routing, CSV formula-injection escaping
- `tests/nginx-docker-smoke.sh`: ตรวจ `nginx -t` และ `docker compose config` เสมอ, ตรวจ container จริงถ้ามี Docker daemon
- ทดสอบ end-to-end ด้วย headless Chromium จริง (ไม่ใช่แค่อ่านโค้ด): restore rollback ตอน quota เต็ม, prototype pollution neutralization, cross-account warning, offline navigation fallback, security headers ผ่าน curl

### ยังไม่ได้ทำ (ตั้งใจ, มีเหตุผลระบุไว้)
- CSP ยังเป็น Report-Only — ต้อง verify กับ Google Login/Drive จริงบน staging ก่อน flip เป็น enforcing (sandbox ตรวจไม่ได้เพราะไม่มี network เข้า Google)
- ไม่เพิ่ม `read_only`/non-root ให้ nginx container — ต้องทดสอบกับ UGOS ACL ก่อน (ดู comment ใน `docker-compose.nas.yml`)
- ไม่ migrate รูปใบเสร็จไป IndexedDB — ประเมินไว้ใน `docs/receipt-storage-assessment.md` แล้ว แต่เป็นงานแยกที่กระทบ backup/restore format
