<script>
// ============================================
// HomeView.vue — หน้าหลักระบบ (หลัง login สำเร็จ)
// ============================================
//
// จุดกลางให้เลือกไปต่อ: สร้าง CR ใหม่ / ดูประวัติย้อนหลัง / logout
// (ตาม flowchart: Login -> หน้าหลักระบบ -> แยกไป "กรอก CR ใหม่" หรือ "สืบค้นประวัติย้อนหลัง")
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: router/index.js -> path "/home" (lazy load) — LoginView.vue push มาที่นี่หลัง login สำเร็จ
// ปลายทาง: ไม่เรียก apiFetch เลย (ไม่มี logic คุย backend) — มีแค่ <RouterLink> ไปหน้าอื่น
//          (to="/form", to="/list") + ปุ่ม logout ที่ล้าง session แล้วเด้งกลับ "/"
// หน้านี้เป็นแค่ "ทางแยก" ไม่มี state/ฟอร์มอะไรให้จัดการ เลยไม่ต้องมี StatusModal/submitting

import { clearSession } from "../services/api";

export default {
  data() {
    return {
      user: JSON.parse(localStorage.getItem("user") || "null")
    };
  },

  mounted() {
    if (!this.user) {
      this.$router.push("/");
    }
  },

  methods: {
    logout() {
      clearSession();   // ล้างทั้ง token และ user (ดู services/api.js)
      this.$router.push("/");
    }
  }
};
</script>

<template>
  <div class="container home-container" v-if="user">
    <div class="header-section">
      <h1>CHANGE REQUEST SYSTEM</h1>
      <p>สวัสดี {{ user.fullName }} ({{ user.role }})</p>
    </div>

    <div class="home-menu">
      <RouterLink to="/form" class="home-card">
        <i class="fa-solid fa-file-circle-plus"></i>
        <div>
          <h3>กรอก Change Request ใหม่</h3>
          <p>สร้างคำขออนุมัติการเปลี่ยนแปลงระบบ</p>
        </div>
      </RouterLink>

      <RouterLink to="/list" class="home-card">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <div>
          <h3>ประวัติย้อนหลัง</h3>
          <p>สืบค้น / ดูรายการ Change Request ทั้งหมด</p>
        </div>
      </RouterLink>
    </div>

    <div class="ui-action-buttons">
      <button type="button" class="btn btn-cancel" @click="logout">
        <i class="fa-solid fa-right-from-bracket"></i> ออกจากระบบ
      </button>
    </div>
  </div>
</template>

<style scoped>
@import '../assets/css/form.css';

.home-container {
  max-width: 620px;
}

/* สารบัญ ไม่ใช่การ์ด — รายการเรื่องที่ทำได้ เรียงเป็นบรรทัด มีเส้นคั่นระหว่างรายการ
   เส้นประเชื่อมชื่อเรื่องไปหาลูกศร อย่างที่สารบัญเชื่อมหัวข้อไปหาเลขหน้า */
.home-menu {
  border-top: 1px solid var(--line);
  margin-bottom: var(--lh);
}

.home-card {
  display: flex;
  align-items: baseline;
  gap: var(--half);
  padding: var(--half) var(--quarter);
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid var(--line-faint);
}

.home-card:hover,
.home-card:focus-visible {
  background: rgba(0, 7, 90, 0.045);
}

.home-card i {
  color: var(--official);
  width: 22px;
  flex: none;
}

.home-card > div {
  flex: 1;
}

.home-card h3 {
  font-size: 17px;
  font-weight: 700;
}

.home-card p {
  font-size: 15px;
  color: var(--ink-light);
}
</style>
