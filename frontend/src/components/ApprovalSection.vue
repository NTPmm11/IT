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

      <!-- ช่องลงชื่อท้ายหนังสือ — ชื่ออยู่บนเส้น ตำแหน่งอยู่ใต้ชื่อ วันที่ปิดท้าย
           ตำแหน่งชิดขวาตามแบบหนังสือ ไม่ใช่สองคอลัมน์เท่ากันอย่างช่องกรอกทั่วไป -->
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

/* ตำแหน่งอยู่ใต้เส้นลงชื่อเสมอ เยื้องให้ตรงกับความยาวของเส้น */
.signature-role {
  padding-left: 44px;
  margin-bottom: var(--quarter);
  font-size: 15px;
  color: var(--ink-light);
}
</style>
