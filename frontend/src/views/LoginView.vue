<script>
import { apiFetch } from "../services/api.js";
import StatusModal from "../components/StatusModal.vue";

export default {
  components: { StatusModal },

  data() {
    return {
      username: "",
      password: "",
      remember: false,
      submitting: false,
      modal: { show: false, variant: "error", title: "", message: "" }
    };
  },

  methods: {
    async login() {
      if (this.username === "" || this.password === "") {
        this.modal = { show: true, variant: "error", title: "กรอกข้อมูลไม่ครบ", message: "กรุณากรอก Username และ Password" };
        return;
      }

      this.submitting = true;
      try {
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: this.username, password: this.password })
        });

        localStorage.setItem("user", JSON.stringify(data.user));

        this.$router.push("/home");
      } catch (err) {
        this.modal = { show: true, variant: "error", title: "เข้าสู่ระบบไม่สำเร็จ", message: err.message };
        this.submitting = false;
      }
    }
  }
};
</script>

<template>
  <div class="login-page" id="app">
    <div class="login-visual">
      <div class="shape shape-blob-1"></div>
      <div class="shape shape-blob-2"></div>
      <div class="shape shape-blob-3"></div>
      <div class="shape shape-blob-4"></div>
      <div class="shape shape-blob-5"></div>
      <div class="shape shape-ring-1"></div>
      <div class="shape shape-ring-2"></div>
      <div class="shape shape-ring-3"></div>
      <div class="dots dots-top"></div>
      <div class="dots dots-bottom"></div>

      <div class="login-visual-content">
        <h1>Change Request</h1>
        <p>ระบบส่งคำร้องขอเปลี่ยนแปลงระบบ</p>
        <span class="accent-line"></span>
      </div>

      <div class="visual-arrow">
        <i class="fa-solid fa-arrow-right"></i>
      </div>
    </div>

    <div class="login-form-panel">
      <div class="login-form-inner">
        <h2>Welcome !</h2>

        <form @submit.prevent="login">
          <div class="field-group">
            <label for="login-username">Username</label>
            <input id="login-username" type="text" v-model="username" placeholder="Enter your  Username" required>
          </div>

          <div class="field-group">
            <label for="login-password">Password</label>
            <input id="login-password" type="password" v-model="password" placeholder="Enter your password" required>
          </div>

          <div class="remember-row">
            <input type="checkbox" id="remember" v-model="remember">
            <label for="remember">Remember me</label>
          </div>

          <button type="submit" class="btn-login" :disabled="submitting">
            {{ submitting ? "กำลังเข้าสู่ระบบ..." : "Login" }}
          </button>

          <div class="form-divider"></div>
        </form>
      </div>
    </div>

    <StatusModal :show="modal.show" :variant="modal.variant" :title="modal.title" :message="modal.message"
      @close="modal.show = false" />
  </div>
</template>

<style>
@import '../assets/css/login.css';
</style>
