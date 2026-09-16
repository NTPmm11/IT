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
  <div class="card" id="app">
    <h1>Login</h1>

    <form @submit.prevent="login">

      <div class="input-group">
        <i class="fa-regular fa-user"></i>
        <input type="text" v-model="username" placeholder="Username" required>
      </div>

      <div class="input-group">
        <i class="fa-solid fa-key"></i>
        <input type="password" v-model="password" placeholder="Password" required>
      </div>

      <div class="flex-row">
        <div class="remember-me">
          <input type="checkbox" id="remember" v-model="remember">
          <label for="remember">Remember Me</label>
        </div>
      </div>

      <button type="submit" class="btn-login" :disabled="submitting">
        {{ submitting ? "กำลังเข้าสู่ระบบ..." : "Sign in" }}
      </button>

    </form>

    <StatusModal :show="modal.show" :variant="modal.variant" :title="modal.title" :message="modal.message"
      @close="modal.show = false" />
  </div>
</template>

<style>
@import '../assets/css/login.css';
</style>
