// ============================================
// router/index.js — "สมุดจับคู่" URL กับหน้า (component) ที่ต้องโชว์
// ============================================
//
// Vue เป็น SPA (Single Page Application) — จริงๆ มี index.html แค่ไฟล์เดียว
// ไม่มีการโหลดหน้าใหม่จาก server ทุกครั้งที่เปลี่ยน URL แบบเว็บเก่าๆ
// vue-router คือตัวที่ทำให้ URL เปลี่ยน (เช่น /home -> /form) แล้ว "สลับ component"
// ที่แสดงในจอแทน โดยไม่ reload browser เลย (ดู <RouterView /> ใน App.vue คือช่องที่ไปโผล่)
//
// ทุกหน้าในโปรเจกต์เรียกใช้ router 2 แบบ:
//   1. <RouterLink to="/form">...</RouterLink>  ในเทมเพลต — คลิกแล้วเปลี่ยนหน้า (เหมือน <a>)
//   2. this.$router.push("/home")               ในโค้ด JS — สั่งเปลี่ยนหน้าเองหลังทำงานเสร็จ
//      (เช่น LoginView.vue login สำเร็จ -> push("/home"))
//
// createWebHistory = ใช้ URL ปกติแบบ /home /form (ไม่มี # นำหน้าแบบของเก่า createWebHashHistory)
// import.meta.env.BASE_URL = base path ของเว็บ (ปกติคือ "/" เว้นแต่ deploy ใน subfolder)
//
// routes = array ของ "กติกา" แต่ละหน้า มี 3 อย่าง:
//   path      URL ที่ต้องตรง (เช่น "/form" = ไปเปิด http://localhost:5173/form)
//   name      ชื่อเรียกสั้นๆ แทน path เอาไว้ push({ name: "home" }) แทนพิมพ์ path ตรงๆ ก็ได้
//   component ไฟล์ .vue ที่จะโชว์เมื่อ path ตรง
//
// component: () => import("...") คือ "lazy load" — พูดง่ายๆ คือแบ่งแต่ละหน้าเป็นไฟล์ .js
// แยกกัน แล้ว "ยังไม่โหลด" จนกว่าผู้ใช้จะเข้าหน้านั้นจริงๆ ทำให้หน้าแรกโหลดเร็วขึ้น
// (ไม่ต้องแบกทุกหน้ามาพร้อมกันตั้งแต่เปิดเว็บครั้งแรก)
// LoginView ไม่ทำแบบนี้ (import ตรงๆ ด้านบนแทน) เพราะเป็นหน้าแรกที่ทุกคนต้องเจออยู่แล้ว
// โหลดพร้อม bundle หลักไปเลยดีกว่า ไม่ต้องรอ network อีกรอบตอนเปิดเว็บ
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: main.js -> app.use(router) ติดตั้งไฟล์นี้เข้ากับ Vue app
// ปลายทาง (import): views/LoginView.vue ตรงๆ + views/HomeView.vue, FormView.vue, ApproveView.vue,
//                    ListView.vue แบบ lazy (โหลดตอนเข้าหน้านั้นจริง)
// ทุก view ที่มี this.$router.push(...) หรือ <RouterLink> ล้วนพึ่งพา "กติกา" ที่กำหนดไว้ในไฟล์นี้

import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "login", component: LoginView },
    { path: "/home", name: "home", component: () => import("../views/HomeView.vue") },
    { path: "/form", name: "form", component: () => import("../views/FormView.vue") },
    { path: "/approve", name: "approve", component: () => import("../views/ApproveView.vue") },
    { path: "/list", name: "list", component: () => import("../views/ListView.vue") }
  ]
});

// export default = ไฟล์อื่น import router from "./router" เอาไปใช้ได้
// (ดู main.js — app.use(router) คือจุดที่เอา "สมุดจับคู่" นี้ไปติดตั้งจริงกับ Vue app)
export default router;
