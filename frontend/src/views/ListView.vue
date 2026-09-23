<script>
import { apiFetch } from "../services/api.js";
import { commonMethods } from "../services/commonActions.js";
import { STATUS_LABEL } from "../services/constants.js";
import StatusModal from "../components/StatusModal.vue";

export default {
  components: { StatusModal },

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
      pageSize: 20,
      printing: false,
      statusMenuOpen: false,
      deleteTarget: null,
      deletePassword: "",
      deleting: false,
      deleteError: "",
      modal: { show: false, variant: "success", title: "", message: "" }
    };
  },

  mounted() {
    if (!localStorage.getItem("user")) {
      this.$router.push("/");
      return;
    }
    this.search();
    document.addEventListener("click", this.handleStatusMenuOutsideClick);
  },

  beforeUnmount() {
    document.removeEventListener("click", this.handleStatusMenuOutsideClick);
  },

  computed: {
    totalRows() {
      return this.rows.length;
    },

    selectedStatusLabel() {
      return this.statusOptions[this.filters.status] || "-- ทั้งหมด --";
    },

    seesOwnOnly() {
      return this.userRole === "requester";
    },
    isAdmin() {
      return this.userRole === "it_admin";
    },
    columnCount() {
      return this.isAdmin ? 9 : 8;
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

    chooseStatus(value) {
      this.filters.status = value;
      this.statusMenuOpen = false;
    },

    handleStatusMenuOutsideClick(event) {
      if (this.statusMenuOpen && this.$refs.statusSelect && !this.$refs.statusSelect.contains(event.target)) {
        this.statusMenuOpen = false;
      }
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
    },

    openDeleteConfirm(row) {
      this.deleteTarget = row;
      this.deletePassword = "";
      this.deleteError = "";
    },

    closeDeleteConfirm() {
      if (this.deleting) return;
      this.deleteTarget = null;
      this.deletePassword = "";
      this.deleteError = "";
    },

    async confirmDelete() {
      if (!this.deletePassword) {
        this.deleteError = "กรุณากรอกรหัสผ่านเพื่อยืนยัน";
        return;
      }
      this.deleting = true;
      this.deleteError = "";
      try {
        await apiFetch(`/change-requests/${this.deleteTarget.cr_id}`, {
          method: "DELETE",
          body: JSON.stringify({ password: this.deletePassword })
        });
        this.rows = this.rows.filter((r) => r.cr_id !== this.deleteTarget.cr_id);
        this.deleteTarget = null;
        this.deletePassword = "";
        this.modal = { show: true, variant: "success", title: "ลบสำเร็จ", message: "ลบประวัติคำขอเรียบร้อยแล้ว" };
      } catch (err) {
        this.deleteError = err.message;
      } finally {
        this.deleting = false;
      }
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
        <div class="custom-select" :class="{ open: statusMenuOpen }" ref="statusSelect">
          <button type="button" id="f-status" class="custom-select-trigger" @click="statusMenuOpen = !statusMenuOpen">
            <span>{{ selectedStatusLabel }}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <ul class="custom-select-options" v-if="statusMenuOpen">
            <li :class="{ active: filters.status === '' }" @click="chooseStatus('')">-- ทั้งหมด --</li>
            <li v-for="(label, value) in statusOptions" :key="value" :class="{ active: filters.status === value }"
              @click="chooseStatus(value)">
              {{ label }}
            </li>
          </ul>
        </div>
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
        <th v-if="isAdmin" class="text-center">จัดการ</th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="loading">
        <td :colspan="columnCount" class="text-center" style="padding: 20px;">กำลังโหลด...</td>
      </tr>

      <tr v-else-if="rows.length === 0">
        <td :colspan="columnCount" class="text-center" style="padding: 20px; color: #6b7280;">ไม่พบข้อมูล</td>
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
        <td v-if="isAdmin" class="text-center">
          <button
            type="button"
            class="btn-icon-delete"
            title="ลบประวัติ CR นี้"
            @click.stop="openDeleteConfirm(row)"
          >
            <i class="fa-solid fa-trash"></i>
          </button>
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

    <div v-if="deleteTarget" class="delete-modal-backdrop" @click.self="closeDeleteConfirm">
      <div class="delete-modal">
        <div class="delete-modal-header">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>ยืนยันการลบ {{ deleteTarget.cr_number }}</span>
        </div>
        <p class="delete-modal-text">
          การลบจะไม่สามารถกู้คืนข้อมูลคำขอนี้ได้อีก กรุณากรอกรหัสผ่านบัญชีของคุณเพื่อยืนยัน
        </p>
        <input
          type="password"
          v-model="deletePassword"
          class="delete-modal-input"
          placeholder="รหัสผ่านของคุณ"
          :disabled="deleting"
          @keyup.enter="confirmDelete"
        >
        <p v-if="deleteError" class="delete-modal-error">{{ deleteError }}</p>
        <div class="delete-modal-actions">
          <button type="button" class="btn btn-cancel" :disabled="deleting" @click="closeDeleteConfirm">ยกเลิก</button>
          <button type="button" class="btn btn-delete-confirm" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? "กำลังลบ..." : "ยืนยันลบ" }}
          </button>
        </div>
      </div>
    </div>

    <StatusModal :show="modal.show" :variant="modal.variant" :title="modal.title" :message="modal.message"
      @close="modal.show = false" />
  </div>
</template>

<style scoped>
@import '../assets/css/list.css';

.custom-select {
  position: relative;
  width: 100%;
}

.custom-select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  border: 1.5px solid #cdd1d6e1;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1.125rem;
  color: #1a0101;
  background-color: #ededee;
  cursor: pointer;
  text-align: left;
  transition: all 0.3s;
}

.custom-select-trigger i {
  color: #565b66;
  transition: transform 0.2s;
}

.custom-select.open .custom-select-trigger,
.custom-select-trigger:focus {
  border-color: #00075a;
  background-color: #fff;
  outline: none;
}

.custom-select.open .custom-select-trigger i {
  transform: rotate(180deg);
}

.custom-select-options {
  list-style: none;
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 6px 0;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15);
  max-height: 240px;
  overflow-y: auto;
  z-index: 20;
}

.custom-select-options li {
  padding: 8px 14px;
  font-size: 1.0625rem;
  color: #000000;
  cursor: pointer;
}

.custom-select-options li:hover,
.custom-select-options li.active {
  background-color: #000000;
  color: #ffffff;
}

.container {
  background: #ffffffb4;
  width: 100%;
  max-width: 950px;
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
  width: 100%;
  max-width: 950px;
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

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.page-btn {
  background: #000000;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(32, 32, 32, 0.863);
  transition: all 0.25s ease;
}

.page-btn:hover:not(:disabled) {
  background-color: #2b2b2b;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
}

.page-btn:disabled {
  background: #9ca3af;
  color: #e5e7eb;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.page-btn.active {
  background: linear-gradient(135deg, #5a0000, #00075a);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.678);
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
  margin-top: 15px;
}

.btn-icon-delete {
  background: none;
  border: none;
  color: #b91c1c;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.btn-icon-delete:hover {
  background: #fde2e2;
}

.delete-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.delete-modal {
  background: #fff;
  border-radius: 12px;
  width: min(420px, 100%);
  padding: 24px;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
}

.delete-modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #991b1b;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
}

.delete-modal-text {
  color: #4b5563;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
}

.delete-modal-input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #cdd1d6e1;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 8px;
}

.delete-modal-input:focus {
  border-color: #991b1b;
  outline: none;
}

.delete-modal-error {
  color: #dc2626;
  font-size: 13px;
  margin-bottom: 8px;
}

.delete-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.btn-delete-confirm {
  background: #991b1b;
  color: #fff;
}

.btn-delete-confirm:hover:not(:disabled) {
  background: #7f1d1d;
}

@media print {
  .ui-action-buttons {
    display: none !important;
  }
}

@media screen and (max-width: 768px) {
  .container {
    padding: 22px 16px;
    border-radius: 16px;
  }
}
</style>
