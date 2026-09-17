<script>
import { apiFetch } from "../services/api.js";
import { buildCrPdfBlobUrl, downloadCrPdf } from "../services/pdfExport.js";
import ApprovalSection from "../components/ApprovalSection.vue";

export default {
  components: { ApprovalSection },

  data() {
    return {
      crId: null,
      cr: null,
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
      await this.loadCr();
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
    async loadCr() {
      try {
        this.cr = await apiFetch(`/change-requests/${this.crId}`);
      } catch (err) {
        console.error(err);
      }
    },

    async onApproved() {
      await this.loadCr();
    },

    fmtDate(value) {
      return value ? String(value).slice(0, 10) : "-";
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

    <div class="section-title" v-if="cr">
      <div>{{ cr.cr_number }} — {{ cr.subject }}</div>
      <span class="note">ผู้ร้องขอ: {{ cr.requester }} | ระบบ: {{ cr.system_name }} | ความสำคัญ: {{ cr.priority }}</span>
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
        <div class="table-wrapper">
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
        </div>
      </template>

      <template v-if="cr.rollbackPlan && cr.rollbackPlan.length">
        <div class="section-title">
          <div>แผนการกู้คืน (Roll Back Plan)</div>
        </div>
        <div class="table-wrapper">
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
          <button type="button" class="btn btn-cancel-maroon" @click="closePdfPreview">ปิด</button>
          <button type="button" class="btn btn-pdf" @click="downloadPdf">
            <i class="fa-solid fa-download"></i> ดาวน์โหลด PDF
          </button>
        </div>
      </div>
    </div>

  </div>
  <div>
      <div class="no-print approval-box">
      <ApprovalSection v-if="crId && cr" :crId="crId" :status="cr.status" :approvals="cr.approvals" @approved="onApproved" />
      <p v-else-if="!crId" style="text-align:center; color:#6b7280;">
        ไม่พบเลข CR — กรุณาเข้าหน้านี้ผ่านการ Submit ฟอร์ม
      </p>
    </div>
  </div>
</template>

<style scoped>
@import '../assets/css/approve.css';
.approval-box {
  background-color: #d5d5d6e3;
  padding: 20px;
  border-radius: 30px;
  margin-top: 20px;
}
.pdf-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.pdf-modal {
  background: #fff;
  border-radius: 8px;
  width: min(900px, 100%);
  height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pdf-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #4e4f52;
  color: #fff;
  font-weight: 600;
}

.pdf-modal-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
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
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
}
</style>
