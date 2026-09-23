<script>
import { apiFetch } from "../services/api.js";
import StatusModal from "./StatusModal.vue";
import SignaturePad from "./SignaturePad.vue";

export default {
  name: "ApprovalSection",

  components: { StatusModal, SignaturePad },

  props: {
    crId: { type: [String, Number], required: true },
    status: { type: String, default: "" },
    approvals: { type: Array, default: () => [] }
  },

  data() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return {
      user,
      form: {
        comment: "",
        result: "",
        approver: user.fullName || "",
        date: "",
        signature: ""
      },
      submitting: false,
      modal: { show: false, variant: "success", title: "", message: "" }
    };
  },

  computed: {
    canApprove() {
      return ["approver", "it_admin"].includes(this.user.role);
    },

    isPending() {
      return ["submitted", "more_info"].includes(this.status);
    },

    latestApproval() {
      return this.approvals.length ? this.approvals[this.approvals.length - 1] : null;
    }
  },

  methods: {
    resultLabel(result) {
      const labels = { approved: "อนุมัติ (Approved)", rejected: "ไม่อนุมัติ (Rejected)", "more-info": "ขอข้อมูลเพิ่ม (More Info)" };
      return labels[result] || result || "-";
    },

    async submitApproval() {
      if (!this.form.result) {
        this.modal = { show: true, variant: "error", title: "ยังเลือกผลไม่ครบ", message: "กรุณาเลือกผลการพิจารณา" };
        return;
      }

      if (!this.form.signature) {
        this.modal = { show: true, variant: "error", title: "ยังไม่ได้เซ็นชื่อ", message: "กรุณาเซ็นลายเซ็นก่อนบันทึกผลอนุมัติ" };
        return;
      }

      this.submitting = true;
      try {
        await apiFetch(`/change-requests/${this.crId}/approval`, {
          method: "POST",
          body: JSON.stringify({
            result: this.form.result,
            comment: this.form.comment,
            approvalDate: this.form.date,
            signature: this.form.signature
          })
        });
        this.modal = { show: true, variant: "success", title: "ส่งคำตอบอนุมัติเรียบร้อย", message: "ระบบได้บันทึกผลการพิจารณาและส่งคำตอบอนุมัติเรียบร้อยแล้ว" };
        this.$emit("approved", this.form.result);
        setTimeout(() => this.$router.push("/list"), 2500);
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
  <form v-if="isPending" @submit.prevent="submitApproval">

    <div class="approval-title">
      <div>ส่วนการตรวจสอบและอนุมัติ (Approval Status)</div>
      <span class="note" v-if="canApprove">*เฉพาะสิทธิ์ Approver / PM</span>
      <span class="note" v-else>*เฉพาะสิทธิ์ Approver / PM — คุณดูได้อย่างเดียว</span>
    </div>

    <fieldset :disabled="!canApprove" class="approval-fieldset">

      <div class="approval-group">
        <label for="approval-comment">ความเห็นของผู้ประเมิน:</label>
        <input type="text" id="approval-comment" v-model="form.comment" placeholder="บันทึกข้อเสนอแนะเพิ่มเติม....">
      </div>

      <div class="approval-group">
        <label>ผลการพิจารณา:</label>
        <div class="options-group">
          <label class="option-item"><input type="radio" value="approved" v-model="form.result"> อนุมัติ (Approved)</label>
          <label class="option-item"><input type="radio" value="rejected" v-model="form.result"> ไม่อนุมัติ (Rejected)</label>
          <label class="option-item"><input type="radio" value="more-info" v-model="form.result"> ขอข้อมูลเพิ่ม (More Info)</label>
        </div>
      </div>

      <div class="grid-2col" style="margin-top: 10px;">
        <div class="approval-group">
          <label for="approver-name">ผู้อนุมัติ (Approver):</label>
          <input type="text" id="approver-name" :value="form.approver" readonly
            title="ระบบใช้ชื่อผู้ใช้ที่เข้าสู่ระบบอยู่ แก้ไม่ได้">
        </div>

        <div class="approval-group">
          <label for="approval-date">วันที่พิจารณา:</label>
          <input type="date" id="approval-date" v-model="form.date">
        </div>
      </div>

      <div class="approval-group">
        <label>ลายเซ็นผู้พิจารณา:</label>
        <SignaturePad v-model="form.signature" :disabled="!canApprove" />
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

  <div v-else>
    <div class="approval-title">
      <div>ส่วนการตรวจสอบและอนุมัติ (Approval Status)</div>
      <span class="note">ผลการพิจารณาถูกบันทึกแล้ว ไม่สามารถแก้ไขได้</span>
    </div>

    <fieldset disabled class="approval-fieldset">
      <div class="approval-group">
        <label>ความเห็นของผู้ประเมิน:</label>
        <input type="text" :value="latestApproval && latestApproval.comment || '-'" readonly>
      </div>

      <div class="approval-group">
        <label>ผลการพิจารณา:</label>
        <input type="text" :value="latestApproval ? resultLabel(latestApproval.result) : '-'" readonly>
      </div>

      <div class="grid-2col" style="margin-top: 10px;">
        <div class="approval-group">
          <label>ผู้อนุมัติ (Approver):</label>
          <input type="text" :value="latestApproval && latestApproval.approver || '-'" readonly>
        </div>

        <div class="approval-group">
          <label>วันที่พิจารณา:</label>
          <input type="text" :value="latestApproval && latestApproval.approval_date || '-'" readonly>
        </div>
      </div>

      <div class="approval-group">
        <label>ลายเซ็นผู้พิจารณา:</label>
        <div class="signature-readonly">
          <img v-if="latestApproval && latestApproval.signature" :src="latestApproval.signature" alt="ลายเซ็นผู้พิจารณา">
          <span v-else class="note">ไม่มีลายเซ็นบันทึกไว้</span>
        </div>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.approval-title {
  background: linear-gradient(135deg, #5a0000, #00075a);
  color: #fafafa;
  padding: 10px 14px;
  font-size: 20px;
  font-weight: 700;
  border-radius: 6px;
  margin: 25px 0 15px 0;
  border-left: 5px solid #000000;
  display: flex;
  justify-content: center;
}

.approval-title .note {
  font-size: 14px;
  color: #9ca3af;
  font-weight: 400;
}

label {
  display: block;
  margin-bottom: 15px;
  font-size: 20px;
}

input[type="text"],
select,
textarea {
  width: 100%;
  padding: 10px 20px;
  border: 1.5px solid #767477e1;
  border-radius: 8px;
  font-size: 18px;
  background-color: #fbfbffa9;
  outline: none;
  transition: all 0.3s;
}

input[type="date"],
input[type="time"],
select {
  width: 200px;
  padding: 10px 20px;
  border: 1.5px solid #767477e1;
  border-radius: 8px;
  font-size: 20px;
  background-color: #fbfbffa9;
  transition: all 0.3s;
}

input[type="text"]:focus,
textarea:focus,
select:focus {
  border-color: #465f86;
  box-shadow: 0 0 0 3px rgba(30, 30, 31, 0.15);
}

.approval-fieldset {
  border: none;
}

.approval-fieldset:disabled input,
.approval-fieldset:disabled select,
.approval-fieldset:disabled textarea {
  background-color: #bfc0c2;
  color: #6b7280;
  cursor: not-allowed;
}

.approval-group {
  margin-bottom: 15px;
  font-size: 26px;
}

.options-group {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.signature-readonly {
  border: 1.5px solid #767477e1;
  border-radius: 8px;
  background-color: #fbfbffa9;
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.signature-readonly img {
  max-height: 100px;
  max-width: 100%;
}

.signature-readonly .note {
  font-size: 16px;
  color: #6b7280;
}
</style>
