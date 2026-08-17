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
import { buildCrPdfBlobUrl, downloadCrPdf } from "../services/pdfExport.js";
import ApprovalSection from "../components/ApprovalSection.vue";
import ChangeWindow from "../components/ChangeWindow.vue";
import { STATUS_LABEL } from "../services/constants.js";

export default {
  components: { ApprovalSection, ChangeWindow },

  data() {
    return {
      crId: null,       // ยังไม่รู้เลข CR จนกว่า mounted() จะอ่านจาก URL มาใส่
      cr: null,         // รายละเอียด CR ใบนี้ (เลขที่, subject, ผู้ร้องขอ, ...) — ให้เห็นบริบทก่อนอนุมัติ
      loadError: "",    // โหลดรายละเอียดไม่ได้ (ไม่ใช่ CR ของเรา / ไม่มีใบนี้) — ต้องบอกเหตุผล
      pdfPreviewUrl: "" // blob URL ของ PDF ที่กำลัง preview อยู่ ("" = ปิด modal)
    };
  },

  // ออกจากหน้านี้ทั้งที modal ยังเปิดค้าง -> blob ยังจองหน่วยความจำอยู่ ต้องคืนก่อน
  beforeUnmount() {
    this.closePdfPreview();
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
        // เดิมแค่ console.error -> หน้าเว็บว่างเปล่าโดยไม่บอกอะไร
        // requester ที่เปิดใบของคนอื่นจะเห็นแค่ฟอร์มเปล่า ไม่รู้ว่าทำไม
        this.loadError = err.message;
      }
    }

    // มาจากปุ่ม PDF ใน ListView (ดู openCrPdf ใน ListView.vue -> push ?print=1 ต่อท้าย)
    // -> เปิด preview ให้เลยทันทีที่ข้อมูล CR โหลดเสร็จ ไม่ต้องกดปุ่มซ้ำอีกที
    // (ListView ซ่อนปุ่มนี้ไว้แล้วถ้ายังไม่ approved แต่กันซ้ำอีกชั้น เผื่อมีคนกดลิงก์ตรงๆ)
    if (this.$route.query.print === "1" && this.cr?.status === "approved") {
      this.openPdfPreview();
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
    // request_date/deploy_date มาจาก backend เป็น ISO datetime เต็ม ("2026-07-21T00:00:00.000Z")
    // ตัดเอาแค่ส่วนวันที่มาโชว์ (ไม่ต้อง parse เป็น Date object ให้ซับซ้อนเกินจำเป็น)
    fmtDate(value) {
      return value ? String(value).slice(0, 10) : "-";
    },

    statusLabel(status) {
      return STATUS_LABEL[status] || status;
    },

    // หัวหนังสือเขียนวันที่เต็ม ไม่ใช่ 2026-08-03 — "๓ สิงหาคม ๒๕๖๙" คือรูปแบบของเอกสาร
    fmtLongDate(value) {
      if (!value) return "—";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
    },

    // PDF เป็นไฟล์จริงที่วาดเป็น vector เอง (jsPDF+autoTable ใน services/pdfExport.js)
    // ไม่ใช่ window.print() เดิม (โผล่ print dialog ของ browser เจอ header/footer ติดมาด้วย ไม่สวย)
    // กดได้ก็ต่อเมื่อ CR ผ่านการอนุมัติแล้วเท่านั้น — ยังไม่อนุมัติไม่มีผลพิจารณาให้ลงในเอกสาร
    async openPdfPreview() {
      if (!this.cr || this.cr.status !== "approved") return;
      this.pdfPreviewUrl = await buildCrPdfBlobUrl(this.cr);
    },

    closePdfPreview() {
      if (!this.pdfPreviewUrl) return;
      URL.revokeObjectURL(this.pdfPreviewUrl);
      this.pdfPreviewUrl = "";
    },

    async downloadPdf() {
      await downloadCrPdf(this.cr);
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

    <!-- โหลดใบนี้ไม่ได้ — บอกเหตุผลตรงๆ แล้วไม่ต้องโชว์ฟอร์มพิจารณาให้สับสน -->
    <p v-if="loadError" class="load-error">
      <i class="fa-solid fa-circle-exclamation"></i> {{ loadError }}
    </p>

    <!-- สรุปว่ากำลังอนุมัติ CR ใบไหน — สำคัญมากเวลาเปิดหน้านี้ตรงจากลิงก์ในเมล -->
    <div class="register-block" v-if="cr">
      <dl class="register">
        <dt>ที่</dt>
        <dd>{{ cr.cr_number }}</dd>

        <dt>วันที่</dt>
        <dd>{{ fmtLongDate(cr.request_date) }}</dd>

        <dt>เรื่อง</dt>
        <dd>{{ cr.subject }}</dd>

        <dt>เรียน</dt>
        <dd>หัวหน้าฝ่ายเทคโนโลยีสารสนเทศ</dd>

        <dt>จาก</dt>
        <dd>{{ cr.requester }} — ระบบ {{ cr.system_name }} · ความสำคัญ {{ cr.priority }}</dd>
      </dl>

      <span class="status-badge stamp" :class="'status-' + cr.status">{{ statusLabel(cr.status) }}</span>
    </div>

    <!-- แถบหน้าต่างการเปลี่ยนแปลง — เห็นทั้งช่วงเวลาและแผนกู้คืนก่อนตัดสินใจ -->
    <ChangeWindow
      v-if="cr"
      :plan="cr.plan"
      :rollback-plan="cr.rollbackPlan"
      :deploy-date="cr.deploy_date"
      :downtime="!!cr.downtime"
      :duration="cr.duration"
    />

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
        <div class="table-wrapper plan-cards-wrap">
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
              <td data-label="ลำดับ" class="text-center">{{ i + 1 }}</td>
              <td data-label="ขั้นตอนงาน">{{ row.step }}</td>
              <td data-label="เริ่ม">{{ row.start_date }}</td>
              <td data-label="สิ้นสุด">{{ row.end_date }}</td>
              <td data-label="ผู้รับผิดชอบ">{{ row.owner || "-" }}</td>
              <td data-label="หมายเหตุ">{{ row.note || "-" }}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </template>

      <template v-if="cr.rollbackPlan && cr.rollbackPlan.length">
        <div class="section-title is-rollback">
          <div>แผนการกู้คืน (Roll Back Plan)</div>
        </div>
        <div class="table-wrapper plan-cards-wrap">
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
              <td data-label="ลำดับ" class="text-center">{{ i + 1 }}</td>
              <td data-label="ขั้นตอนงาน">{{ row.step }}</td>
              <td data-label="เริ่ม">{{ row.start_date }}</td>
              <td data-label="สิ้นสุด">{{ row.end_date }}</td>
              <td data-label="ผู้รับผิดชอบ">{{ row.owner || "-" }}</td>
              <td data-label="หมายเหตุ">{{ row.note || "-" }}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </template>

      <!-- มีให้กดได้ก็ต่อเมื่อ CR ผ่านการอนุมัติแล้วเท่านั้น (ดู openPdfPreview() ในสคริปต์) -->
      <div class="ui-action-buttons" v-if="cr.status === 'approved'">
        <button type="button" class="btn btn-pdf" @click="openPdfPreview">
          <i class="fa-solid fa-file-pdf"></i> ดูตัวอย่าง PDF
        </button>
      </div>
    </template>

    <!-- preview ก่อนโหลด — <iframe src="blob:..."> ให้ browser เรนเดอร์ PDF ให้เลย
         ไม่ต้องพึ่ง viewer library เพิ่ม กดโหลดจริงค่อยเรียก downloadPdf() -->
    <div v-if="pdfPreviewUrl" class="pdf-modal-backdrop" @click.self="closePdfPreview">
      <div class="pdf-modal">
        <div class="pdf-modal-header">
          <span>ตัวอย่างเอกสาร {{ cr.cr_number }}</span>
          <button type="button" class="pdf-modal-close" @click="closePdfPreview">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <iframe :src="pdfPreviewUrl" class="pdf-modal-frame" title="ตัวอย่าง PDF"></iframe>
        <div class="pdf-modal-footer">
          <button type="button" class="btn btn-cancel2" @click="closePdfPreview">ปิด</button>
          <button type="button" class="btn btn-pdf" @click="downloadPdf">
            <i class="fa-solid fa-download"></i> ดาวน์โหลด PDF
          </button>
        </div>
      </div>
    </div>

    <!-- no-print = ซ่อนตอน print (ดู base.css @media print) — เป็นฟอร์มพิจารณาที่ต้องกดจริง
         ไม่ใช่ส่วนหนึ่งของเอกสาร CR ที่จะเก็บเป็น PDF -->
    <div class="no-print">
      <!-- v-if/v-else = มีเลข crId แล้ว โชว์ฟอร์มอนุมัติ / ไม่มี โชว์ข้อความแทน -->
      <ApprovalSection v-if="crId && !loadError" :crId="crId" />
      <p v-else-if="!crId" class="empty-note">
        ไม่พบเลข CR — กรุณาเข้าหน้านี้ผ่านการ Submit ฟอร์ม
      </p>
    </div>
  </div>
</template>

<style>
@import '../assets/css/form.css';

/* ข้อความบอกว่าเปิดใบนี้ไม่ได้ — กรอบหมึกตรายาง อ่านออกทันทีว่าไม่ใช่เนื้อหาปกติ */
.load-error {
  display: flex;
  align-items: baseline;
  gap: var(--quarter);
  padding: var(--half);
  margin-bottom: var(--lh);
  color: var(--seal);
  border: 1px solid var(--seal);
}

.empty-note {
  text-align: center;
  color: var(--ink-light);
  padding: var(--lh) 0;
}

/* ===== บล็อกทะเบียนหนังสือ =====
   ที่ / วันที่ / เรื่อง / เรียน — โครงหัวหนังสือจริง เปิดจากลิงก์ในเมลมาก็อ่านออกทันที
   ว่ากำลังพิจารณาหนังสือฉบับไหน จากใคร เรื่องอะไร */
.register-block {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--lh);
  margin-bottom: var(--lh);
}

.register {
  display: grid;
  grid-template-columns: 56px 1fr;
  column-gap: var(--half);
  flex: 1;
}

.register dt {
  font-weight: 700;
}

/* ค่าวางบนเส้นบรรทัด เหมือนถูกกรอกลงในแบบฟอร์ม */
.register dd {
  border-bottom: 1px solid var(--line-faint);
  padding-bottom: 1px;
}

/* ตรายางกินพื้นที่ของตัวเอง ไม่ทับข้อความ */
.register-block .stamp {
  flex: none;
  margin-top: var(--quarter);
}

@media screen and (max-width: 700px) {
  .register-block {
    flex-direction: column-reverse;
    align-items: flex-start;
    gap: var(--half);
  }
}

.pdf-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 26, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.pdf-modal {
  background: var(--sheet);
  border-radius: 0;
  width: min(900px, 100%);
  height: min(90svh, 900px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pdf-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--quarter) var(--half);
  background: var(--official);
  color: var(--sheet);
  font-weight: 700;
}

.pdf-modal-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  min-width: 36px;
  min-height: 36px;
  cursor: pointer;
}

/* flex:1 = กินพื้นที่ที่เหลือทั้งหมดระหว่าง header กับ footer */
.pdf-modal-frame {
  flex: 1;
  width: 100%;
  border: none;
}

.pdf-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: var(--quarter) var(--half);
  border-top: 1px solid var(--line-faint);
}
</style>
