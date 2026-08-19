<script>

import { apiFetch } from "../services/api.js";
import StatusModal from "./StatusModal.vue";

export default {
  name: "ApprovalSection",

  components: { StatusModal },

  props: {
    crId: { type: [String, Number], required: true }
  },

  data() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return {
      user,
      form: {
        comment: "",
        result: "",
        approver: user.fullName || "",
        date: ""
      },
      submitting: false,
      modal: { show: false, variant: "success", title: "", message: "" }
    };
  },

  computed: {
    canApprove() {
      return ["approver", "it_admin"].includes(this.user.role);
    }
  },

  methods: {
    async submitApproval() {
      if (!this.form.result) {
        this.modal = { show: true, variant: "error", title: "ยังเลือกผลไม่ครบ", message: "กรุณาเลือกผลการพิจารณา" };
        return;
      }

      this.submitting = true;
      try {
        await apiFetch(`/change-requests/${this.crId}/approval`, {
          method: "POST",
          body: JSON.stringify({
            result: this.form.result,
            comment: this.form.comment,
            approvalDate: this.form.date
          })
        });
        this.modal = { show: true, variant: "success", title: "บันทึกสำเร็จ", message: "บันทึกผลการพิจารณาเรียบร้อยแล้ว!" };
        this.$emit("approved", this.form.result);
      } catch (err) {
        this.modal = { show: true, variant: "error", title: "บันทึกไม่สำเร็จ", message: err.message };
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<template>
  <form @submit.prevent="submitApproval">

    <div class="section-title">
      <div>ส่วนการตรวจสอบและอนุมัติ (Approval Status)</div>
      <span class="note" v-if="!canApprove">*คุณดูได้อย่างเดียว</span>
    </div>

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

      <div class="signature-block">
        <div class="signature-line">
          <label for="approver-name">ลงชื่อ</label>
          <input type="text" id="approver-name" v-model="form.approver" placeholder="ชื่อผู้พิจารณา">
        </div>
        <p class="signature-role">ผู้พิจารณาคำขอ</p>
        <div class="signature-line">
          <label for="approval-date">วันที่</label>
          <input type="date" id="approval-date" v-model="form.date">
        </div>
      </div>

      <div class="ui-action-buttons" v-if="canApprove">
        <button type="submit" class="btn btn-submit" :disabled="submitting">
          <i class="fa-solid fa-paper-plane"></i>
          {{ submitting ? "กำลังบันทึก..." : "บันทึกผลอนุมัติ (Submit)" }}
        </button>
      </div>

    </fieldset>

    <StatusModal :show="modal.show" :variant="modal.variant" :title="modal.title" :message="modal.message"
      @close="modal.show = false" />
  </form>
</template>

<style>
.approval-fieldset {
  border: none;
}

.approval-fieldset:disabled input,
.approval-fieldset:disabled select,
.approval-fieldset:disabled textarea {
  color: var(--ink-light);
  border-bottom-style: dashed;
  cursor: not-allowed;
}

.signature-block {
  width: 300px;
  max-width: 100%;
  margin: var(--lh) 0 var(--half) auto;
}

.signature-line {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  gap: var(--quarter);
}

.signature-line label {
  font-weight: 400;
}

.signature-role {
  padding-left: 44px;
  margin-bottom: var(--quarter);
  font-size: 15px;
  color: var(--ink-light);
}
</style>
