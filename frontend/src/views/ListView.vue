<script>
// ============================================
// ListView.vue — สืบค้น / ประวัติย้อนหลังทั้งหมด (BONUS 2 ใน LABS.txt)
// ============================================
//
// ตาม flowchart ฝั่งขวา:
//   สืบค้น/ดูประวัติย้อนหลัง -> ค้นด้วยเงื่อนไข (วันที่, เลขที่ CR, สถานะ)
//   -> แสดงรายการทั้งหมด -> ปุ่ม Download PDF ย้อนหลัง
//
// backend รองรับ filter ผ่าน query string แล้ว (GET /change-requests?status=&crNumber=&date=)
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: router/index.js -> path "/list" (lazy load) — HomeView.vue มีลิงก์มาที่นี่
// ปลายทาง: services/api.js (apiFetch -> GET /api/change-requests) + services/commonActions.js
//          (...commonMethods เอา generatePDF มาใช้กับปุ่ม "Download PDF ย้อนหลัง")
// คลิกแถวไหน -> this.$router.push("/approve?crId=...") ไปเปิด ApproveView.vue ต่อ

import { apiFetch } from "../services/api.js";
import { commonMethods } from "../services/commonActions.js";

const STATUS_LABEL = {
  draft: "ร่าง",
  submitted: "รอดำเนินการ",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  more_info: "ขอข้อมูลเพิ่ม"
};

export default {
  data() {
    return {
      filters: {
        crNumber: "",
        status: "",
        date: ""
      },
      rows: [],
      loading: false,
      statusOptions: STATUS_LABEL
    };
  },

  mounted() {
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }
    this.search();
  },

  methods: {
    ...commonMethods,

    statusLabel(status) {
      return STATUS_LABEL[status] || status;
    },

    // ตัด filter ที่ว่างออกก่อนต่อ query string — ไม่ส่ง param เปล่าไป backend
    async search() {
      this.loading = true;
      try {
        const params = new URLSearchParams();
        if (this.filters.crNumber) params.set("crNumber", this.filters.crNumber);
        if (this.filters.status) params.set("status", this.filters.status);
        if (this.filters.date) params.set("date", this.filters.date);

        const qs = params.toString();
        this.rows = await apiFetch(`/change-requests${qs ? "?" + qs : ""}`);
      } catch (err) {
        alert("ค้นหาไม่สำเร็จ: " + err.message);
      } finally {
        this.loading = false;
      }
    },

    resetFilters() {
      this.filters = { crNumber: "", status: "", date: "" };
      this.search();
    },

    openCr(crId) {
      this.$router.push(`/approve?crId=${crId}`);
    }
  }
};
</script>

<template>
  <div class="container list-container">
    <div class="header-section">
      <h1>ประวัติ Change Request ย้อนหลัง</h1>
      <p>สืบค้น / ดูรายการ CR ทั้งหมดในระบบ</p>
    </div>

   <button type="button" class="btn-back" @click="$router.push('/home')">
  <i class="fa-solid fa-arrow-left"></i> กลับหน้าหลัก
</button>


    <div class="section-title">
      <div>ค้นหารายการ</div>
    </div>

    <form class="grid-2col filter-grid" @submit.prevent="search">
      <div class="form-group">
        <label for="f-cr">เลขที่ CR:</label>
        <input id="f-cr" type="text" v-model="filters.crNumber" placeholder="เช่น CR6908001">
      </div>

      <div class="form-group">
        <label for="f-date">วันที่ร้องขอ:</label>
        <input id="f-date" type="date" v-model="filters.date">
      </div>

      <div class="form-group">
        <label for="f-status">สถานะ:</label>
        <select id="f-status" v-model="filters.status">
          <option value="">-- ทั้งหมด --</option>
          <option v-for="(label, value) in statusOptions" :key="value" :value="value">{{ label }}</option>
        </select>
      </div>

      <div class="ui-action-buttons filter-actions">
        <button type="button" class="btn btn-cancel" @click="resetFilters">ล้างเงื่อนไข</button>
        <button type="submit" class="btn btn-submit">
          <i class="fa-solid fa-magnifying-glass"></i> ค้นหา
        </button>
      </div>
    </form>

   <div class="section-title">
  <div>รายการทั้งหมด ({{ totalRows }})</div>
</div>

<div class="table-wrapper">
  <table class="action-table">
    <thead>
      <tr>
        <th class="text-center">เลขที่ CR</th>
        <th class="text-center">วันที่ร้องขอ</th>
        <th>หัวข้อ</th>
        <th>ผู้ร้องขอ</th>
        <th>ระบบ</th>
        <th class="text-center">ความสำคัญ</th>
        <th class="text-center">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      <!-- 1. สถานะกำลังโหลด -->
      <tr v-if="loading">
        <td colspan="7" class="text-center" style="padding: 20px;">กำลังโหลด...</td>
      </tr>

      <!-- 2. กรณีไม่มีข้อมูล -->
      <tr v-else-if="rows.length === 0">
        <td colspan="7" class="text-center" style="padding: 20px; color: #6b7280;">ไม่พบข้อมูล</td>
      </tr>

      <!-- 3. แสดงข้อมูล (ใช้ rows และตัวแปรเดิมของคุณ) -->
      <tr 
        v-else 
        v-for="row in rows" 
        :key="row.cr_id" 
        class="row-click" 
        @click="openCr(row.cr_id)"
      >
        <td class="text-center"><strong>{{ row.cr_number }}</strong></td>
        <td class="text-center">{{ row.request_date ? new Date(row.request_date).toLocaleDateString('th-TH') : '-' }}</td>
        <td>{{ row.subject }}</td>
        <td>{{ row.requester }}</td>
        <td>{{ row.system_name }}</td>
        <td class="text-center">{{ row.priority }}</td>
        <td class="text-center">
          <span class="status-badge" :class="'status-' + row.status">
            {{ statusLabel(row.status) }}
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ===== ปุ่มเปลี่ยนหน้า 1, 2, 3, 4 ..... (วางใตัตาราง) ===== -->
<div class="pagination" v-if="totalPages > 1">
  <button 
    class="page-btn" 
    :disabled="currentPage === 1" 
    @click="changePage(currentPage - 1)"
  >
    ← ก่อนหน้า
  </button>

  <button 
    v-for="page in totalPages" 
    :key="page"
    :class="['page-btn', { active: page === currentPage }]"
    @click="changePage(page)"
  >
    {{ page }}
  </button>

  <button 
    class="page-btn" 
    :disabled="currentPage === totalPages" 
    @click="changePage(currentPage + 1)"
  >
    ถัดไป →
  </button>
</div>

    

    <div class="ui-action-buttons">
      <button type="button" class="btn btn-pdf" @click="generatePDF">
        <i class="fa-solid fa-file-pdf"></i> Download PDF ย้อนหลัง
      </button>
    </div>
  </div>
</template>

<style>
@import '../assets/css/form.css';

.list-container {
  width: 950px;
}

.filter-grid {
  align-items: end;
}

.filter-actions {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
  justify-content: flex-start;
}

.row-click {
  cursor: pointer;
}

.row-click:hover {
  background: #f5f7ff;
}

.status-badge {
  padding: 3px 10px;
  border-radius: 50px;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}
/* กำหนดสีปุ่ม PDF ให้เป็นสีกรมท่า (โทนเดียวกับปุ่มกลับหน้าหลัก) */
.btn-pdf {
 background: linear-gradient(135deg, #5a0000, #00075a); /* สีกรมท่าหลัก */
  color: #ffffff !important;             /* ตัวหนังสือสีขาว */
  border: none !important;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

/* ตอนเอาเม้าส์ไปชี้ ให้สว่างขึ้นเล็กน้อย */
.btn-pdf:hover {
background-color: #0a1b33;
}
h1 {
  margin-bottom: 0;
  font-size: 26px;
  font-weight: 600;
  color: #1e3a8a;
}
p {
  margin-top: 4px;
  color: #2d3036;
  font-size: 16px;
}

.status-draft       { background: #e5e7eb; color: #4b5563; }
.status-submitted    { background: #fef3c7; color: #92400e; }
.status-approved     { background: #d1fae5; color: #065f46; }
.status-rejected     { background: #fee2e2; color: #991b1b; }
.status-more_info    { background: #dbeafe; color: #1e40af; }
</style>
