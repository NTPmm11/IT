<script>
import { apiFetch } from "../services/api.js";
import { buildCrPdfBlobUrl, downloadCrPdf } from "../services/pdfExport.js";
import ApprovalSection from "../components/ApprovalSection.vue";
import { STATUS_LABEL } from "../services/constants.js";

export default {
  components: { ApprovalSection },

  data() {
    return {
      crId: null,
      cr: null,
      loadError: "",
      pdfPreviewUrl: ""
    };
  },

  beforeUnmount() {
    this.closePdfPreview();
  },

  async mounted() {
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }

    this.crId = this.$route.query.crId;

    if (this.crId) {
      try {
        this.cr = await apiFetch(`/change-requests/${this.crId}`);
      } catch (err) {
        this.loadError = err.message;
      }
    }

    if (this.$route.query.print === "1" && this.cr?.status === "approved") {
      this.openPdfPreview();
    }
  },

  computed: {
    changeTypesText() {
      const labels = { App: "Application / Software", DB: "Database Schema", Infra: "Infrastructure" };
      const types = this.cr?.changeTypes || [];
      return types.length ? types.map(t => labels[t] || t).join(", ") : "-";
    }
  },

  methods: {
    fmtDate(value) {
      return value ? String(value).slice(0, 10) : "-";
    },

    statusLabel(status) {
      return STATUS_LABEL[status] || status;
    },

    fmtLongDate(value) {
      if (!value) return "—";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
    },

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

    <p v-if="loadError" class="load-error">
      <i class="fa-solid fa-circle-exclamation"></i> {{ loadError }}
    </p>

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

      <div class="ui-action-buttons" v-if="cr.status === 'approved'">
        <button type="button" class="btn btn-pdf" @click="openPdfPreview">
          <i class="fa-solid fa-file-pdf"></i> ดูตัวอย่าง PDF
        </button>
      </div>
    </template>

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

    <div class="no-print">
      <ApprovalSection v-if="crId && !loadError" :crId="crId" />
      <p v-else-if="!crId" class="empty-note">
        ไม่พบเลข CR — กรุณาเข้าหน้านี้ผ่านการ Submit ฟอร์ม
      </p>
    </div>
  </div>
</template>

<style>
@import '../assets/css/form.css';

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

.register dd {
  border-bottom: 1px solid var(--line-faint);
  padding-bottom: 1px;
}

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
