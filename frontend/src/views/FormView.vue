<script>

import { apiFetch } from "../services/api.js";
import { commonMethods } from "../services/commonActions.js";
import ApprovalSection from "../components/ApprovalSection.vue";
import StatusModal from "../components/StatusModal.vue";

export default {
  components: { ApprovalSection, StatusModal },

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

      rows: [
        { step: "", startDate: "", start: "", endDate: "", end: "", owner: "", note: "" }
      ],
      rows2: [
        { step: "", startDate: "", start: "", endDate: "", end: "", owner: "", note: "" }
      ],

      systems: [],

      userRole: "",

      submittedCrId: null,
      submittedCrNumber: "",
      previewCrNumber: "",

      submitting: false,
      firstInvalidId: "",
      modal: { show: false, variant: "success", title: "", message: "" }
    };
  },

  async mounted() {
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    this.form.requester = user.fullName || "";
    this.form.department = user.department || "";
    this.userRole = user.role || "";

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

  computed: {
    canEditImpact() {
      return this.userRole === "it_admin";
    },

    planDuration() {
      const starts = this.rows.map(r => r.startDate).filter(Boolean);
      const ends = this.rows.map(r => r.endDate).filter(Boolean);
      if (starts.length === 0 || ends.length === 0) return "";

      const min = starts.reduce((a, b) => (a < b ? a : b));
      const max = ends.reduce((a, b) => (a > b ? a : b));

      const days = Math.round((new Date(max) - new Date(min)) / 86400000) + 1;
      return days > 0 ? `${days} วัน` : "";
    }
  },

  watch: {
    planDuration: {
      immediate: true,
      handler(value) {
        this.form.duration = value;
      }
    }
  },

  methods: {
    ...commonMethods,

    addRow() {
      this.rows.push({ step: "", startDate: "", start: "", endDate: "", end: "", owner: "", note: "" });
    },

    deleteRow(index) {
      if (this.rows.length > 1) {
        this.rows.splice(index, 1);
      } else {
        alert("ต้องมีแผนดำเนินงานอย่างน้อย 1 ขั้นตอน");
      }
    },

    addRow2() {
      this.rows2.push({ step: "", startDate: "", start: "", endDate: "", end: "", owner: "", note: "" });
    },

    deleteRow2(index) {
      if (this.rows2.length > 1) {
        this.rows2.splice(index, 1);
      } else {
        alert("ต้องมีแผนดำเนินงานอย่างน้อย 1 ขั้นตอน");
      }
    },

    validateForm() {
      const problems = [];
      const fail = (id, message) => problems.push({ id, message });

      if (!this.form.requestDate) fail("cr-request-date", "วันที่ร้องขอ: ยังไม่ได้เลือก");
      if (!this.form.requester.trim()) fail("cr-requester", "ผู้ร้องขอ: ยังไม่ได้กรอก");
      if (!this.form.department.trim()) fail("cr-department", "แผนก/ฝ่าย: ยังไม่ได้กรอก");
      if (!this.form.system) fail("cr-system", "ระบบที่เกี่ยวข้อง: ยังไม่ได้เลือก");

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRe = /^0\d{8,9}$/;
      const extRe = /^\d{4}$/;
      const contact = this.form.contact.trim();
      if (!contact) {
        fail("cr-contact", "อีเมล/เบอร์โทร: ยังไม่ได้กรอก");
      } else if (!emailRe.test(contact) && !phoneRe.test(contact) && !extRe.test(contact)) {
        fail("cr-contact", `อีเมล/เบอร์โทร: "${contact}" ไม่ตรงรูปแบบ (อีเมล, เบอร์โทรขึ้นต้น 0 จำนวน 9-10 หลัก หรือเบอร์โต๊ะ 4 หลัก)`);
      }

      if (!this.form.subject.trim()) fail("cr-subject", "หัวข้อการเปลี่ยน: ยังไม่ได้กรอก");

      this.checkPlanRows(this.rows, "plan", "แผนดำเนินงาน (ข้อ 4)", problems);
      this.checkPlanRows(this.rows2, "rollback", "แผนการกู้คืน (ข้อ 5)", problems);

      if (this.canEditImpact) {
        if (this.form.changeTypes.length === 0) {
          fail("cr-change-types", "ประเภทการเปลี่ยน: ยังไม่ได้เลือกสักอย่าง");
        }
        if (this.form.impact === "other" && !this.form.impactDetail.trim()) {
          fail("cr-impact-detail", "ระบบที่ได้รับผลกระทบ: เลือก \"กระทบระบบอื่น\" แล้วแต่ยังไม่ได้ระบุ");
        }
        if (!this.planDuration) {
          fail("cr-duration", "ระยะเวลาที่คาดใช้: คำนวณไม่ได้ เพราะวันที่ในแผนดำเนินงาน (ข้อ 4) ยังไม่ครบ");
        }
        if (!this.form.deployDate) {
          fail("cr-deploy-date", "เป้าหมาย Deploy: ยังไม่ได้เลือก");
        }
      }

      return problems;
    },

    checkPlanRows(rows, prefix, label, problems) {
      rows.forEach((row, i) => {
        const at = `${label} ขั้นที่ ${i + 1}`;
        const id = field => `${prefix}-${i}-${field}`;

        if (!row.step.trim()) problems.push({ id: id("step"), message: `${at}: ยังไม่ได้กรอกขั้นตอนงาน` });
        if (!row.startDate) problems.push({ id: id("startDate"), message: `${at}: ยังไม่ได้เลือกวันที่เริ่ม` });
        if (!row.start) problems.push({ id: id("start"), message: `${at}: ยังไม่ได้เลือกเวลาเริ่ม` });
        if (!row.endDate) problems.push({ id: id("endDate"), message: `${at}: ยังไม่ได้เลือกวันที่สิ้นสุด` });
        if (!row.end) problems.push({ id: id("end"), message: `${at}: ยังไม่ได้เลือกเวลาสิ้นสุด` });

        if (row.startDate && row.endDate) {
          if (row.endDate < row.startDate) {
            problems.push({ id: id("endDate"), message: `${at}: วันสิ้นสุด (${row.endDate}) มาก่อนวันเริ่ม (${row.startDate})` });
          } else if (row.endDate === row.startDate && row.start && row.end && row.end < row.start) {
            problems.push({ id: id("end"), message: `${at}: เวลาสิ้นสุด (${row.end}) มาก่อนเวลาเริ่ม (${row.start})` });
          }
        }
      });
    },

    markInvalid(problems) {
      document.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
      problems.forEach(p => document.getElementById(p.id)?.classList.add("is-invalid"));
      this.firstInvalidId = problems.length ? problems[0].id : "";
    },

    combineRow(row) {
      const start = row.startDate && row.start ? `${row.startDate} ${row.start}` : (row.start || row.startDate || "");
      const end = row.endDate && row.end ? `${row.endDate} ${row.end}` : (row.end || row.endDate || "");
      return { step: row.step, start, end, owner: row.owner, note: row.note };
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
        plan: this.rows.map(this.combineRow),
        rollbackPlan: this.rows2.map(this.combineRow),
        status
      };
    },

    async handleSubmit() {
      const problems = this.validateForm();
      this.markInvalid(problems);
      if (problems.length) {
        this.modal = {
          show: true,
          variant: "error",
          title: `กรอกข้อมูลไม่ครบ (${problems.length} จุด)`,
          message: problems.map((p, i) => `${i + 1}. ${p.message}`).join("\n")
        };
        return;
      }

      this.submitting = true;
      try {
        const data = await apiFetch("/change-requests", {
          method: "POST",
          body: JSON.stringify(this.buildPayload("submitted"))
        });

        this.submittedCrId = data.crId;
        this.submittedCrNumber = data.crNumber;
        this.modal = {
          show: true,
          variant: "success",
          title: "ส่งคำขอสำเร็จ",
          message: `ระบบได้ส่งคำขอ Change Request (CR) เข้าสู่ขั้นตอนการอนุมัติแล้ว\nเลขที่เอกสาร: ${data.crNumber}`
        };
      } catch (err) {
        this.modal = { show: true, variant: "error", title: "บันทึกไม่สำเร็จ", message: err.message };
      } finally {
        this.submitting = false;
      }
    },

    async handleSaveDraft() {
      this.submitting = true;
      try {
        const data = await apiFetch("/change-requests", {
          method: "POST",
          body: JSON.stringify(this.buildPayload("draft"))
        });
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

    closeModal() {
      this.modal.show = false;

      if (this.firstInvalidId) {
        const el = document.getElementById(this.firstInvalidId);
        this.firstInvalidId = "";
        if (el) {
          this.$nextTick(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.focus({ preventScroll: true });
          });
          return;
        }
      }

      if (this.submittedCrId) {
        this.$nextTick(() => {
          this.$refs.approvalSection?.$el.scrollIntoView({ behavior: "smooth" });
        });
      }
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

    <form @submit.prevent="handleSubmit" novalidate>

      <div class="section-title">
        <div>1. ข้อมูลทั่วไป (General Information)</div>
      </div>

      <div class="grid-2col">

        <div class="form-group">
          <label for="cr-request-date">วันที่ร้องขอ:</label>
          <input type="date" id="cr-request-date" v-model="form.requestDate">
        </div>

        <div class="form-group">
          <label for="cr-requester">ผู้ร้องขอ (Requester):</label>
          <input type="text" id="cr-requester" v-model="form.requester" placeholder="ชื่อ-สกุลผู้ร้องขอ">
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
          <input type="text" id="cr-contact" v-model="form.contact" placeholder="อีเมล, เบอร์โทร หรือเบอร์โต๊ะ 4 หลัก">
        </div>

      </div>

      <div class="form-group" style="margin-top: 10px;">
        <label>ระดับความสำคัญ (Priority):</label>
        <div class="options-group">
          <label class="option-item"><input type="radio" value="Low" v-model="form.priority"> Low
            (ไม่กระทบงานหลัก)</label>
          <label class="option-item"><input type="radio" value="Medium" v-model="form.priority"> Medium
            (มีระบบสำรอง)</label>
          <label class="option-item"><input type="radio" value="High" v-model="form.priority"> High (เร่งด่วน)</label>
          <label class="option-item"><input type="radio" value="Critical" v-model="form.priority"> Critical
            (ระบบหยุดทำงาน)</label>
        </div>
      </div>

      <div class="section-title">
        <div>2. รายละเอียดการขอเปลี่ยนระบบ (Change Details)</div>
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
        <span class="note" v-if="!canEditImpact">*คุณดูได้อย่างเดียว</span>
      </div>

      <fieldset :disabled="!canEditImpact" class="section3-fieldset">

      <div class="form-group">
        <label>ประเภทการเปลี่ยน:</label>
        <div class="options-group" id="cr-change-types" tabindex="-1">
          <label class="option-item"><input type="checkbox" value="App" v-model="form.changeTypes"> Application /
            Software</label>
          <label class="option-item"><input type="checkbox" value="DB" v-model="form.changeTypes"> Database</label>
          <label class="option-item"><input type="checkbox" value="Infra" v-model="form.changeTypes">
            Infrastructure</label>
        </div>
      </div>

      <div class="form-group">
        <label>ผลกระทบระบบ:</label>
        <div class="options-group">
          <label class="option-item"><input type="radio" value="none" v-model="form.impact">
            ไม่มีผลกระทบส่วนอื่น</label>
          <label class="option-item"><input type="radio" value="other" v-model="form.impact"> กระทบระบบอื่น
            (ระบุ):</label>
          <input type="text" id="cr-impact-detail" v-model="form.impactDetail" :disabled="!canEditImpact || form.impact !== 'other'"
            placeholder="ระบุระบบที่ได้รับผลกระทบ...">
          <label class="option-item"><input type="checkbox" v-model="form.downtime"> ต้องปิดระบบชั่วคราว
            (Downtime)</label>
        </div>
      </div>

      <div class="grid-2col" style="margin-top: 10px;">
        <div class="form-group">
          <label for="cr-duration">ระยะเวลาที่คาดใช้:</label>
          <input type="text" id="cr-duration" :value="planDuration" readonly placeholder="คำนวณจากวันที่ในข้อ 4 อัตโนมัติ" title="คำนวณจากวันที่เริ่ม-สิ้นสุดในแผนดำเนินงาน (ข้อ 4)">

          <small class="field-hint">คำนวณอัตโนมัติจากวันที่เริ่ม–สิ้นสุดในข้อ 4</small>
        </div>
        <div class="form-group">
          <label for="cr-deploy-date">เป้าหมาย Deploy:</label>
          <input type="date" id="cr-deploy-date" v-model="form.deployDate" :required="canEditImpact">
        </div>
      </div>

      </fieldset>

      <div class="section-title">
        <div>4. แผนดำเนินงาน (Action Plan)</div>
        <span class="note">*โปรดระบุขั้นตอนและกำหนดเวลาปฏิบัติงาน</span>
      </div>

      <div class="table-wrapper plan-cards-wrap">
        <table class="action-table">
          <thead>
    <tr>
      <th style="width: 40px;">ลำดับ</th>
      <th style="width: 250px;">ขั้นตอนงาน</th>
      <th style="width: 95px;">วัน/เดือน/ปี</th>
      <th style="width: 85px;">เวลาเริ่ม</th>
      <th style="width: 95px;">วัน/เดือน/ปี</th>
      <th style="width: 85px;">สิ้นสุด</th>
      <th>หมายเหตุ</th>
      <th style="width: 50px;">ลบ</th>
    </tr>
  </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="index">
              <td class="text-center" data-label="ลำดับ">{{ index + 1 }}</td>
              <td data-label="ขั้นตอนงาน"><input type="text" :id="'plan-' + index + '-step'" v-model="row.step" placeholder="ระบุขั้นตอนงาน" required></td>
              <td data-label="วันที่เริ่ม"><input type="date" :id="'plan-' + index + '-startDate'" v-model="row.startDate" required></td>
              <td data-label="เวลาเริ่ม"><input type="time" :id="'plan-' + index + '-start'" v-model="row.start" required></td>
              <td data-label="วันที่สิ้นสุด"><input type="date" :id="'plan-' + index + '-endDate'" v-model="row.endDate" required></td>
              <td data-label="เวลาสิ้นสุด"><input type="time" :id="'plan-' + index + '-end'" v-model="row.end" required></td>
              <td data-label="หมายเหตุ"><input type="text" v-model="row.note" placeholder="หมายเหตุ"></td>
              <td class="text-center" data-label="">
                <button type="button" class="btn-delete-row" @click="deleteRow(index)">ลบขั้นตอนนี้</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button type="button" class="btn-add-row" @click="addRow">
        + เพิ่มขั้นตอนงาน
      </button>

      <div class="section-title2 is-rollback">
        <div>5. แผนการกู้คืน (Roll Back Plan)</div>
        <span class="note">*ขั้นตอนย้อนกลับเมื่อเปลี่ยนแล้วไม่สำเร็จ</span>
      </div>

      <div class="table-wrapper plan-cards-wrap">
        <table class="action-table">
          <thead>
            <tr>
        <th style="width: 40px;">ลำดับ</th>
        <th style="width: 250px;">ขั้นตอนงาน</th>
        <th style="width: 95px;">วัน/เดือน/ปี</th>
        <th style="width: 85px;">เวลาเริ่ม</th>
        <th style="width: 95px;">วัน/เดือน/ปี</th>
        <th style="width: 85px;">สิ้นสุด</th>
        <th>หมายเหตุ</th>
        <th style="width: 50px;">ลบ</th>
      </tr>
    </thead>
          <tbody>
            <tr v-for="(row2, index) in rows2" :key="index">
              <td class="text-center" data-label="ลำดับ">{{ index + 1 }}</td>
              <td data-label="ขั้นตอนงาน"><input type="text" :id="'rollback-' + index + '-step'" v-model="row2.step" placeholder="ระบุขั้นตอนงาน" required></td>
              <td data-label="วันที่เริ่ม"><input type="date" :id="'rollback-' + index + '-startDate'" v-model="row2.startDate" required></td>
              <td data-label="เวลาเริ่ม"><input type="time" :id="'rollback-' + index + '-start'" v-model="row2.start" required></td>
              <td data-label="วันที่สิ้นสุด"><input type="date" :id="'rollback-' + index + '-endDate'" v-model="row2.endDate" required></td>
              <td data-label="เวลาสิ้นสุด"><input type="time" :id="'rollback-' + index + '-end'" v-model="row2.end" required></td>
              <td data-label="หมายเหตุ"><input type="text" v-model="row2.note" placeholder="หมายเหตุ"></td>
              <td class="text-center" data-label="">
                <button type="button" class="btn-delete-row" @click="deleteRow2(index)">ลบขั้นตอนนี้</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button type="button" class="btn-add-row" @click="addRow2">
        + เพิ่มขั้นตอนงาน
      </button>

      <div class="ui-action-buttons">
        <button type="button" class="btn btn-cancel2" @click="cancelForm">
          <i class="fa-solid fa-xmark"></i> ยกเลิก (Cancel)
        </button>

        <button type="button" class="btn btn-draft" @click="handleSaveDraft" :disabled="submitting">
          <i class="fa-solid fa-floppy-disk"></i>
          {{ submitting ? "กำลังบันทึก..." : "บันทึกร่าง (Save Draft)" }}
        </button>

        <button type="submit" class="btn btn-submit" :disabled="submitting">
          <i class="fa-solid fa-paper-plane"></i>
          {{ submitting ? "กำลังส่ง..." : "ส่งคำขออนุมัติ (Submit CR)" }}
        </button>
      </div>

    </form>

    <div class="no-print">
      <ApprovalSection v-if="submittedCrId" ref="approvalSection" :crId="submittedCrId" />
    </div>

    <StatusModal :show="modal.show" :variant="modal.variant" :title="modal.title" :message="modal.message"
      @close="closeModal" />
  </div>
</template>

<style scoped>
@import '../assets/css/form.css';

.section3-fieldset {
  border: none;
  padding: 0;
  margin: 0;
}

.section3-fieldset:disabled input,
.section3-fieldset:disabled select,
.section3-fieldset:disabled textarea {
  color: var(--ink-light);
  border-bottom-style: dashed;
  cursor: not-allowed;
}
</style>
