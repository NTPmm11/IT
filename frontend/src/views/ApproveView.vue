<script>
// ============================================
// ApproveView.vue — หน้าอนุมัติแบบเปิดตรง (/approve?crId=7)
// ============================================
//
// เนื้อฟอร์มอนุมัติย้ายไปอยู่ components/ApprovalSection.vue
// เพื่อใช้ร่วมกับท้ายหน้า FormView — หน้านี้เหลือแค่อ่าน crId จาก URL
// แล้วส่งต่อเป็น prop

import ApprovalSection from "../components/ApprovalSection.vue";

export default {
  components: { ApprovalSection },

  data() {
    return {
      crId: null
    };
  },

  mounted() {
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }

    this.crId = this.$route.query.crId;
  }
};
</script>

<template>
  <div class="container" id="app">
    <div class="header-section">
      <h1>CHANGE REQUEST FORM (CR)</h1>
      <p>ระบบยื่นคำขออนุมัติการเปลี่ยนแปลงและปรับปรุงระบบงาน (Web Portal Schema)</p>
    </div>

    <ApprovalSection v-if="crId" :crId="crId" />
    <p v-else style="text-align:center; color:#6b7280;">
      ไม่พบเลข CR — กรุณาเข้าหน้านี้ผ่านการ Submit ฟอร์ม
    </p>
  </div>
</template>

<style>
@import '../assets/css/form.css';
</style>
