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
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: router/index.js -> path "/approve" (lazy load) — ผู้ใช้มาถึงหน้านี้ 2 ทาง:
//   1. คลิกลิงก์ในเมล (backend/src/routes/cr.js สร้างลิงก์ ${FRONTEND_URL}/approve?crId=...)
//   2. คลิกแถวใน ListView.vue -> this.$router.push(`/approve?crId=${crId}`)
// ปลายทาง: services/api.js (apiFetch -> GET /change-requests/:id เอารายละเอียดมาโชว์)
//          + components/ApprovalSection.vue (ฟอร์มอนุมัติจริง ส่ง crId ให้ผ่าน prop)
import { apiFetch } from "../services/api.js";
import { commonMethods } from "../services/commonActions.js";
import ApprovalSection from "../components/ApprovalSection.vue";

export default {
  components: { ApprovalSection },

  data() {
    return {
      crId: null,   // ยังไม่รู้เลข CR จนกว่า mounted() จะอ่านจาก URL มาใส่
      cr: null      // รายละเอียด CR ใบนี้ (เลขที่, subject, ผู้ร้องขอ, ...) — ให้เห็นบริบทก่อนอนุมัติ
    };
  },

  // mounted() = โค้ดที่รันอัตโนมัติ 1 ครั้ง ทันทีที่หน้าเปิดเสร็จ (ไม่ต้องมีใครกดอะไร)
  async mounted() {
    // ยังไม่เคย login (ไม่มี user เก็บใน localStorage) -> เด้งกลับหน้า login ทันที
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }

    // this.$route.query.crId = ค่าพารามิเตอร์ใน URL
    // เช่นเปิด /approve?crId=7 -> this.$route.query.crId ได้ "7" มา
    this.crId = this.$route.query.crId;

    // ดึงรายละเอียด CR มาโชว์ — คนคลิกจากลิงก์ในเมลจะได้เห็นว่ากำลังอนุมัติใบไหน
    if (this.crId) {
      try {
        this.cr = await apiFetch(`/change-requests/${this.crId}`);
      } catch (err) {
        console.error(err);
      }
    }

    // มาจากปุ่ม PDF ใน ListView (ดู openCrPdf ใน ListView.vue -> push ?print=1 ต่อท้าย)
    // -> เปิด print dialog อัตโนมัติทันทีที่ข้อมูล CR โหลดเสร็จ ไม่ต้องกดปุ่มซ้ำอีกที
    if (this.$route.query.print === "1" && this.cr) {
      this.$nextTick(() => this.generatePDF());
    }
  },

  computed: {
    // cr.changeTypes เป็น array ค่า code ("App"/"DB"/"Infra") -> แปลงเป็นข้อความอ่านง่ายก่อนโชว์
    changeTypesText() {
      const labels = { App: "Application / Software", DB: "Database Schema", Infra: "Infrastructure" };
      const types = this.cr?.changeTypes || [];
      return types.length ? types.map(t => labels[t] || t).join(", ") : "-";
    }
  },

  methods: {
    // ดึงปุ่ม generatePDF (window.print()) มาจาก services/commonActions.js — ใช้ร่วมกับ FormView/ListView
    ...commonMethods,

    // request_date/deploy_date มาจาก backend เป็น ISO datetime เต็ม ("2026-07-21T00:00:00.000Z")
    // ตัดเอาแค่ส่วนวันที่มาโชว์ (ไม่ต้อง parse เป็น Date object ให้ซับซ้อนเกินจำเป็น)
    fmtDate(value) {
      return value ? String(value).slice(0, 10) : "-";
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

    <!-- สรุปว่ากำลังอนุมัติ CR ใบไหน — สำคัญมากเวลาเปิดหน้านี้ตรงจากลิงก์ในเมล -->
    <div class="section-title" v-if="cr">
      <div>{{ cr.cr_number }} — {{ cr.subject }}</div>
      <span class="note">ผู้ร้องขอ: {{ cr.requester }} | ระบบ: {{ cr.system_name }} | ความสำคัญ: {{ cr.priority }}</span>
    </div>

    <!-- รายละเอียดคำขอเต็ม (อ่านอย่างเดียว) — ให้ approver เห็นว่ากำลังอนุมัติอะไร ไม่ใช่แค่หัวข้อ -->
    <template v-if="cr">
      <div class="grid-2col">
        <div class="form-group">
          <label>วันที่ร้องขอ:</label>
          <input type="text" :value="fmtDate(cr.request_date)" disabled>
        </div>
        <div class="form-group">
          <label>แผนก/ฝ่าย:</label>
          <input type="text" :value="cr.department" disabled>
        </div>
        <div class="form-group">
          <label>อีเมล/เบอร์โทร:</label>
          <input type="text" :value="cr.contact" disabled>
        </div>
      </div>

      <div class="form-group align-top">
        <label>สถานะปัจจุบัน / ปัญหาที่พบ:</label>
        <textarea rows="3" disabled>{{ cr.problem }}</textarea>
      </div>

      <div class="form-group align-top">
        <label>สิ่งที่ต้องการให้ปรับปรุง:</label>
        <textarea rows="3" disabled>{{ cr.request_detail }}</textarea>
      </div>

      <div class="form-group">
        <label>ประเภทการเปลี่ยน:</label>
        <input type="text" :value="changeTypesText" disabled>
      </div>

      <div class="form-group">
        <label>ผลกระทบระบบ:</label>
        <input type="text"
          :value="cr.impact === 'other' ? ('กระทบระบบอื่น: ' + (cr.impact_detail || '-')) : 'ไม่มีผลกระทบส่วนอื่น'"
          disabled>
      </div>

      <div class="grid-2col">
        <div class="form-group">
          <label>ปิดระบบชั่วคราว (Downtime):</label>
          <input type="text" :value="cr.downtime ? 'ต้องปิดระบบ' : 'ไม่ต้องปิดระบบ'" disabled>
        </div>
        <div class="form-group">
          <label>ระยะเวลาที่คาดใช้:</label>
          <input type="text" :value="cr.duration" disabled>
        </div>
        <div class="form-group">
          <label>เป้าหมาย Deploy:</label>
          <input type="text" :value="fmtDate(cr.deploy_date)" disabled>
        </div>
      </div>

      <template v-if="cr.plan && cr.plan.length">
        <div class="section-title">
          <div>แผนดำเนินงาน (Action Plan)</div>
        </div>
        <table class="action-table">
          <thead>
            <tr>
              <th style="width: 40px;">ลำดับ</th>
              <th>ขั้นตอนงาน</th>
              <th>เริ่ม</th>
              <th>สิ้นสุด</th>
              <th>ผู้รับผิดชอบ</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in cr.plan" :key="'plan-' + i">
              <td class="text-center">{{ i + 1 }}</td>
              <td>{{ row.step }}</td>
              <td>{{ row.start_date }}</td>
              <td>{{ row.end_date }}</td>
              <td>{{ row.owner || "-" }}</td>
              <td>{{ row.note || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="cr.rollbackPlan && cr.rollbackPlan.length">
        <div class="section-title">
          <div>แผนการกู้คืน (Roll Back Plan)</div>
        </div>
        <table class="action-table">
          <thead>
            <tr>
              <th style="width: 40px;">ลำดับ</th>
              <th>ขั้นตอนงาน</th>
              <th>เริ่ม</th>
              <th>สิ้นสุด</th>
              <th>ผู้รับผิดชอบ</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in cr.rollbackPlan" :key="'rb-' + i">
              <td class="text-center">{{ i + 1 }}</td>
              <td>{{ row.step }}</td>
              <td>{{ row.start_date }}</td>
              <td>{{ row.end_date }}</td>
              <td>{{ row.owner || "-" }}</td>
              <td>{{ row.note || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- ui-action-buttons = ซ่อนอัตโนมัติตอน print (ดู base.css @media print) -->
      <div class="ui-action-buttons">
        <button type="button" class="btn btn-pdf" @click="generatePDF">
          <i class="fa-solid fa-file-pdf"></i> Download PDF
        </button>
      </div>
    </template>

    <!-- no-print = ซ่อนตอน print (ดู base.css @media print) — เป็นฟอร์มพิจารณาที่ต้องกดจริง
         ไม่ใช่ส่วนหนึ่งของเอกสาร CR ที่จะเก็บเป็น PDF -->
    <div class="no-print">
      <!-- v-if/v-else = มีเลข crId แล้ว โชว์ฟอร์มอนุมัติ / ไม่มี โชว์ข้อความแทน -->
      <ApprovalSection v-if="crId" :crId="crId" />
      <p v-else style="text-align:center; color:#6b7280;">
        ไม่พบเลข CR — กรุณาเข้าหน้านี้ผ่านการ Submit ฟอร์ม
      </p>
    </div>
  </div>
</template>

<style>
@import '../assets/css/form.css';
</style>
