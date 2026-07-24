<script>
// ============================================
// HomeView.vue — หน้าหลักระบบ (หลัง login สำเร็จ)
// ============================================
//
// จุดกลางให้เลือกไปต่อ: สร้าง CR ใหม่ / ดูประวัติย้อนหลัง / logout
// (ตาม flowchart: Login -> หน้าหลักระบบ -> แยกไป "กรอก CR ใหม่" หรือ "สืบค้นประวัติย้อนหลัง")

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
          <p>สืบค้น / ดูรายการ CR ทั้งหมด</p>
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
  border: 1.5px solid #e5e7eb;
  text-decoration: none;
  color: #00112c;
  transition: all 0.2s;
}

.home-card:hover {
  border-color: #00075a;
  background: #f5f7ff;
}

.home-card i {
  font-size: 26px;
  color: #00075a;
  width: 36px;
  text-align: center;
}

.home-card h3 {
  font-size: 16px;
  margin-bottom: 4px;
}

.home-card p {
  font-size: 13px;
  color: #6b7280;
}
</style>
