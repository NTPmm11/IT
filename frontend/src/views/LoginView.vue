<script>
// ============================================
// LoginView.vue — เดิมคือ index.html + js/login.js
// ============================================
import { apiFetch } from "../services/api.js";

export default {
  data() {
    return {
      username: "",
      password: ""
    };
  },

  methods: {
    async login() {
        if (this.username === "" || this.password === "") {
            alert("กรุณากรอกข้อมูล");
            return;
        }

        try {
          const data = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: this.username, password: this.password })
          });

          localStorage.setItem("user", JSON.stringify(data.user));
          this.$router.push("/form");
        } catch (err) {
          alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
        }
    }
  }
};
</script>

<template>
  <div class="card" id="app">
    <h1>Login</h1>

    <!-- @submit.prevent = ส่งฟอร์มแล้วเรียก login() โดยไม่ reload หน้า -->
    <form @submit.prevent="login">

      <div class="input-group">
        <i class="fa-regular fa-user"></i>
        <!-- v-model = ผูกช่องกรอกเข้ากับตัวแปรใน data() -->
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

      <button type="submit" class="btn-login">Sign in</button>

    </form>
  </div>
</template>

<style>
@import '../assets/css/login.css';
</style>
