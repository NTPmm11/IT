<script>
// ============================================
// ApproveView.vue — หน้าอนุมัติแบบเปิดตรง (/approve?crId=7)
// ============================================
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

<!-- เปิดไฟล์ components/ApprovalSection.vue แล้วครอบโค้ดด้วย div card นี้ -->
<template>
  <div class="card approval-card">
    <div class="approval-header">
      <h3>ส่วนการตรวจสอบและอนุมัติ (Approval Status)</h3>
      <span class="badge-role">*เฉพาะสิทธิ์ Approver / PM</span>
    </div>

    <!-- ฟิลด์ความเห็น ผลการพิจารณา และปุ่มกดต่างๆ ที่มีอยู่เดิม -->
    <div class="form-group">
      <label>ความเห็นของผู้ประเมิน:</label>
      <textarea v-model="comment" class="form-control" placeholder="บันทึกข้อเสนอแนะเพิ่มเติม...."></textarea>
    </div>

    <div class="form-group">
      <label>ผลการพิจารณา:</label>
      <div class="radio-group">
        <label><input type="radio" v-model="status" value="approved"> อนุมัติ (Approved)</label>
        <label><input type="radio" v-model="status" value="rejected"> ไม่อนุมัติ (Rejected)</label>
        <label><input type="radio" v-model="status" value="more_info"> ขอข้อมูลเพิ่ม (More Info)</label>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group half">
        <label>ผู้อนุมัติ (Approver):</label>
        <input type="text" class="form-control" v-model="approver" readonly>
      </div>
      <div class="form-group half">
        <label>วันที่พิจารณา:</label>
        <input type="date" class="form-control" v-model="approvalDate">
      </div>
    </div>

    <div class="form-actions-center">
      <button type="button" class="btn btn-submit-approval" @click="submitApproval">
        <i class="fa-solid fa-paper-plane"></i> บันทึกผลอนุมัติ (Submit)
      </button>
    </div>
  </div>


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

    <!-- ส่วนพิจารณาอนุมัติ (เรียกผ่าน Component ภายนอกที่เป็น Card แยกด้านล่าง) -->
    <div class="no-print">
      <ApprovalSection v-if="crId" :crId="crId" @approved="onApproved" />
      <p v-else style="text-align:center; color:#6b7280;">
        ไม่พบเลข CR — กรุณาเข้าหน้านี้ผ่านการ Submit ฟอร์ม
      </p>
    </div>
</template>

<style scoped>
@import '../assets/css/form.css';

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
  background: #152a52;
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