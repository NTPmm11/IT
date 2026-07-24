<script>
// ============================================
// ApproveView.vue — หน้าอนุมัติแบบเปิดตรง (/approve?crId=7)
// ============================================
//
// ★ LAB 7 — หน้านี้ "บาง" มาก เพราะฟอร์มอนุมัติจริงๆ ถูกแยกออกไปเป็น
// components/ApprovalSection.vue (ใช้ร่วม 2 ที่: ท้ายหน้า FormView หลัง submit
// เสร็จ กับหน้านี้ที่เปิดตรงผ่านลิงก์ /approve?crId=7)
//
// component = ชิ้นส่วน UI ที่แยกไฟล์ไว้ใช้ซ้ำได้หลายที่
// หน้านี้แค่ "เรียกใช้" ApprovalSection แล้วส่ง crId ให้ ผ่าน prop (:crId="crId")
// งานจริงของหน้านี้มีแค่อย่างเดียว: อ่านเลข crId จาก URL แล้วส่งต่อ
//
// import ApprovalSection … = ดึง component นั้นเข้ามาใช้ในไฟล์นี้
// components: { ApprovalSection } = "ลงทะเบียน" ให้ template ด้านล่างเรียกใช้แท็ก <ApprovalSection> ได้
import ApprovalSection from "../components/ApprovalSection.vue";

export default {
  components: { ApprovalSection },

  data() {
    return {
      crId: null   // ยังไม่รู้เลข CR จนกว่า mounted() จะอ่านจาก URL มาใส่
    };
  },

  // mounted() = โค้ดที่รันอัตโนมัติ 1 ครั้ง ทันทีที่หน้าเปิดเสร็จ (ไม่ต้องมีใครกดอะไร)
  mounted() {
    // ยังไม่เคย login (ไม่มี user เก็บใน localStorage) -> เด้งกลับหน้า login ทันที
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }

    // this.$route.query.crId = ค่าพารามิเตอร์ใน URL
    // เช่นเปิด /approve?crId=7 -> this.$route.query.crId ได้ "7" มา
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

    <!-- v-if/v-else = มีเลข crId แล้ว โชว์ฟอร์มอนุมัติ / ไม่มี โชว์ข้อความแทน -->
    <ApprovalSection v-if="crId" :crId="crId" />
    <p v-else style="text-align:center; color:#6b7280;">
      ไม่พบเลข CR — กรุณาเข้าหน้านี้ผ่านการ Submit ฟอร์ม
    </p>
  </div>
</template>

<style>
@import '../assets/css/form.css';
</style>
