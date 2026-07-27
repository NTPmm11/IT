// ============================================
// main.js — จุดเริ่มของ frontend ทั้งหมด (คล้าย index.js ฝั่ง backend)
// ============================================
//
// index.html มี <script type="module" src="/src/main.js"> — เบราว์เซอร์เปิดเว็บมาแล้ว
// ไฟล์แรกที่รันคือไฟล์นี้ ทำ 3 ขั้นตอนเรียงกัน:
//
// 1. import "./assets/css/base.css" — โหลด CSS กลางที่ใช้ร่วมทุกหน้า (ปุ่ม, พื้นหลัง, responsive)
//    import ไฟล์ CSS ตรงๆ แบบนี้ได้เพราะ Vite (ตัว build) รองรับให้
//
// 2. createApp(App) — สร้าง "instance" ของ Vue app ขึ้นมา 1 ตัว โดยใช้ App.vue
//    เป็น component แม่สุด (root component) ทุกหน้าที่เห็นบนจอ ล้วนเป็นลูกของ App.vue ทั้งนั้น
//
// 3. app.use(router) — ติดตั้ง vue-router (ดู router/index.js) เข้ากับ app
//    ทำให้ App.vue ใช้ <RouterView /> และทุก component ใช้ this.$router / <RouterLink> ได้
//
// app.mount("#app") — เอา Vue app ทั้งก้อนไป "ฝัง" ลงที่ <div id="app"></div> ใน index.html
// จากบรรทัดนี้เป็นต้นไป Vue เข้าคุม div นั้น คอยวาด/อัปเดตหน้าจอให้เองอัตโนมัติทุกครั้งที่ data เปลี่ยน
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: index.html -> <script type="module" src="/src/main.js"> (จุดเดียวที่ browser รันไฟล์นี้)
// ปลายทาง (import เข้ามาใช้): assets/css/base.css, App.vue, router/index.js
// เขียนสั้นๆ ตั้งใจ — ไฟล์นี้มีหน้าที่แค่ "ประกอบร่าง" ของที่มีอยู่แล้วเข้าด้วยกัน ไม่มี logic ธุรกิจใดๆ

import "./assets/css/base.css";

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(router);

app.mount("#app");
