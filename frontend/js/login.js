// ============================================
// login.js — โค้ดของหน้า index.html (หน้า login)
// ============================================
//
// ★ LAB 5 — เปลี่ยน login ปลอมเป็น login จริง (ต้องผ่าน LAB 2 ฝั่ง backend ก่อน)
//
// ตอนนี้: เช็ครหัสแบบ hardcode ฝั่ง browser (ใครกด F12 ก็เห็นรหัส!)
// เป้าหมาย: ส่ง username/password ไปให้ backend เช็คกับ database
//           แล้วเก็บข้อมูล user ที่ได้กลับมาไว้ใช้หน้าอื่น
//
// ตัวช่วยที่มีให้แล้ว: apiFetch(...) ใน js/config.js
//   - ยิง request + แนบ X-User-Id อัตโนมัติ + โยน Error ถ้า server ตอบ error
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- frontend/js/login.js

const { createApp } = Vue;

createApp({

  data() {
    return {
      username: "",     // ผูกกับช่อง Username (v-model="username")
      password: "",     // ผูกกับช่อง Password (v-model="password")
      remember: false   // ผูกกับ checkbox Remember Me (ติ๊ก = true)
    };
  },

  methods: {

    // ถูกเรียกตอนกดปุ่ม Sign in (จาก @submit.prevent="login" ใน HTML)
    //
    // TODO(LAB 5.1): เติม async หน้า login()  →  async login() {
    //   เพราะข้างในต้องมีจังหวะ "รอ" server ตอบ (await)
    login() {
      // TODO(LAB 5.2): ลบ if hardcode ข้างล่างทิ้ง แล้วเขียนใหม่:
      //   ครอบด้วย try { ... } catch (err) { alert(err.message); }
      //
      //   ใน try:
      //   1. ยิง API:
      //        const data = await apiFetch("/auth/login", {
      //          method: "POST",
      //          body: JSON.stringify({ username: this.username,
      //                                 password: this.password })
      //        });
      //   2. เก็บข้อมูล user ไว้ใช้หน้าอื่น (apiFetch อ่านจากตรงนี้):
      //        localStorage.setItem("user", JSON.stringify(data.user));
      //      (localStorage เก็บได้แต่ string เลยต้อง JSON.stringify ก่อน)
      //   3. ไปหน้าฟอร์ม: window.location.href = "form.html";
      //
      //   ใน catch: backend ตอบ 401 (รหัสผิด) ข้อความอยู่ใน err.message

      // ⛔ ของเก่า (login ปลอม) — LAB 5 ให้ลบทั้งก้อนนี้
      if (this.username === "admin" && this.password === "1234") {
        alert("Login successful! (โหมดปลอม — ยังไม่ได้เช็คกับ database)");
        window.location.href = "form.html";
      } else {
        alert("Invalid username or password.");
      }
    }
  }

}).mount("#app");
