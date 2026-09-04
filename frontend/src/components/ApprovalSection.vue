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
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง (import ไฟล์นี้): views/FormView.vue (ต่อท้ายฟอร์มหลัง submit สำเร็จ) และ
//                          views/ApproveView.vue (เปิดตรงจากลิงก์ในเมล /approve?crId=)
//                          ทั้งสองส่ง prop crId เข้ามา — component นี้ไม่รู้จัก URL/route เลย
// ปลายทาง: services/api.js (apiFetch) -> backend routes/cr.js POST /:id/approval
//          + components/StatusModal.vue (โชว์ผลสำเร็จ/พลาด)
// แยกเป็น component ต่างหาก (ไม่เขียนสดใน FormView/ApproveView) เพราะ "ฟอร์มอนุมัติ" หน้าตา
// เดียวกันเป๊ะ ต้องใช้ซ้ำ 2 ที่ — เขียนซ้ำสองรอบเสี่ยงแก้ไม่ครบเวลามีบั๊ก/เปลี่ยนฟิลด์

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
        result: "",     // approved / rejected / more-info
        approver: user.fullName || "",
        date: ""
      },
      submitting: false, // true ระหว่างรอ backend ตอบ — คุมปุ่ม disable/ข้อความ
      modal: { show: false, variant: "success", title: "", message: "" }
    };
  },

  computed: {
    // requester = ดูได้อย่างเดียว
    canApprove() {
      return ["approver", "it_admin"].includes(this.user.role);
    }
  },

  methods: {
    // UX: submitting คุมปุ่ม disable/ข้อความระหว่างรอ backend ตอบ กันคนกดซ้ำ
    // สำเร็จ/พลาด ใช้ StatusModal แทน alert() ทั้งคู่
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

    <!-- [ 5. การตรวจสอบและอนุมัติ ] -->
    <div class="approval-title">
      <div>ส่วนการตรวจสอบและอนุมัติ (Approval Status)</div>
      <span class="note" v-if="canApprove">*เฉพาะสิทธิ์ Approver / PM</span>
      <span class="note" v-else>*เฉพาะสิทธิ์ Approver / PM — คุณดูได้อย่างเดียว</span>
    </div>

    <!-- fieldset disabled = ปิดทุก input/radio ข้างในทีเดียว -->
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
          <!-- อ่านอย่างเดียว: backend บันทึก approver_id จาก user ที่ login เสมอ
               (routes/cr.js ไม่รับชื่อผู้อนุมัติจาก body) พิมพ์แก้ตรงนี้ค่าจะถูกทิ้ง -->
          <input type="text" id="approver-name" :value="form.approver" readonly
            title="ระบบใช้ชื่อผู้ใช้ที่เข้าสู่ระบบอยู่ แก้ไม่ได้">
        </div>
        
        <div class="approval-group">
          <label for="approval-date">วันที่พิจารณา:</label>
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
</style>
