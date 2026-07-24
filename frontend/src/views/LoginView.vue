<script>
// ============================================
// LoginView.vue — เดิมคือ index.html + js/login.js
// ============================================
//
// ★ LAB 5 — หน้า login จริง (ต้องผ่าน LAB 2 ฝั่ง backend ก่อน — POST /api/auth/login)
//
// ไฟล์ .vue หนึ่งไฟล์ = 1 หน้า/1 component แบ่ง 3 ส่วน:
//   <script>   ข้อมูล + ฟังก์ชันของหน้านี้ (โค้ด JS)
//   <template> HTML ที่จะแสดงบนจอ
//   <style>    CSS เฉพาะหน้านี้
//
// export default {...} คือ "นิยาม" component นี้ ข้างในมี:
//   data()   ตัวแปรของหน้านี้ (เปลี่ยนค่าแล้ว UI อัปเดตให้เองอัตโนมัติ)
//   methods  ฟังก์ชันที่เรียกใช้ได้จาก template (เช่น @submit, @click)
//
// ภาพรวมการทำงาน:
// 1. ผู้ใช้พิมพ์ username/password ลงช่องกรอก (v-model ผูกกับ data ด้านล่าง)
// 2. กด Sign in -> เรียก login() -> ยิง POST /api/auth/login ไปที่ backend
// 3. login สำเร็จ -> backend ตอบข้อมูล user กลับมา -> เก็บไว้ใน localStorage
//    (localStorage = ที่เก็บข้อมูลฝั่ง browser อยู่ได้แม้ปิดแท็บ)
//    หน้าอื่นจะอ่านค่านี้ไปแนบ header X-User-Id ทุกครั้งที่เรียก API (ดู services/api.js)
// 4. เด้งไปหน้าฟอร์ม (/form) ด้วย this.$router.push
//
// ทำเสร็จแล้วเช็คยังไง:
//   เข้าหน้า login กรอก username/password ที่มีจริงใน database
//   ถูก -> เด้งไปหน้าฟอร์ม / ผิด -> alert ข้อความ error จาก backend
import { apiFetch } from "../services/api.js";

export default {
  // data() ต้องเป็นฟังก์ชัน (ไม่ใช่ object เฉยๆ) — Vue เรียกให้ตอน component ถูกสร้าง
  // ค่าที่ return ออกมาคือ "ตัวแปรของหน้านี้" ผูกกับช่อง input ผ่าน v-model ใน template
  data() {
    return {
      username: "",   // ผูกกับช่อง Username
      password: ""    // ผูกกับช่อง Password
    };
  },

  methods: {
    // ถูกเรียกตอนกด submit ฟอร์ม (ดู @submit.prevent="login" ใน template ด้านล่าง)
    // async เพราะข้างในต้องรอ apiFetch คุยกับ backend เสร็จก่อน
    async login() {
        if (this.username === "" || this.password === "") {
            alert("กรุณากรอกข้อมูล");
            return;
        }

        try {
          // ยิง POST ไปที่ /api/auth/login พร้อม username/password
          // apiFetch ช่วยแปลง response error ให้โยนเป็น Error อัตโนมัติ (ดู services/api.js)
          const data = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: this.username, password: this.password })
          });

          // เก็บข้อมูล user ไว้ใน localStorage (ต้องแปลงเป็น string ด้วย JSON.stringify)
          // หน้าอื่นจะอ่านค่านี้กลับมาเช็คว่า login อยู่ไหม / แนบ X-User-Id ตอนเรียก API
          localStorage.setItem("user", JSON.stringify(data.user));

          // เปลี่ยนหน้าแบบไม่ reload browser (Vue Router)
          this.$router.push("/form");
        } catch (err) {
          // apiFetch โยน Error พร้อมข้อความจาก backend มาให้แล้ว (เช่น "Username หรือ password ไม่ถูกต้อง")
          alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
        }
    }
  }
};
</script>

<template>
  <div class="card" id="app">
    <h1>Login</h1>

    <!-- @submit.prevent = ส่งฟอร์มแล้วเรียก login() โดยไม่ reload หน้า -->
    <form @submit.prevent="login">

      <div class="input-group">
        <i class="fa-regular fa-user"></i>
        <!-- v-model = ผูกช่องกรอกเข้ากับตัวแปรใน data() -->
        <input type="text" v-model="username" placeholder="Username" required>
      </div>

      <div class="input-group">
        <i class="fa-solid fa-key"></i>
        <input type="password" v-model="password" placeholder="Password" required>
      </div>

      <div class="flex-row">
        <div class="remember-me">
          <input type="checkbox" id="remember" v-model="remember">
          <label for="remember">Remember Me</label>
        </div>
      </div>

      <button type="submit" class="btn-login">Sign in</button>

    </form>
  </div>
</template>

<style>
@import '../assets/css/login.css';
</style>
