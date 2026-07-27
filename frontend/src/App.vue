<script setup>
// ============================================
// App.vue — component แม่สุดของทั้งเว็บ (root component)
// ============================================
//
// <script setup> = วิธีเขียนแบบย่อของ Vue 3 (Composition API)
// ต่างจากไฟล์อื่นในโปรเจกต์ที่ใช้ export default {...} (Options API)
// ไฟล์นี้เรียบง่ายมากจนไม่จำเป็นต้องมี data()/methods เลย เลยใช้แบบย่อได้
//
// RouterView = "ช่องว่าง" ที่ router (ดู router/index.js) จะเอา component ของหน้าปัจจุบัน
// (LoginView / HomeView / FormView / ...) มาแทรกตรงนี้ ตาม URL ที่ผู้ใช้กำลังเปิดอยู่
// เปลี่ยน URL -> ของใน RouterView เปลี่ยนตาม โดยไม่ reload หน้าเว็บทั้งหน้า
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: main.js -> createApp(App) ใช้ไฟล์นี้เป็น root component
// ปลายทาง: import { RouterView } from "vue-router" — ไม่ import view ไหนตรงๆ เลย
//          (router/index.js เป็นคนตัดสินใจว่าจะเอา component ไหนมาใส่ตาม URL แทน)
import { RouterView } from "vue-router"
</script>

<template>
  <RouterView />
</template>
