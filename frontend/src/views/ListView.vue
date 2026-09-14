<script>
import { apiFetch } from "../services/api.js";
import { commonMethods } from "../services/commonActions.js";
import { STATUS_LABEL } from "../services/constants.js";

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
      userRole: JSON.parse(localStorage.getItem("user") || "{}").role || "",
      statusOptions: STATUS_LABEL,
      currentPage: 1,
      pageSize: 10,
      printing: false
    };
  },

  mounted() {
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }
    this.search();
  },

  computed: {
    totalRows() {
      return this.rows.length;
    },

    seesOwnOnly() {
      return this.userRole === "requester";
    },
    scopeLabel() {
      return this.seesOwnOnly ? "คำขอของฉัน" : "รายการทั้งหมด";
    },
    totalPages() {
      return Math.ceil(this.rows.length / this.pageSize) || 1;
    },
    pagedRows() {
      if (this.printing) return this.rows;
      const start = (this.currentPage - 1) * this.pageSize;
      return this.rows.slice(start, start + this.pageSize);
    }
  },

  methods: {
    ...commonMethods,

    statusLabel(status) {
      return STATUS_LABEL[status] || status;
    },

    async search() {
      this.loading = true;
      try {
        const params = new URLSearchParams();
        if (this.filters.crNumber) params.set("crNumber", this.filters.crNumber);
        if (this.filters.status) params.set("status", this.filters.status);
        if (this.filters.date) params.set("date", this.filters.date);

        const qs = params.toString();
        this.rows = await apiFetch(`/change-requests${qs ? "?" + qs : ""}`);
        this.currentPage = 1;
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
    },

    openCrPdf(crId) {
      this.$router.push(`/approve?crId=${crId}&print=1`);
    },

    changePage(page) {
      if (page < 1 || page > this.totalPages) return;
      this.currentPage = page;
    },

    async generatePDF() {
      this.printing = true;
      await this.$nextTick();

      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        this.printing = false;
        window.removeEventListener("afterprint", restore);
        window.removeEventListener("focus", restore);
      };
      window.addEventListener("afterprint", restore);
      window.addEventListener("focus", restore);

      window.print();
    }
  }
};
</script>

<template>
  <div class="container list-container">
    <div class="header-section">
      <h1>ประวัติ Change Request ย้อนหลัง</h1>
      <p v-if="seesOwnOnly">สืบค้น / ดูคำขอ CR ที่คุณเป็นผู้ยื่น</p>
      <p v-else>สืบค้น / ดูรายการ CR ทั้งหมดในระบบ</p>
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
  <div>{{ scopeLabel }} ({{ totalRows }})</div>
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
        <th class="text-center">PDF</th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="loading">
        <td colspan="8" class="text-center" style="padding: 20px;">กำลังโหลด...</td>
      </tr>

      <tr v-else-if="rows.length === 0">
        <td colspan="8" class="text-center" style="padding: 20px; color: #6b7280;">ไม่พบข้อมูล</td>
      </tr>

      <tr
        v-else
        v-for="row in pagedRows"
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
        <td class="text-center">
          <button
            v-if="row.status === 'approved'"
            type="button"
            class="btn-icon-pdf"
            title="ดาวน์โหลด PDF ใบนี้"
            @click.stop="openCrPdf(row.cr_id)"
          >
            <i class="fa-solid fa-file-pdf"></i>
          </button>
          <span v-else style="color:#9ca3af;">–</span>
        </td>
      </tr>
    </tbody>
  </table>
</div>

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

<style scoped>
@import '../assets/css/list.css';

.container {
  background: #ffffffb4;
  width: 950px;
  padding: 35px;
  border-radius: 20px;
  box-shadow: 0 15px 35px rgba(10, 10, 10, 0.836);
}

.section-title {
   background: linear-gradient(135deg, #5a0000, #00075a);
  color: #ffffff;
  padding: 10px 14px;
  font-size: 18px;
  font-weight: 700;
  border-radius: 6px;
  margin: 25px 0 15px 0;
  border-left: 5px solid #000000;
  display: flex;
  justify-content: space-between;
}

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
.btn-pdf {
  background: #000000;
  color: #ffffff !important;
  border: none !important;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn-pdf:hover {
background-color: #707070;
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
  justify-content: center;
}

.status-draft       { background: #e5e7eb; color: #4b5563; }
.status-submitted    { background: #fef3c7; color: #92400e; }
.status-approved     { background: #d1fae5; color: #065f46; }
.status-rejected     { background: #fee2e2; color: #991b1b; }
.status-more_info    { background: #dbeafe; color: #1e40af; }

.btn-icon-pdf {
  background: none;
  border: none;
  color: #4d4f5f;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.btn-icon-pdf:hover {
  background: #f5e6e6;
}
.table-wrapper {
  overflow-x: auto;
  margin-top: 15px;
  background: #e0e3e6;
}

@media print {
  .ui-action-buttons {
    display: none !important;
  }
}
</style>
