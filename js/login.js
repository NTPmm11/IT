// ============================================
// login.js — โค้ดของหน้า index.html (หน้า login)
// ============================================
//
// ภาพรวมการทำงาน:
// 1. Vue สร้าง "app" ขึ้นมาคุมพื้นที่ <div id="app"> ใน HTML
// 2. ช่อง Username/Password ผูกกับตัวแปรผ่าน v-model
//    (พิมพ์อะไรในช่อง ตัวแปรเปลี่ยนตามทันที)
// 3. กดปุ่ม Sign in -> ฟอร์มเรียก method login()
// 4. login() เช็ครหัส ถ้าถูก -> ย้ายไปหน้า form.html

// ดึงฟังก์ชัน createApp ออกมาจากตัว Vue (ที่โหลดมาจาก CDN)
const { createApp } = Vue;

createApp({

  // data() = "ตัวแปรของหน้านี้" — Vue จะคอยเฝ้าดูค่าพวกนี้
  // ค่าเริ่มต้นเป็นค่าว่าง เพราะผู้ใช้ยังไม่ได้พิมพ์อะไร
  data() {
    return {
      username: "",     // ผูกกับช่อง Username (v-model="username")
      password: "",     // ผูกกับช่อง Password (v-model="password")
      remember: false   // ผูกกับ checkbox Remember Me (ติ๊ก = true)
    };
  },

  // methods = "ฟังก์ชันของหน้านี้" — HTML เรียกใช้ผ่าน @click / @submit
  methods: {

    // ถูกเรียกตอนกดปุ่ม Sign in (จาก @submit.prevent="login" ใน HTML)
    // .prevent = กันไม่ให้ browser reload หน้าตอน submit ฟอร์ม
    login() {
      // this.username = ค่าที่ผู้ใช้พิมพ์ในช่อง Username ตอนนี้
      // (this = ตัว app นี้เอง ใช้เข้าถึงตัวแปรใน data ได้ทุกตัว)

      // NOTE: for learning only — real apps must verify passwords on the server
      if (this.username === "admin" && this.password === "1234") {
        alert("Login successful!");

        // สั่ง browser เปลี่ยนไปเปิดหน้า form.html
        window.location.href = "form.html";
      } else {
        alert("Invalid username or password.");
      }
    }
  }

// .mount("#app") = สั่งให้ Vue เริ่มทำงาน คุมพื้นที่ <div id="app">
}).mount("#app");
