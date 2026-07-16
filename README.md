# ระบบ Change Request (CR)

ฟอร์มขอเปลี่ยนแปลงระบบงาน — โปรเจคหัดเขียน HTML + CSS + Vue 3 (โหลดผ่าน CDN ไม่ต้องลง Node)

## วิธีเปิดใช้งาน

ทางที่ 1 — ง่ายสุด: ดับเบิลคลิก `index.html` เปิดใน browser ได้เลย

ทางที่ 2 — ผ่าน dev server (เหมือนโปรเจคจริง):

```bash
npm run dev
```

แล้วเปิด http://localhost:3000

Login: username `admin` / password `1234`
ต้องต่อ internet (Vue กับ Font Awesome โหลดจาก CDN)

## โครงไฟล์

```
IT/
├── index.html      หน้า login
├── form.html       หน้าฟอร์ม CR (section 1-4)
├── approve.html    หน้าอนุมัติ (section 5)
├── README.md       ไฟล์นี้
├── package.json    สคริปต์ npm run dev
├── css/            หน้าตา (สี ระยะ ฟอนต์)
│   ├── base.css    ใช้ทุกหน้า — reset, พื้นหลัง, ปุ่ม, print
│   ├── login.css   เฉพาะหน้า login
│   └── form.css    ใช้ร่วม form + approve — layout ฟอร์ม, ตาราง
├── js/             การทำงาน (Vue)
│   ├── common.js   method ใช้ร่วมทุกหน้า — ยกเลิก, บันทึกร่าง, PDF
│   ├── login.js    เช็ค login แล้วพาไป form.html
│   ├── form.js     ข้อมูลฟอร์ม + ตาราง action plan (เพิ่ม/ลบแถว)
│   └── approve.js  ข้อมูลผลอนุมัติ
└── img/            รูปภาพ
```

## ลำดับหน้า

```
index.html ──login ผ่าน──> form.html ──Submit CR──> approve.html
```

## กติกาการวางไฟล์ (จำ 3 ข้อ)

1. **HTML = โครงหน้า, CSS = หน้าตา, JS = การทำงาน** — ไม่เขียนปนกันในไฟล์เดียว
2. **ใช้ร่วมหลายหน้า** → เข้า `base.css` / `common.js`
3. **เฉพาะหน้าไหน** → ไฟล์ของหน้านั้น (`login.css`, `form.js`, ...)

## อยากแก้อะไร แก้ที่ไฟล์ไหน

| อยากทำ | แก้ที่ |
|---|---|
| เปลี่ยนสี/ปุ่ม/พื้นหลัง ทุกหน้า | `css/base.css` |
| เปลี่ยนหน้าตาฟอร์ม/ตาราง | `css/form.css` |
| เพิ่มช่องกรอกใหม่ | `form.html` (เพิ่ม input + `v-model`) และ `js/form.js` (เพิ่มตัวแปรใน `data()`) |
| เพิ่มปุ่ม/การทำงานใหม่เฉพาะฟอร์ม | `js/form.js` (เพิ่ม method) แล้วผูก `@click` ใน `form.html` |
| แก้ปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) | `js/common.js` — แก้ที่เดียว มีผลทุกหน้า |
| เปลี่ยน username/password | `js/login.js` |
| เพิ่มตัวเลือกใน dropdown ระบบงาน | `form.html` (แท็ก `<select>`) |

## คอนเซ็ปต์ Vue ที่ใช้

| ของ | ทำอะไร | ตัวอย่างในโปรเจค |
|---|---|---|
| `data()` | ตัวแปรของหน้า | `form`, `rows` ใน `form.js` |
| `v-model` | ผูก input กับตัวแปร | ทุกช่องกรอก |
| `v-for` | วนสร้าง element จาก array | แถวตาราง action plan |
| `@click` | กดปุ่มแล้วเรียก method | ปุ่มเพิ่ม/ลบแถว |
| `@submit.prevent` | ส่งฟอร์มโดยไม่ reload หน้า | แท็ก `<form>` ทุกหน้า |
| `:disabled` | ปิด/เปิดช่องตามเงื่อนไข | ช่อง "กระทบระบบอื่น (ระบุ)" |

## หมายเหตุ

- Password เช็คใน browser — โปรเจคหัดเขียนเท่านั้น เว็บจริงต้องเช็คฝั่ง server
- กด Submit แล้วเปิด DevTools (F12) แท็บ Console จะเห็นข้อมูลที่ Vue เก็บไว้ทั้งหมด
