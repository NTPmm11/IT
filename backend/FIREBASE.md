# Backend + Cloud Firestore

API ทุกเส้นใช้ Firestore project `cr-project-b10b1` แล้ว: login, systems, preview เลข CR, list/detail, สร้าง CR และอนุมัติ
`src/db.js` export Firestore client ส่วน MySQL ใช้เฉพาะสคริปต์นำเข้าข้อมูลเก่า
หน้าเว็บยังใช้ API contract เดิม รวมถึง ID แบบตัวเลขและรหัสผ่าน bcrypt เดิม

## Credentials และการเชื่อมต่อจริง

1. ลบคีย์ที่ส่งในแชต: Google Cloud Console → IAM & Admin → Service Accounts → เลือกบัญชี → Keys → ลบคีย์ที่เปิดเผย
2. เปิด Firestore Database ใน Firebase Console และสร้างฐานข้อมูล `(default)` หากยังไม่มี
3. ใช้ Application Default Credentials (ADC) หรือเก็บ service-account JSON **ใหม่** ไว้นอก repository
4. เพิ่มใน `backend/.env` โดยเปลี่ยน path ให้ตรงกับไฟล์จริง:

```dotenv
FIREBASE_PROJECT_ID=cr-project-b10b1
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/new-service-account.json
```

รันจากโฟลเดอร์ `backend`:

```sh
npm run check:firestore
```

คำสั่งนี้อ่าน `_connection_checks/backend` ไม่สร้างหรือแก้ไข document และ document ไม่จำเป็นต้องมีอยู่
ต้องมี credentials ที่ใช้ได้ ฐานข้อมูลที่สร้างไว้ และสิทธิ์ IAM อ่านเขียน Firestore เช่นบทบาท Cloud Datastore User
Admin SDK ข้าม Firestore Security Rules ดังนั้น backend ต้องตรวจ token และสิทธิ์ผู้ใช้เอง
ไฟล์ `firestore.rules` ปิดการเข้าถึงจาก frontend โดยตรง แต่ยังไม่ได้ deploy rules เหล่านี้ขึ้น cloud

## ย้ายข้อมูล MySQL เดิม

ตั้ง `DB_HOST`, `DB_PORT` (MySQL ปกติ 3306), `DB_USER`, `DB_PASSWORD`, `DB_NAME` ใน `backend/.env` ให้ตรงกับ MySQL ต้นทาง
เก็บ dependency `mysql2` ไว้สำหรับการนำเข้าเท่านั้น

```sh
npm run import:mysql
```

ค่าเริ่มต้นเป็น dry run อ่านจำนวนแถวจาก MySQL โดยไม่เขียน Firestore
ก่อนนำเข้าจริง ให้หยุด backend/งานอื่นที่เขียนข้อมูลทั้งต้นทางและปลายทาง แล้วรัน:

```sh
npm run import:mysql -- --apply
```

สคริปต์นำเข้าข้อมูลจาก 7 ตาราง เก็บ ID และ bcrypt hash เดิม รวมแผนงานไว้ในใบ CR และตั้ง counter ต่อจาก ID สูงสุด
ไม่แก้ไขหรือลบข้อมูล MySQL ต้นทาง และปฏิเสธหาก collection ปลายทางมีข้อมูลอยู่แล้ว
การนำเข้าเป็น atomic batch เดียว จำกัด 450 documents และอยู่ภายใต้ขนาด request ของ Firestore
หากข้อมูลมากกว่านี้ต้องใช้แผน migration แบบแบ่งช่วงพร้อมตรวจสอบก่อนเปิดระบบ
วันที่แบบ DATE คงค่าเดิม ส่วน DATETIME ต้นทางตีความเป็น UTC; ตรวจ timezone ต้นทางก่อนนำเข้าข้อมูลจริง
เมื่อไม่มีข้อมูล `users` และ `systems` ใน Firestore จะยัง login หรือสร้าง CR ไม่ได้

## โครงสร้างข้อมูล

- `users/{user_id}` — ข้อมูล user, role, bcrypt password hash, is_active
- `systems/{system_id}` — รหัสและชื่อระบบ
- `change_requests/{cr_id}` — ข้อมูล CR, changeTypes, plan, rollbackPlan
- `change_requests/{cr_id}/approvals/{approval_id}` — ประวัติอนุมัติ
- `counters/change_requests` — lastId สำหรับแจกเลขด้วย transaction

เลข preview ยังไม่ใช่การจองเลข; เลขจริงแจกตอน transaction สร้าง CR
การอนุมัติตรวจสถานะและบันทึกผลใน transaction เดียวเพื่อกันตัดสินใบที่ปิดแล้วซ้ำ
ชื่อผู้ร้องขอและชื่อระบบอ่านจากเอกสารอ้างอิงเพื่อคงพฤติกรรมเดิม
การค้นเลขบางส่วนยังกรองใน backend หลังอ่านใบที่ผู้ใช้เห็นได้ทั้งหมด; ข้อมูลขนาดใหญ่ควรเพิ่ม pagination/search index เพื่อลดจำนวน reads
อีเมลส่งหลัง commit และ await ก่อนตอบ เพื่อรองรับ serverless; ถ้าส่งล้มเหลวจะไม่ย้อนผลบันทึก CR

## ทดสอบโดยไม่ใช้ production credentials

ต้องติดตั้ง Firebase CLI และ Java ที่ Firestore emulator รองรับ จากนั้น:

```sh
npm run test:firestore
```

ใช้ emulator ที่ `127.0.0.1:8086` กับโปรเจกต์จำลอง `demo-cr-migration`
ทดสอบ login, สิทธิ์เดิม, validation, filters, plans, สร้าง CR พร้อมกัน และอนุมัติพร้อมกัน
ไม่มีการส่งอีเมลจริงจากชุดทดสอบ

## รัน backend

```sh
npm run dev
```

ยังต้องแก้การยืนยันตัวตนก่อนใช้งานจริง: backend ยังคงเชื่อ `X-User-Id` เพื่อรักษา login flow เดิม
การย้ายฐานข้อมูลนี้ยังไม่ใช่การ deploy Cloud Functions; `src/index.js` export Express app ไว้ให้เพิ่ม entry point ของ Functions ได้
บน Cloud Functions ใช้ runtime service account ผ่าน ADC โดยไม่อัปโหลด private key และต้องใช้แพ็กเกจ Blaze

อ้างอิง: https://firebase.google.com/docs/admin/setup
