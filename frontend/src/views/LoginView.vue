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
// 2. กด ลงชื่อเข้าใช้ -> เรียก login() -> ยิง POST /api/auth/login ไปที่ backend
// 3. login สำเร็จ -> backend ตอบข้อมูล user กลับมา -> เก็บไว้ใน localStorage
//    (localStorage = ที่เก็บข้อมูลฝั่ง browser อยู่ได้แม้ปิดแท็บ)
//    apiFetch อ่าน token จากตรงนี้ไปแนบ Authorization: Bearer ทุกครั้งที่เรียก API (ดู services/api.js)
// 4. เด้งไปหน้าหลัก (/home) ด้วย this.$router.push
//
// ทำเสร็จแล้วเช็คยังไง:
//   เข้าหน้า login กรอก username/password ที่มีจริงใน database
//   ถูก -> เด้งไปหน้าฟอร์ม / ผิด -> modal แจ้ง error จาก backend
//
// UX: ปุ่ม submit ต้องให้รู้ทันทีว่า "กำลังทำงานอยู่" ระหว่างรอ backend ตอบ
// (submitting = true -> ปุ่มถูก disable + เปลี่ยนข้อความ กันคนกดซ้ำ/เข้าใจว่าไม่มีอะไรเกิดขึ้น)
// ผิดพลาด -> โชว์ StatusModal แทน alert() ของ browser (ชัดเจน คุมสไตล์เองได้)
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: router/index.js -> path "/" (หน้าแรกสุดที่ทุกคนเจอ, import ตรงๆ ไม่ lazy load)
// ปลายทาง: services/api.js (apiFetch -> POST /api/auth/login) + components/StatusModal.vue
// เป็นหน้าเดียวในระบบที่ "ยังไม่ต้อง login" ก็เข้าได้ (ทุกหน้าอื่นเช็ค localStorage.user ใน mounted())
import { apiFetch } from "../services/api.js";
import StatusModal from "../components/StatusModal.vue";

export default {
  components: { StatusModal },

  // data() ต้องเป็นฟังก์ชัน (ไม่ใช่ object เฉยๆ) — Vue เรียกให้ตอน component ถูกสร้าง
  // ค่าที่ return ออกมาคือ "ตัวแปรของหน้านี้" ผูกกับช่อง input ผ่าน v-model ใน template
  data() {
    return {
      username: "",     // ผูกกับช่อง Username
      password: "",     // ผูกกับช่อง Password
      submitting: false, // true ระหว่างรอ backend ตอบ — คุมปุ่ม disable/ข้อความ
      modal: { show: false, variant: "error", title: "", message: "" }
    };
  },

  methods: {
    // ถูกเรียกตอนกด submit ฟอร์ม (ดู @submit.prevent="login" ใน template ด้านล่าง)
    // async เพราะข้างในต้องรอ apiFetch คุยกับ backend เสร็จก่อน
    async login() {
      if (this.username === "" || this.password === "") {
        this.modal = { show: true, variant: "error", title: "กรอกข้อมูลไม่ครบ", message: "กรุณากรอก Username และ Password" };
        return;
      }

      this.submitting = true;
      try {
        // ยิง POST ไปที่ /api/auth/login พร้อม username/password
        // apiFetch ช่วยแปลง response error ให้โยนเป็น Error อัตโนมัติ (ดู services/api.js)
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: this.username, password: this.password })
        });

        // token = สิ่งที่พิสูจน์ตัวตนจริงกับ backend (apiFetch แนบให้ทุก request)
        localStorage.setItem("token", data.token);
        // ส่วนก้อน user เก็บไว้ให้หน้าเว็บเอาไปโชว์ชื่อ/ซ่อนปุ่มตาม role
        // (ต้องแปลงเป็น string ด้วย JSON.stringify) — backend ไม่เชื่อค่านี้ อ่าน role จาก database เอง
        localStorage.setItem("user", JSON.stringify(data.user));

        // เปลี่ยนหน้าแบบไม่ reload browser (Vue Router)
        // ไม่ต้องโชว์ modal สำเร็จ — เปลี่ยนหน้าไปเลยคือ feedback ที่ชัดเจนอยู่แล้ว
        this.$router.push("/home");
      } catch (err) {
        // apiFetch โยน Error พร้อมข้อความจาก backend มาให้แล้ว (เช่น "Username หรือ password ไม่ถูกต้อง")
        this.modal = { show: true, variant: "error", title: "เข้าสู่ระบบไม่สำเร็จ", message: err.message };
        // สำเร็จแล้วไม่ต้องคืน submitting เพราะกำลังเปลี่ยนหน้าออกไปพอดี (component นี้จะถูกทำลายไป)
        this.submitting = false;
      }
    }
  }
};
</script>

<template>
  <div class="card" id="app">
    <p class="card-eyebrow">ระบบขออนุมัติเปลี่ยนแปลงระบบงาน</p>
    <h1>ลงชื่อเข้าใช้</h1>

    <!-- @submit.prevent = ส่งฟอร์มแล้วเรียก login() โดยไม่ reload หน้า -->
    <form @submit.prevent="login">

      <!-- ชื่อช่องเป็น <label> จริง ไม่ใช่ placeholder — แบบฟอร์มมีหัวข้อช่องเสมอ
           และ placeholder หายไปตอนพิมพ์ ทำให้ลืมว่าช่องนี้คือช่องอะไร -->
      <div class="field-line">
        <label for="login-username">ชื่อผู้ใช้</label>
        <!-- v-model = ผูกช่องกรอกเข้ากับตัวแปรใน data() -->
        <input id="login-username" type="text" v-model="username" autocomplete="username" required>
      </div>

      <div class="field-line">
        <label for="login-password">รหัสผ่าน</label>
        <input id="login-password" type="password" v-model="password" autocomplete="current-password" required>
      </div>

      <button type="submit" class="btn-login" :disabled="submitting">
        {{ submitting ? "กำลังลงชื่อเข้าใช้..." : "ลงชื่อเข้าใช้" }}
      </button>

    </form>

    <StatusModal :show="modal.show" :variant="modal.variant" :title="modal.title" :message="modal.message"
      @close="modal.show = false" />
  </div>
</template>

<style>
@import '../assets/css/login.css';
</style>
