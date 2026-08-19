<script>

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
      clearSession();
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
