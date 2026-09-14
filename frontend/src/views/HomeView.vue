<script>
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
          <p v-if="user.role === 'requester'">สืบค้น / ดูคำขอ Change Request ของคุณ</p>
          <p v-else>สืบค้น / ดูรายการ Change Request ทั้งหมด</p>
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
@import '../assets/css/home.css';
</style>
