<script>
// ============================================
// ApproveView.vue — เดิมคือ approve.html + js/approve.js
// ============================================
//
// ★ LAB 7 — บันทึกผลอนุมัติลง database (ต้องผ่าน LAB 4C ฝั่ง backend ก่อน)
//
// โจทย์นี้มีของใหม่ 1 อย่าง: อ่านค่าจาก URL
// หน้า form (LAB 6) ส่งเลข CR มาทาง query string แบบนี้: /approve?crId=7
// หน้านี้ต้องอ่านเลขนั้นมาใช้ตอนยิง API
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- frontend/js/approve.js

import { commonMethods } from "../services/commonActions.js";

export default {
  data() {
    return {
      // เลข id ของ CR ที่กำลังพิจารณา — LAB 7 จะอ่านจาก URL มาใส่
      crId: null,

      form: {
        comment: "",    // ความเห็นทีมพัฒนา/ผู้ประเมิน
        result: "",     // radio ผลการพิจารณา: approved / rejected / more-info
        approver: "",   // ชื่อผู้อนุมัติ
        date: ""        // วันที่พิจารณา
      }
    };
  },

  // mounted() = ทำงานอัตโนมัติ 1 ครั้งตอนหน้าเปิดเสร็จ
  mounted() {
    // TODO(LAB 7.1): localStorage ไม่มี "user" -> เด้งกลับหน้า login (path "/") (ท่าเดียวกับ LAB 6.1)

    // TODO(LAB 7.2): อ่าน crId จาก query string
    // hint: this.crId = this.$route.query.crId;
    //   (this.$route.query = ตัวแกะของหลัง ? ใน URL ให้เรา — เทียบเท่า URLSearchParams เดิม)

    // TODO(LAB 7.3): เติมชื่อผู้อนุมัติจาก localStorage (ท่าเดียวกับ LAB 6.2)
  },

  methods: {
    // ดึงปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) มาจาก services/commonActions.js
    ...commonMethods,

    // ถูกเรียกตอนกดปุ่ม "บันทึกผลอนุมัติ" (@submit.prevent="handleSubmit")
    //
    // TODO(LAB 7.4): เติม async -> async handleSubmit()
    handleSubmit() {
      // TODO(LAB 7.5): เช็คของก่อนส่ง
      //   - this.crId ว่าง -> alert บอกให้เข้าหน้านี้ผ่านการ Submit ฟอร์ม แล้ว return
      //   - this.form.result ว่าง (ยังไม่เลือก radio) -> alert แล้ว return

      // TODO(LAB 7.6): ยิง API บันทึกผล (ครอบ try/catch)
      // hint:
      //   await apiFetch(`/change-requests/${this.crId}/approval`, {
      //     method: "POST",
      //     body: JSON.stringify({
      //       result: this.form.result,
      //       comment: this.form.comment,
      //       approvalDate: this.form.date
      //     })
      //   });
      //   (`...${...}...` = template string — แทนค่าตัวแปรกลาง string ได้)
      //
      //   สำเร็จ -> alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว!")
      //   catch  -> alert("บันทึกไม่สำเร็จ: " + err.message)
      //
      //   โจทย์แถม: ลอง login ด้วย somchai (role requester) แล้วกดบันทึก
      //   ต้องเจอ "Forbidden: insufficient role" — นั่นคือฝีมือ LAB 3.4

      // ⛔ ของเก่า — LAB 7 ให้แทนที่ทั้งก้อนนี้
      console.log("Approval data:", JSON.stringify(this.form, null, 2));
      alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว! (โหมดปลอม — ยังไม่ลง database)");
    }
  }
};
</script>

<template>
  <div class="container" id="app">
    <div class="header-section">
      <h1>CHANGE REQUEST FORM (CR)</h1>
      <p>ระบบยื่นคำขออนุมัติการเปลี่ยนแปลงและปรับปรุงระบบงาน (Web Portal Schema)</p>
    </div>

    <form @submit.prevent="handleSubmit">

      <!-- [ 5. การตรวจสอบและอนุมัติ ] -->
      <div class="section-title">
        <div>ส่วนการตรวจสอบและอนุมัติ (Approval Status)</div>
        <span class="note">*เฉพาะสิทธิ์ Approver / PM</span>
      </div>

       <div class="form-group">
          <label for="cr-department">ความเห็นของผู้ประเมิน:</label>
          <input type="text" id="cr-department" v-model="form.comment" placeholder="บันทึกข้อเสนอแนะเพิ่มเติม....">
        </div>
      <div class="form-group">
        <label>ผลการพิจารณา:</label>
        <div class="options-group">
          <label class="option-item"><input type="radio" value="approved" v-model="form.result"> อนุมัติ (Approved)</label>
          <label class="option-item"><input type="radio" value="rejected" v-model="form.result"> ไม่อนุมัติ (Rejected)</label>
          <label class="option-item"><input type="radio" value="more-info" v-model="form.result"> ขอข้อมูลเพิ่ม (More Info)</label>
        </div>
      </div>

      <div class="grid-2col" style="margin-top: 10px;">
        <div class="form-group">
          <label for="approver-name">ผู้อนุมัติ (Approver):</label>
          <input type="text" id="approver-name" v-model="form.approver" placeholder="ชื่อผู้มีสิทธิ์อนุมัติ">
        </div>
        <div class="form-group">
          <label for="approval-date">วันที่พิจารณา:</label>
          <input type="date" id="approval-date" v-model="form.date">
        </div>
      </div>

      <div class="ui-action-buttons">
        <button type="button" class="btn btn-cancel" @click="cancelForm">
          <i class="fa-solid fa-xmark"></i> ยกเลิก (Cancel)
        </button>

        <button type="submit" class="btn btn-submit">
          <i class="fa-solid fa-paper-plane"></i> บันทึกผลอนุมัติ (Submit)
        </button>
      </div>

    </form>
  </div>
</template>

<style>
@import '../assets/css/form.css';
</style>
