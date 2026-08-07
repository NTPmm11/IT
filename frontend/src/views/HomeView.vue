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
//          (to="/form", to="/list") + ปุ่ม logout ที่ลบ localStorage แล้วเด้งกลับ "/"
// หน้านี้เป็นแค่ "ทางแยก" ไม่มี state/ฟอร์มอะไรให้จัดการ เลยไม่ต้องมี StatusModal/submitting

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
      localStorage.removeItem("user");
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

<style>
@import '../assets/css/form.css';

.home-container {
  width: 600px;
}


.home-menu {
  display: grid;
  gap: 16px;
  margin: 10px 0 20px;
}

.home-card {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px;
  border-radius: 12px;
  border: 1.5px solid #2c1111;
  text-decoration: none;
  color: #0f0f0f;
  transition: all 0.2s;
  box-shadow: 0 15px 35px rgba(102, 101, 101, 0.589);
}

.home-card:hover {
  border-color: #faf4f4;
  background: #3f3e3f73;
}

.home-card i {
  font-size: 26px;
  color: #470a0a;
  width: 36px;
  text-align: center;
}

.home-card h3 {
  font-size: 18px;
  margin-bottom: 4px;
}

.home-card p {
  font-size: 13px;
  color: #000000;
}
</style>




