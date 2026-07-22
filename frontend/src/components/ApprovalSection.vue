<script>
// ============================================
// ApprovalSection.vue — ส่วนตรวจสอบและอนุมัติ (ใช้ร่วมใน FormView / ApproveView)
// ============================================
//
// รับเลข CR ผ่าน prop crId แล้วยิง POST /change-requests/:id/approval
//
// สิทธิ์: อ่าน role จาก localStorage.user
//   - approver / it_admin  -> กรอก + กดบันทึกได้
//   - requester            -> เห็นทุกช่องแต่ disabled ทั้งหมด (ดูได้อย่างเดียว)
// backend กันซ้ำอีกชั้นด้วย requireRole("approver", "it_admin") อยู่แล้ว

import { apiFetch } from "../services/api.js";

export default {
  name: "ApprovalSection",

  props: {
    crId: { type: [String, Number], required: true }
  },

  data() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return {
      user,
      form: {
        comment: "",
        result: "",     // approved / rejected / more-info
        approver: user.fullName || "",
        date: ""
      }
    };
  },

  computed: {
    // requester = ดูได้อย่างเดียว
    canApprove() {
      return ["approver", "it_admin"].includes(this.user.role);
    }
  },

  methods: {
    async submitApproval() {
      if (!this.form.result) {
        alert("กรุณาเลือกผลการพิจารณา");
        return;
      }

      try {
        await apiFetch(`/change-requests/${this.crId}/approval`, {
          method: "POST",
          body: JSON.stringify({
            result: this.form.result,
            comment: this.form.comment,
            approvalDate: this.form.date
          })
        });
        alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว!");
        this.$emit("approved", this.form.result);
      } catch (err) {
        alert("บันทึกไม่สำเร็จ: " + err.message);
      }
    }
  }
};
</script>

<template>
  <form @submit.prevent="submitApproval">

    <!-- [ 5. การตรวจสอบและอนุมัติ ] -->
    <div class="section-title">
      <div>ส่วนการตรวจสอบและอนุมัติ (Approval Status)</div>
      <span class="note" v-if="canApprove">*เฉพาะสิทธิ์ Approver / PM</span>
      <span class="note" v-else>*เฉพาะสิทธิ์ Approver / PM — คุณดูได้อย่างเดียว</span>
    </div>

    <!-- fieldset disabled = ปิดทุก input/radio ข้างในทีเดียว -->
    <fieldset :disabled="!canApprove" class="approval-fieldset">

      <div class="form-group">
        <label for="approval-comment">ความเห็นของผู้ประเมิน:</label>
        <input type="text" id="approval-comment" v-model="form.comment" placeholder="บันทึกข้อเสนอแนะเพิ่มเติม....">
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

      <div class="ui-action-buttons" v-if="canApprove">
        <button type="submit" class="btn btn-submit">
          <i class="fa-solid fa-paper-plane"></i> บันทึกผลอนุมัติ (Submit)
        </button>
      </div>

    </fieldset>
  </form>
</template>

<style>
.approval-fieldset {
  border: none;
}

.approval-fieldset:disabled input,
.approval-fieldset:disabled select,
.approval-fieldset:disabled textarea {
  background-color: #eaedf2;
  color: #6b7280;
  cursor: not-allowed;
}
</style>
