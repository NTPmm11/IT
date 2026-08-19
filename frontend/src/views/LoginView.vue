<script>
import { apiFetch } from "../services/api.js";
import StatusModal from "../components/StatusModal.vue";

export default {
  components: { StatusModal },

  data() {
    return {
      username: "",
      password: "",
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

        localStorage.setItem("token", data.token);
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
    <p class="card-eyebrow">ระบบขออนุมัติเปลี่ยนแปลงระบบงาน</p>
    <h1>ลงชื่อเข้าใช้</h1>

    <form @submit.prevent="login">

      <div class="field-line">
        <label for="login-username">ชื่อผู้ใช้ (AD)</label>
        <input id="login-username" type="text" v-model="username" autocomplete="username" required>
      </div>

      <div class="field-line">
        <label for="login-password">รหัสผ่าน (AD)</label>
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
