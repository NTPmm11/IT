<script>
import { apiFetch } from "../services/api.js";
import { commonMethods } from "../services/commonActions.js";
import StatusModal from "../components/StatusModal.vue";
import DateInputTH from "../components/DateInputTH.vue";

let rowUid = 0;
function makeRow() {
  return { uid: ++rowUid, step: "", startDate: "", start: "", endDate: "", end: "", owner: "", note: "" };
}

export default {
  components: { StatusModal, DateInputTH },

  data() {
    return {
      form: {
        requestDate: "",
        requester: "",
        department: "",
        system: "",
        contact: "",
        priority: "Low",
        subject: "",
        problem: "",
        request: "",
        changeTypes: [],
        impact: "none",
        impactDetail: "",
        downtime: false,
        duration: "",
        deployDate: ""
      },

      planRows: [makeRow()],
      rollbackRows: [makeRow()],
      systems: [],
      submittedCrNumber: "",
      savedCrId: null,
      previewCrNumber: "",
      submitting: false,
      modal: { show: false, variant: "success", title: "", message: "" }
    };
  },

  mounted() {
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }
    this.initForm();
  },

  computed: {
    isSaved() {
      return this.savedCrId !== null;
    }
  },

  methods: {
    ...commonMethods,

    async initForm() {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      this.form.requester = user.fullName || "";
      this.form.department = user.department || "";
      this.form.requestDate = new Date().toLocaleDateString("sv-SE");

      try {
        this.systems = await apiFetch("/systems");
      } catch (err) {
        console.error(err);
      }

      try {
        const next = await apiFetch("/change-requests/next-number");
        this.previewCrNumber = next.crNumber;
      } catch (err) {
        console.error(err);
      }
    },

    addPlanRow() {
      this.planRows.push(makeRow());
    },

    deletePlanRow(index) {
      if (this.planRows.length > 1) {
        this.planRows.splice(index, 1);
      } else {
        alert("ต้องมีแผนดำเนินงานอย่างน้อย 1 ขั้นตอน");
      }
    },

    addRollbackRow() {
      this.rollbackRows.push(makeRow());
    },

    deleteRollbackRow(index) {
      if (this.rollbackRows.length > 1) {
        this.rollbackRows.splice(index, 1);
      } else {
        alert("ต้องมีแผนดำเนินงานอย่างน้อย 1 ขั้นตอน");
      }
    },

    validateForm() {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRe = /^0\d{8,9}$/;
      const contact = this.form.contact.trim();
      if (!contact || (!emailRe.test(contact) && !phoneRe.test(contact))) {
        return "อีเมล/เบอร์โทร ไม่ถูกต้อง (ใส่อีเมล หรือเบอร์โทรขึ้นต้น 0 จำนวน 9-10 หลัก)";
      }
      if (this.form.changeTypes.length === 0) {
        return "กรุณาเลือกประเภทการเปลี่ยนอย่างน้อย 1 อย่าง";
      }
      if (this.form.impact === "other" && !this.form.impactDetail.trim()) {
        return "กรุณาระบุระบบที่ได้รับผลกระทบ";
      }
      if (!this.form.duration.trim()) {
        return "กรุณาระบุระยะเวลาที่คาดใช้";
      }
      if (!this.form.deployDate) {
        return "กรุณาระบุเป้าหมาย Deploy";
      }
      return "";
    },

    combineRow(row) {
      const start = row.startDate && row.start ? `${row.startDate} ${row.start}` : (row.start || row.startDate || "");
      const end = row.endDate && row.end ? `${row.endDate} ${row.end}` : (row.end || row.endDate || "");
      return { step: row.step, start, end, owner: row.owner, note: row.note };
    },

    planRowsToSend(rows) {
      return rows
        .map(this.combineRow)
        .filter(row => [row.step, row.start, row.end, row.owner, row.note]
          .some(value => String(value ?? "").trim() !== ""));
    },

    buildPayload(status) {
      return {
        requestDate: this.form.requestDate,
        department: this.form.department,
        systemCode: this.form.system,
        contact: this.form.contact,
        priority: this.form.priority,
        subject: this.form.subject,
        problem: this.form.problem,
        requestDetail: this.form.request,
        impact: this.form.impact,
        impactDetail: this.form.impactDetail,
        downtime: this.form.downtime,
        duration: this.form.duration,
        deployDate: this.form.deployDate,
        changeTypes: this.form.changeTypes,
        plan: this.planRowsToSend(this.planRows),
        rollbackPlan: this.planRowsToSend(this.rollbackRows),
        status
      };
    },

    async handleSubmit() {
      if (this.submitting || this.isSaved) return;

      const validationError = this.validateForm();
      if (validationError) {
        this.modal = { show: true, variant: "error", title: "กรอกข้อมูลไม่ครบ", message: validationError };
        return;
      }

      this.submitting = true;
      try {
        const data = await apiFetch("/change-requests", {
          method: "POST",
          body: JSON.stringify(this.buildPayload("submitted"))
        });

        this.savedCrId = data.crId;
        this.submittedCrNumber = data.crNumber;
        this.modal = {
          show: true,
          variant: "success",
          title: "ส่งคำขออนุมัติแล้ว",
          message: `ระบบได้ส่งคำขอ Change Request (CR) เข้าสู่ขั้นตอนการอนุมัติแล้ว\nเลขที่เอกสาร: ${data.crNumber}`
        };
        setTimeout(() => this.$router.push("/list"), 2500);
      } catch (err) {
        this.modal = { show: true, variant: "error", title: "บันทึกไม่สำเร็จ", message: err.message };
      } finally {
        this.submitting = false;
      }
    },

    async handleSaveDraft() {
      if (this.submitting || this.isSaved) return;

      this.submitting = true;
      try {
        const data = await apiFetch("/change-requests", {
          method: "POST",
          body: JSON.stringify(this.buildPayload("draft"))
        });
        this.savedCrId = data.crId;
        this.submittedCrNumber = data.crNumber;
        this.modal = {
          show: true,
          variant: "success",
          title: "บันทึกร่างสำเร็จ",
          message: `บันทึกแบบร่างไว้แล้ว ยังไม่ส่งเข้าขั้นตอนอนุมัติ\nเลขที่เอกสาร: ${data.crNumber}`
        };
      } catch (err) {
        this.modal = { show: true, variant: "error", title: "บันทึกร่างไม่สำเร็จ", message: err.message };
      } finally {
        this.submitting = false;
      }
    },

    startNewForm() {
      Object.assign(this.$data, this.$options.data.call(this));
      this.initForm();
      this.$nextTick(() => this.$el.scrollIntoView({ behavior: "smooth" }));
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

    <button type="button" class="btn-back" @click="$router.push('/home')">
      <i class="fa-solid fa-arrow-left"></i> กลับหน้าหลัก
    </button>

    <form @submit.prevent="handleSubmit">
      <div class="section-title">
        <div>1. ข้อมูลทั่วไป (General Information)</div>
      </div>

      <div class="grid-2col">
        <div class="form-group">
          <label for="cr-request-date">วันที่ร้องขอ:</label>
          <DateInputTH id="cr-request-date" v-model="form.requestDate" />
        </div>

        <div class="form-group">
          <label for="cr-requester">ผู้ร้องขอ (Requester):</label>
          <input type="text" id="cr-requester" :value="form.requester" readonly
            title="ระบบใช้ชื่อผู้ใช้ที่เข้าสู่ระบบอยู่ แก้ไม่ได้">
        </div>

        <div class="form-group">
          <label for="cr-department">แผนก/ฝ่าย:</label>
          <input type="text" id="cr-department" v-model="form.department" placeholder="ระบุแผนก/ฝ่าย">
        </div>

        <div class="form-group">
          <label for="cr-system">ระบบที่เกี่ยวข้อง:</label>
          <select id="cr-system" v-model="form.system" required>
            <option value="">-- เลือกโครงการ/ระบบงาน --</option>
            <option v-for="s in systems" :key="s.system_code" :value="s.system_code">
              {{ s.system_name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="cr-contact">อีเมล/เบอร์โทร:</label>
          <input type="text" id="cr-contact" v-model="form.contact" placeholder="ระบุอีเมลหรือเบอร์โทรติดต่อ">
        </div>
      </div>

      <div class="form-group" style="margin-top:20px;">
        <label>ระดับความสำคัญ (Priority):</label>
        <div class="options-group" style="display: flex; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; gap: 15px; width: 100%;">
            <label class="option-item" style="flex: 1;">
              <input type="radio" value="Low" v-model="form.priority"> Low (ไม่กระทบงานหลัก)
            </label>
            <label class="option-item" style="flex: 1;">
              <input type="radio" value="Medium" v-model="form.priority"> Medium (มีระบบสำรอง)
            </label>
          </div>
          <div style="display: flex; gap: 20px; width: 100%;">
            <label class="option-item" style="flex: 1;">
              <input type="radio" value="High" v-model="form.priority"> High (เร่งด่วน)
            </label>
            <label class="option-item" style="flex: 1;">
              <input type="radio" value="Critical" v-model="form.priority"> Critical (ระบบหยุดทำงาน)
            </label>
          </div>
        </div>
      </div>

      <div class="section-title">
        <div>2. รายละเอียดการขอเปลี่ยนระบบ (Change Details)</div>
        <span class="note">*ส่วนสำหรับผู้ร้องขอกรอก</span>
      </div>

      <div class="form-group">
        <label for="cr-subject">หัวข้อการเปลี่ยน (Subject):</label>
        <input type="text" id="cr-subject" v-model="form.subject"
          placeholder="ระบุชื่อเรื่อง เช่น เพิ่มปุ่มดาวน์โหลดรายงาน PDF ในหน้า Dashboard..." required>
      </div>

      <div class="form-group align-top">
        <label for="cr-problem">สถานะปัจจุบัน / ปัญหาที่พบ:</label>
        <textarea id="cr-problem" v-model="form.problem" rows="3"
          placeholder="อธิบายสภาพปัญหาปัจจุบัน หรือเหตุผลความจำเป็น..."></textarea>
      </div>

      <div class="form-group align-top">
        <label for="cr-request">สิ่งที่ต้องการให้ปรับปรุง:</label>
        <textarea id="cr-request" v-model="form.request" rows="3"
          placeholder="ระบุรายละเอียด เงื่อนไข หรือขั้นตอนของระบบใหม่ที่ต้องการให้พัฒนา..."></textarea>
      </div>

      <div class="section-title">
        <div>3. การประเมินผลกระทบและทรัพยากร (Impact & Resource Assessment)</div>
      </div>

      <fieldset class="section3-fieldset">
        <div class="form-group">
          <label>ประเภทการเปลี่ยน:</label>
          <div class="options-group">
            <label class="option-item"><input type="checkbox" value="App" v-model="form.changeTypes"> Application / Software</label>
            <label class="option-item"><input type="checkbox" value="DB" v-model="form.changeTypes"> Database</label>
            <label class="option-item"><input type="checkbox" value="Infra" v-model="form.changeTypes"> Infrastructure</label>
          </div>
        </div>

        <div class="form-group">
          <label>ผลกระทบระบบ:</label>
          <div class="options-group">
            <label class="option-item"><input type="radio" value="none" v-model="form.impact"> ไม่มีผลกระทบส่วนอื่น</label>
            <label class="option-item"><input type="radio" value="other" v-model="form.impact"> กระทบระบบอื่น (ระบุ):</label>
            <input type="text" v-model="form.impactDetail" :disabled="form.impact !== 'other'"
              placeholder="ระบุระบบที่ได้รับผลกระทบ...">
            <label class="option-item"><input type="checkbox" v-model="form.downtime"> ต้องปิดระบบชั่วคราว (Downtime)</label>
          </div>
        </div>

        <div class="grid-2col" style="margin-top: 10px;">
          <div class="form-group">
            <label for="cr-duration">ระยะเวลาที่คาดใช้:</label>
            <input type="text" id="cr-duration" v-model="form.duration" placeholder="ระบุจำนวนวันทำการ เช่น 2 วัน" required>
          </div>
          <div class="form-group">
            <label for="cr-deploy-date">เป้าหมาย Deploy:</label>
            <DateInputTH id="cr-deploy-date" v-model="form.deployDate" required />
          </div>
        </div>
      </fieldset>

      <div class="section-title">
        <div>แผนดำเนินงาน (Action Plan)</div>
        <span class="note">*โปรดระบุขั้นตอนและกำหนดเวลาปฏิบัติงาน</span>
      </div>

      <div class="table-wrapper">
        <table class="action-table">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>ขั้นตอนงาน</th>
              <th>หมายเหตุ</th>
              <th>ลบ</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(planRow, index) in planRows" :key="planRow.uid">
              <tr>
                <td rowspan="2" class="text-center">{{ index + 1 }}</td>
                <td><input type="text" v-model="planRow.step" placeholder="ระบุขั้นตอนงาน" required></td>
                <td><input type="text" v-model="planRow.note" placeholder="หมายเหตุ"></td>
                <td rowspan="2" class="text-center">
                  <button type="button" class="btn-delete-row" @click="deletePlanRow(index)">ลบ</button>
                </td>
              </tr>
              <tr class="row-datetime">
                <td colspan="2">
                  <div class="datetime-group">
                    <span class="dt-label">เริ่ม</span>
                    <DateInputTH v-model="planRow.startDate" required />
                    <input type="time" v-model="planRow.start" required>
                    <span class="dt-label">สิ้นสุด</span>
                    <DateInputTH v-model="planRow.endDate" required />
                    <input type="time" v-model="planRow.end" required>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <button type="button" class="btn-add-row" @click="addPlanRow">
          + เพิ่มขั้นตอนงาน
        </button>
      </div>

      <div class="section-title">
        <div>แผนการกู้คืน (Roll Back Plan)</div>
        <span class="note">*ไม่บังคับ — กรอกเมื่อมีแผนกู้คืน</span>
      </div>

      <table class="action-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ขั้นตอนงาน</th>
            <th>หมายเหตุ</th>
            <th>ลบ</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(rollbackRow, index) in rollbackRows" :key="rollbackRow.uid">
            <tr>
              <td rowspan="2" class="text-center">{{ index + 1 }}</td>
              <td><input type="text" v-model="rollbackRow.step" placeholder="ระบุขั้นตอนงาน (ไม่บังคับ)"></td>
              <td><input type="text" v-model="rollbackRow.note" placeholder="หมายเหตุ"></td>
              <td rowspan="2" class="text-center">
                <button type="button" class="btn-delete-row" @click="deleteRollbackRow(index)">ลบ</button>
              </td>
            </tr>
            <tr class="row-datetime">
              <td colspan="2">
                <div class="datetime-group">
                  <span class="dt-label">เริ่ม</span>
                  <DateInputTH v-model="rollbackRow.startDate" :required="!!rollbackRow.step" />
                  <input type="time" v-model="rollbackRow.start" :required="!!rollbackRow.step">
                  <span class="dt-label">สิ้นสุด</span>
                  <DateInputTH v-model="rollbackRow.endDate" :required="!!rollbackRow.step" />
                  <input type="time" v-model="rollbackRow.end" :required="!!rollbackRow.step">
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <button type="button" class="btn-add-row" @click="addRollbackRow">
        + เพิ่มขั้นตอนงาน
      </button>

      <div class="ui-action-buttons">
        <button type="button" class="btn btn-cancel-maroon" @click="cancelForm">
          <i class="fa-solid fa-xmark"></i> ยกเลิก (Cancel)
        </button>

        <button type="button" class="btn btn-draft" @click="handleSaveDraft" :disabled="submitting || isSaved">
          <i class="fa-solid fa-floppy-disk"></i>
          {{ submitting ? "กำลังบันทึก..." : "บันทึกร่าง (Save Draft)" }}
        </button>

        <button type="submit" class="btn btn-submit" :disabled="submitting || isSaved">
          <i class="fa-solid fa-paper-plane"></i>
          {{ submitting ? "กำลังส่ง..." : "ส่งคำขออนุมัติ (Submit CR)" }}
        </button>
      </div>

      <p v-if="isSaved" class="saved-hint">
        บันทึกเลขที่ {{ submittedCrNumber }} ลงระบบแล้ว — กดซ้ำจะได้ CR คนละใบ
        <a href="#" @click.prevent="startNewForm">เริ่มคำขอใบใหม่</a>
      </p>
    </form>

    <StatusModal :show="modal.show" :variant="modal.variant" :title="modal.title" :message="modal.message"
      @close="modal.show = false" />
  </div>
</template>

<style scoped>
@import '../assets/css/form.css';

.section3-fieldset {
  border: none;
  padding: 0;
  margin: 0;
}

.saved-hint {
  margin-top: 10px;
  font-size: 13.5px;
  color: #6b7280;
  text-align: right;
}

.saved-hint a {
  color: #00075a;
  font-weight: 600;
}
</style>