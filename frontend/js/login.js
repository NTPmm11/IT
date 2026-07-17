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
    // async/await = รอคำตอบจาก server ก่อนค่อยทำบรรทัดถัดไป
    async login() {
      try {
        // ส่ง username/password ไปให้ backend เช็คกับ DB
        // (apiFetch มาจาก js/config.js)
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: this.username,
            password: this.password
          })
        });

        // เก็บ token + ข้อมูล user ไว้ใช้ยิง API หน้าอื่นต่อ
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // สั่ง browser เปลี่ยนไปเปิดหน้า form.html
        window.location.href = "form.html";
      } catch (err) {
        // backend ตอบ 401 = user/รหัสผิด — ข้อความอยู่ใน err.message
        alert(err.message);
      }
    }
  }

// .mount("#app") = สั่งให้ Vue เริ่มทำงาน คุมพื้นที่ <div id="app">
}).mount("#app");
