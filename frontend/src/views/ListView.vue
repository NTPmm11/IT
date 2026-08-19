<script>

import { apiFetch, apiFetchPaged } from "../services/api.js";
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
      allRows: [],
      totalRows: 0,
      loading: false,
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
    totalPages() {
      return Math.ceil(this.totalRows / this.pageSize) || 1;
    },
    pagedRows() {
      return this.printing ? this.allRows : this.rows;
    }
  },

  methods: {
    ...commonMethods,

    statusLabel(status) {
      return STATUS_LABEL[status] || status;
    },

    filterParams() {
      const params = new URLSearchParams();
      if (this.filters.crNumber) params.set("crNumber", this.filters.crNumber);
      if (this.filters.status) params.set("status", this.filters.status);
      if (this.filters.date) params.set("date", this.filters.date);
      return params;
    },

    async search() {
      this.currentPage = 1;
      await this.loadPage();
    },

    async loadPage() {
      this.loading = true;
      try {
        const params = this.filterParams();
        params.set("page", this.currentPage);
        params.set("pageSize", this.pageSize);

        const { rows, total } = await apiFetchPaged(`/change-requests?${params}`);
        this.rows = rows;
        this.totalRows = total;
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
      if (page < 1 || page > this.totalPages || page === this.currentPage) return;
      this.currentPage = page;
      this.loadPage();
    },

    async generatePDF() {
      try {
        this.allRows = await apiFetch(`/change-requests?${this.filterParams()}`);
      } catch (err) {
        alert("เตรียมข้อมูลสำหรับพิมพ์ไม่สำเร็จ: " + err.message);
        return;
      }

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
      <p>สืบค้น / ดูรายการ CR ทั้งหมดในระบบ</p>
    </div>

   <button type="button" class="btn-back" @click="$router.push('/home')">
  <i class="fa-solid fa-arrow-left"></i> กลับหน้าหลัก
</button>

    <div class="section-title2">
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

   <div class="section-title2">
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
        <th class="text-center">PDF</th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="loading">
        <td colspan="8" class="text-center" style="padding: 20px;">กำลังโหลด...</td>
      </tr>

      <tr v-else-if="rows.length === 0">
        <td colspan="8" class="text-center" style="padding: 28px; color: var(--ink-light);">ไม่พบข้อมูล</td>
      </tr>

      <tr
        v-else
        v-for="row in pagedRows"
        :key="row.cr_id"
        class="row-click"
        @click="openCr(row.cr_id)"
      >
        <td class="text-center" data-label="เลขที่ CR"><strong>{{ row.cr_number }}</strong></td>
        <td class="text-center" data-label="วันที่ร้องขอ">{{ row.request_date ? new Date(row.request_date).toLocaleDateString('th-TH') : '-' }}</td>
        <td data-label="หัวข้อ">{{ row.subject }}</td>
        <td data-label="ผู้ร้องขอ">{{ row.requester }}</td>
        <td data-label="ระบบ">{{ row.system_name }}</td>
        <td class="text-center" data-label="ความสำคัญ">{{ row.priority }}</td>
        <td class="text-center" data-label="สถานะ">
          <span class="status-badge" :class="'status-' + row.status">
            {{ statusLabel(row.status) }}
          </span>
        </td>
        <td class="text-center" data-label="PDF">
          <button
            v-if="row.status === 'approved'"
            type="button"
            class="btn-icon-pdf"
            title="ดาวน์โหลด PDF ใบนี้"
            @click.stop="openCrPdf(row.cr_id)"
          >
            <i class="fa-solid fa-file-pdf"></i>
          </button>
          <span v-else style="color: var(--ink-light);">–</span>
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
      <button type="button" class="btn btn-pdf" :disabled="totalRows === 0" @click="generatePDF">
        <i class="fa-solid fa-file-pdf"></i> Download PDF ย้อนหลัง
      </button>
    </div>
  </div>
</template>

<style>
@import '../assets/css/form.css';

.list-container {
  max-width: 1120px;
}

.filter-grid {
  padding: var(--half);
  margin-bottom: var(--lh);
  background: #f4f6f9;
  border: 1px solid var(--line-faint);
}

.filter-grid .form-group {
  margin-bottom: var(--quarter);
}

.filter-actions {
  border-top: none;
  margin-top: var(--quarter);
  padding-top: 0;
  justify-content: flex-start;
}

.row-click {
  cursor: pointer;
}

.row-click:hover {
  background: rgba(0, 7, 90, 0.045);
}

.action-table td:first-child strong {
  font-weight: 700;
}

.btn-icon-pdf {
  background: none;
  border: none;
  color: var(--ink-light);
  font-size: 16px;
  cursor: pointer;
  padding: var(--quarter);
  min-height: 36px;
  min-width: 36px;
}

.btn-icon-pdf:hover {
  color: var(--seal);
}

@media screen and (max-width: 700px) {
  .list-container .table-wrapper {
    overflow-x: visible;
    background: none;
  }

  .list-container .action-table,
  .list-container .action-table tbody,
  .list-container .action-table tr,
  .list-container .action-table td {
    display: block;
    width: auto;
    min-width: 0;
  }

  .list-container .action-table {
    border: none;
  }

  .list-container .action-table thead {
    display: none;
  }

  .list-container .action-table tr {
    border: 1px solid var(--line-faint);
    margin-bottom: var(--half);
    padding: var(--quarter) var(--half);
  }

  .list-container .action-table td[colspan] {
    text-align: center;
  }

  .list-container .action-table td:not([colspan]) {
    display: grid;
    grid-template-columns: 104px 1fr;
    gap: var(--half);
    align-items: baseline;
    text-align: left;
    padding: 3px 0;
    border: none;
  }

  .list-container .action-table .status-badge {
    justify-self: start;
  }

  .list-container .action-table td:not([colspan])::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--ink-light);
  }

  .list-container .action-table td:first-child {
    display: block;
    padding-bottom: var(--quarter);
    margin-bottom: var(--quarter);
    border-bottom: 1px solid var(--line-faint);
    font-size: 17px;
  }

  .list-container .action-table td:first-child::before {
    content: none;
  }
}
</style>
