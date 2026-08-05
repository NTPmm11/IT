<script>
// ============================================
// FormView.vue — เดิมคือ form.html + js/form.js
// ============================================
//
// ★ LAB 6 — ส่งฟอร์มลง database จริง (ต้องผ่าน LAB 1, 4B ฝั่ง backend ก่อน)
//
// ภาพรวมการทำงาน (ของเดิมที่ยังใช้อยู่):
// 1. ทุกช่องกรอกผูกกับตัวแปรใน form ผ่าน v-model
// 2. ตาราง action plan เก็บเป็น array ชื่อ rows แล้วให้ v-for วาดแถวตามข้อมูล
//    - เพิ่มแถว = push เข้า array / ลบแถว = splice ออก -> Vue วาดจอให้เอง
//
// ของใหม่ที่ LAB นี้ต้องทำ:
// - โหลด dropdown ระบบจาก API ตอนหน้าเปิด (mounted)
// - กด Submit แล้วส่งข้อมูลทั้งฟอร์มไปเก็บลง database
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- frontend/js/form.js
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: router/index.js -> path "/form" (lazy load) — HomeView.vue มีลิงก์มาที่นี่
// ปลายทาง:
//   services/api.js         apiFetch -> GET /api/systems (dropdown), GET /change-requests/next-number
//                            (preview เลขที่), POST /change-requests (submit จริง)
//   services/commonActions.js  ...commonMethods (cancelForm/generatePDF)
//   components/ApprovalSection.vue  โผล่ท้ายฟอร์มหลัง submit สำเร็จ (ส่ง crId ให้ผ่าน prop)
//   components/StatusModal.vue      โชว์ผล submit สำเร็จ/พลาด + error ตอน validate ฝั่งหน้าเว็บ

import { apiFetch } from "../services/api.js";
import { commonMethods } from "../services/commonActions.js";
import ApprovalSection from "../components/ApprovalSection.vue";
import StatusModal from "../components/StatusModal.vue";

export default {
  components: { ApprovalSection, StatusModal },

  data() {
    return {

      // ข้อมูลฟอร์มหลัก — 1 ตัวแปรต่อ 1 ช่องกรอก (ผูกด้วย v-model)
      form: {
        requestDate: "",    // วันที่ร้องขอ
        requester: "",      // ชื่อผู้ร้องขอ
        department: "",     // แผนก/ฝ่าย
        system: "",         // dropdown ระบบที่เกี่ยวข้อง
        contact: "",        // อีเมล/เบอร์โทร
        priority: "Low",    // radio — ค่าเริ่มต้นเลือก Low ไว้ก่อน
        subject: "",        // หัวข้อการเปลี่ยน
        problem: "",        // ปัญหาที่พบ
        request: "",        // สิ่งที่ต้องการให้ปรับปรุง
        changeTypes: [],    // checkbox หลายอัน — ติ๊กอันไหน ค่าเข้า array นี้
        impact: "none",     // radio ผลกระทบ — เริ่มที่ "ไม่มีผลกระทบ"
        impactDetail: "",   // ช่องระบุระบบที่กระทบ (เปิดใช้เมื่อ impact = "other")
        downtime: false,    // checkbox เดี่ยว — ติ๊ก = true
        duration: "",       // ระยะเวลาที่คาดใช้
        deployDate: ""      // เป้าหมาย deploy
      },

      // ตาราง action plan — 1 object ใน array = 1 แถวในตาราง
      // startDate/endDate แยกกันคนละช่อง (ของเดิมใช้ชื่อ Date ซ้ำกัน 2 ช่อง เลยเผลอผูกพร้อมกัน)
      rows: [
        { step: "", startDate: "", start: "", endDate: "", end: "", owner: "", note: "" }
      ],
      rows2: [
        { step: "", startDate: "", start: "", endDate: "", end: "", owner: "", note: "" }
      ],

      // ตัวเลือก dropdown ระบบ — LAB 6 จะโหลดจาก API มาใส่ตัวนี้
      // (เดิม form.html วาดด้วย v-for="s in systems" รอไว้แล้ว)
      systems: [],

      // role ของ user ที่ login อยู่ (เติมใน mounted จาก localStorage)
      // ใช้ล็อกส่วน "3. การประเมินผลกระทบและทรัพยากร" — เฉพาะสิทธิ์ it_admin เท่านั้น (ดู canEditImpact)
      userRole: "",

      // เลข CR หลัง submit สำเร็จ — มีค่าแล้วส่วนอนุมัติจะโผล่ท้ายหน้า
      submittedCrId: null,
      submittedCrNumber: "",   // เลขที่เอกสารจริง (backend generate ตอน submit จริง — authoritative)
      previewCrNumber: "",     // เลขที่ preview ตั้งแต่เปิดหน้า (อาจไม่ตรงเป๊ะถ้ามีคนอื่น submit แทรกก่อน)

      submitting: false, // true ระหว่างรอ backend ตอบ POST /change-requests — คุมปุ่ม disable/ข้อความ
      modal: { show: false, variant: "success", title: "", message: "" }
    };
  },

  // mounted() = ทำงานอัตโนมัติ 1 ครั้งตอนหน้าเปิดเสร็จ (ไม่ต้องมีใครกดอะไร)
  // async เพราะข้างในต้องรอ apiFetch คุยกับ backend ก่อน
  async mounted() {
    // ยังไม่เคย login (ไม่มี user เก็บใน localStorage) -> เด้งกลับหน้า login ทันที
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }

    // เอาชื่อ/แผนกจาก user ที่ login ไว้ มาเติมให้ในฟอร์มอัตโนมัติ (ไม่ต้องพิมพ์เอง)
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    this.form.requester = user.fullName || "";
    this.form.department = user.department || "";
    this.userRole = user.role || "";

    // วันที่ร้องขอ default เป็นวันนี้ — <input type="date"> ต้องการรูปแบบ YYYY-MM-DD
    this.form.requestDate = new Date().toLocaleDateString("sv-SE");

    // ★ LAB 6: โหลดรายชื่อระบบจาก GET /api/systems (LAB 1) มาใส่ dropdown
    // this.systems เปลี่ยนค่า -> Vue วาด <option v-for="s in systems"> ใหม่ให้เองอัตโนมัติ
    try {
      this.systems = await apiFetch("/systems");
    } catch (err) {
      console.error(err);
    }

    // preview เลขที่เอกสารให้เห็นตั้งแต่เปิดหน้า (ไม่ต้องรอ submit เสร็จ)
    try {
      const next = await apiFetch("/change-requests/next-number");
      this.previewCrNumber = next.crNumber;
    } catch (err) {
      console.error(err);
    }
  },

  computed: {
    // ส่วน "3. การประเมินผลกระทบและทรัพยากร" เฉพาะสิทธิ์ it_admin (ดู label ในฟอร์ม)
    // role อื่น (requester/approver) เห็นช่องพวกนี้แต่กรอกไม่ได้ (fieldset disabled ใน template)
    // backend กันซ้ำอีกชั้นแล้วเหมือนกัน (routes/cr.js: isItAdmin) — ฝั่งนี้แค่ทำ UX ให้ตรงสิทธิ์จริง
    canEditImpact() {
      return this.userRole === "it_admin";
    }
  },

  methods: {
    // ดึงปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) มาจาก services/commonActions.js
    ...commonMethods,

    // ปุ่ม "+ เพิ่มขั้นตอนงาน" (@click="addRow")
    addRow() {
      this.rows.push({ step: "", startDate: "", start: "", endDate: "", end: "", owner: "", note: "" });
    },

    // ปุ่ม "ลบ" ท้ายแถว (@click="deleteRow(index)")
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

    // ปุ่ม "ลบ" ท้ายแถว (@click="deleteRow2(index)")
    deleteRow2(index) {
      if (this.rows2.length > 1) {
        this.rows2.splice(index, 1);
      } else {
        alert("ต้องมีแผนดำเนินงานอย่างน้อย 1 ขั้นตอน");
      }
    },

    // เช็คช่องที่ required attribute เดี่ยวๆ คุมไม่ได้ (checkbox group / conditional field / format)
    // return string ข้อความ error ตัวแรกที่เจอ, ผ่านหมด return ""
    validateForm() {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRe = /^0\d{8,9}$/;
      const contact = this.form.contact.trim();
      if (!contact || (!emailRe.test(contact) && !phoneRe.test(contact))) {
        return "อีเมล/เบอร์โทร ไม่ถูกต้อง (ใส่อีเมล หรือเบอร์โทรขึ้นต้น 0 จำนวน 9-10 หลัก)";
      }
      // ช่องพวกนี้อยู่ใน section 3 (เฉพาะสิทธิ์ it_admin) — role อื่น field ถูก disable
      // ไว้เป็นค่า default เสมอ (v-model แก้ไม่ได้) เลยไม่บังคับกรอกกับ role อื่น
      // ไม่งั้น requester/approver submit CR ไม่ผ่านเลยสักใบ (validate ค่า default ที่ตัวเองแก้ไม่ได้)
      if (this.canEditImpact) {
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
      }
      return "";
    },

    // ตาราง action plan / rollback plan ให้กรอกวันที่กับเวลาแยกช่อง (startDate+start, endDate+end)
    // แต่ column ปลายทาง (cr_action_plans.start_date/end_date) เก็บได้ช่องเดียว (NVARCHAR)
    // เลยรวมวันที่+เวลาเป็นข้อความเดียวก่อนส่ง กันวันที่หายตอน backend insert แค่ start/end
    combineRow(row) {
      const start = row.startDate && row.start ? `${row.startDate} ${row.start}` : (row.start || row.startDate || "");
      const end = row.endDate && row.end ? `${row.endDate} ${row.end}` : (row.end || row.endDate || "");
      return { step: row.step, start, end, owner: row.owner, note: row.note };
    },

    // รวม field ของฟอร์มเป็น payload เดียว ใช้ร่วมกันทั้ง submit จริงและ save draft
    // (ต่างกันแค่ status — backend ดูค่านี้ตัดสินว่าจะส่งเมลแจ้ง approver ไหม ดู routes/cr.js)
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
        rollbackPlan: this.rows2.map(this.combineRow),   // "แผนการกู้คืน" — backend เก็บลง cr_rollback_plans (คู่กับ cr_action_plans)
        status
      };
    },

    // ถูกเรียกตอนกดปุ่ม Submit (@submit.prevent="handleSubmit")
    // ★ LAB 6: ยิง POST /api/change-requests (LAB 4B ฝั่ง backend) พร้อมข้อมูลทั้งฟอร์ม
    //
    // UX: submitting คุมปุ่ม disable/ข้อความระหว่างรอ backend ตอบ กันคนกดซ้ำ/เข้าใจว่าไม่มีอะไรเกิดขึ้น
    // สำเร็จ/พลาด ใช้ StatusModal แทน alert() ทั้งคู่ — ให้ feedback ชัดเจน คุมสไตล์เองได้
    async handleSubmit() {
      const validationError = this.validateForm();
      if (validationError) {
        this.modal = { show: true, variant: "error", title: "กรอกข้อมูลไม่ครบ", message: validationError };
        return;
      }

      this.submitting = true;
      try {
        // key ฝั่งซ้าย (เช่น requestDate) ต้องตรงกับที่ backend คาด (ดู routes/cr.js บรรทัด req.body)
        // ไม่ต้องส่ง crNumber แล้ว — backend สร้างให้เองจาก cr_id หลัง insert
        const data = await apiFetch("/change-requests", {
          method: "POST",
          body: JSON.stringify(this.buildPayload("submitted"))
        });

        // ไม่ redirect แล้ว — โชว์ส่วนอนุมัติต่อท้ายฟอร์มไว้เลย (อยู่หลัง modal) แล้วค่อยเลื่อนจอลงไปหา
        // ตอนปิด modal (ดู closeModal ด้านล่าง)
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

    // ปุ่ม "บันทึกร่าง (Save Draft)" — ยิงไปตาราง change_requests เหมือน submit จริง
    // แต่ status: "draft" -> backend ข้ามการส่งเมลแจ้ง approver (ดู routes/cr.js: if (body.status !== "draft"))
    // ไม่เรียก validateForm() เพราะ draft ตั้งใจให้กรอกไม่ครบได้ (นั่นคือประเด็นของการ "ร่าง")
    // backend เองมีด่านขั้นต่ำอยู่แล้ว (ต้องมี subject + systemCode ไม่งั้น 400) พอสำหรับ draft
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

    // ปิด modal — ถ้าเพิ่ง submit สำเร็จ (มี submittedCrId แล้ว) เลื่อนจอลงไปหาส่วนอนุมัติต่อเลย
    closeModal() {
      this.modal.show = false;
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



    <!-- @submit.prevent = ส่งฟอร์มแล้วเรียก handleSubmit() โดยไม่ reload หน้า -->
    <form @submit.prevent="handleSubmit">

      <!-- [ 1. ข้อมูลทั่วไป ] -->
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
          <input type="text" id="cr-contact" v-model="form.contact" placeholder="ระบุอีเมลหรือเบอร์โทรติดต่อ">
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

      <!-- [ 2. รายละเอียดการขอเปลี่ยนระบบ ] -->
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

      <!-- [ 3. การประเมินผลกระทบ ] -->
      <div class="section-title">
        <div>3. การประเมินผลกระทบและทรัพยากร (Impact & Resource Assessment)</div>
        <span class="note" v-if="canEditImpact">*เฉพาะสิทธิ์ IT / Admin</span>
        <span class="note" v-else>*เฉพาะสิทธิ์ IT / Admin — คุณดูได้อย่างเดียว</span>
      </div>

      <!-- fieldset disabled = ปิดทุก input/checkbox/radio ข้างในทีเดียว ให้ role อื่นนอกจาก it_admin
           กันซ้ำอีกชั้นฝั่ง backend แล้ว (routes/cr.js: isItAdmin) เผื่อมีคนยิง POST ตรงๆ ข้าม UI -->
      <fieldset :disabled="!canEditImpact" class="section3-fieldset">

      <div class="form-group">
        <label>ประเภทการเปลี่ยน:</label>
        <div class="options-group">
          <label class="option-item"><input type="checkbox" value="App" v-model="form.changeTypes"> Application /
            Software</label>
          <label class="option-item"><input type="checkbox" value="DB" v-model="form.changeTypes"> Database
            Schema</label>
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
          <input type="text" v-model="form.impactDetail" :disabled="!canEditImpact || form.impact !== 'other'"
            placeholder="ระบุระบบที่ได้รับผลกระทบ...">
          <label class="option-item"><input type="checkbox" v-model="form.downtime"> ต้องปิดระบบชั่วคราว
            (Downtime)</label>
        </div>
      </div>

      <div class="grid-2col" style="margin-top: 10px;">
        <div class="form-group">
          <label for="cr-duration">ระยะเวลาที่คาดใช้:</label>
          <input type="text" id="cr-duration" v-model="form.duration" placeholder="ระบุจำนวนวันทำการ เช่น 2 วัน" :required="canEditImpact">
        </div>
        <div class="form-group">
          <label for="cr-deploy-date">เป้าหมาย Deploy:</label>
          <input type="date" id="cr-deploy-date" v-model="form.deployDate" :required="canEditImpact">
        </div>
      </div>

      </fieldset>

      <!-- [ 4. แผนดำเนินงาน ] -->
      <div class="section-title">
        <div>แผนดำเนินงาน (Action Plan)</div>
        <span class="note">*โปรดระบุขั้นตอนและกำหนดเวลาปฏิบัติงาน</span>
      </div>

      <div class="table-wrapper">
        <table class="action-table">
          <thead>
    <tr>
      <th style="width: 40px;">ลำดับ</th>
      <th style="width: 250px;">ขั้นตอนงาน</th> <!-- ขยายความกว้างช่องนี้ให้ยาวขึ้น -->
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
              <td class="text-center">{{ index + 1 }}</td>
              <td><input type="text" v-model="row.step" placeholder="ระบุขั้นตอนงาน" required></td>
              <td><input type="date" v-model="row.startDate" required></td>
              <td><input type="time" v-model="row.start" required></td>
              <td><input type="date" v-model="row.endDate" required></td>
              <td><input type="time" v-model="row.end" required></td>
              <td><input type="text" v-model="row.note" placeholder="หมายเหตุ"></td>
              <td class="text-center">
                <button type="button" class="btn-delete-row" @click="deleteRow(index)">ลบ</button>
              </td>
            </tr>
          </tbody>
        </table>

        <button type="button" class="btn-add-row" @click="addRow">
          + เพิ่มขั้นตอนงาน
        </button>
      </div>

      <div class="section-title">
        <div>แผนการกู้คืน(Roll Back Plan)</div>
      </div>

      <table class="action-table">
        <thead>
          <tr>
      <th style="width: 40px;">ลำดับ</th>
      <th style="width: 250px;">ขั้นตอนงาน</th> <!-- ขยายความกว้างช่องนี้ให้ยาวขึ้น -->
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
            <td class="text-center">{{ index + 1 }}</td>
            <td><input type="text" v-model="row2.step" placeholder="ระบุขั้นตอนงาน" required></td>
            <td><input type="date" v-model="row2.startDate" required></td>
            <td><input type="time" v-model="row2.start" required></td>
            <td><input type="date" v-model="row2.endDate" required></td>
            <td><input type="time" v-model="row2.end" required></td>
            <td><input type="text" v-model="row2.note" placeholder="หมายเหตุ"></td>
            <td class="text-center">
              <button type="button" class="btn-delete-row" @click="deleteRow2(index)">ลบ</button>
            </td>
          </tr>
        </tbody>
      </table>

      <button type="button" class="btn-add-row" @click="addRow2">
        + เพิ่มขั้นตอนงาน
      </button>

      <div class="ui-action-buttons">
        <button type="button" class="btn btn-cancel" @click="cancelForm">
          <i class="fa-solid fa-xmark"></i> ยกเลิก (Cancel)
        </button>

        <!-- type="button" ตั้งใจ — ไม่ใช่ submit เพราะไม่อยากให้ required attribute ของช่องอื่น
             บล็อกการบันทึกร่าง (ร่างกรอกไม่ครบได้ นั่นคือประเด็นของมัน) -->
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

    <!-- ส่วนอนุมัติ — โผล่หลัง Submit CR สำเร็จ / requester เห็นแต่กดไม่ได้
         no-print = ซ่อนตอน print (ดู base.css @media print) — เป็นฟอร์มพิจารณาที่ต้องกดจริง
         ไม่ใช่ส่วนหนึ่งของเอกสาร CR ที่จะเก็บเป็น PDF -->
    <div class="no-print">
      <ApprovalSection v-if="submittedCrId" ref="approvalSection" :crId="submittedCrId" />
    </div>

    <StatusModal :show="modal.show" :variant="modal.variant" :title="modal.title" :message="modal.message"
      @close="closeModal" />
  </div>
</template>


<style>
@import '../assets/css/form.css';

/* section 3 (การประเมินผลกระทบและทรัพยากร) เฉพาะสิทธิ์ it_admin — ดู canEditImpact */
.section3-fieldset {
  border: none;
  padding: 0;
  margin: 0;
}

.section3-fieldset:disabled input,
.section3-fieldset:disabled select,
.section3-fieldset:disabled textarea {
  background-color: #eaedf2;
  color: #6b7280;
  cursor: not-allowed;
}
</style>
