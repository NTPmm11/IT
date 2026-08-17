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
      rows: [],          // เฉพาะแถวของหน้าที่กำลังดูอยู่ (backend ตัดหน้ามาให้แล้ว)
      allRows: [],       // ทุกแถวตาม filter ปัจจุบัน — โหลดเฉพาะตอนจะพิมพ์ PDF
      totalRows: 0,      // จำนวนทั้งหมดจาก header X-Total-Count
      loading: false,
      statusOptions: STATUS_LABEL,
      currentPage: 1,
      pageSize: 10,
      printing: false   // true ระหว่างพิมพ์ -> pagedRows คืนทุกแถว ไม่ตัดเหลือแค่หน้าปัจจุบัน
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
    // backend ตัดหน้าให้ที่ database แล้ว (?page=&pageSize=) — หน้านี้ไม่ slice เองอีก
    // เดิมดึงทุกแถวมาแล้วค่อยตัดฝั่ง client: ข้อมูลโตขึ้นเท่าไหร่ก็โหลดมาทั้งหมดเท่านั้น
    totalPages() {
      return Math.ceil(this.totalRows / this.pageSize) || 1;
    },
    pagedRows() {
      // ปุ่ม "Download PDF ย้อนหลัง" ต้องได้ทุกแถว ไม่ใช่แค่หน้าที่กำลังดูอยู่บนจอ
      return this.printing ? this.allRows : this.rows;
    }
  },

  methods: {
    ...commonMethods,

    statusLabel(status) {
      return STATUS_LABEL[status] || status;
    },

    // ตัด filter ที่ว่างออกก่อนต่อ query string — ไม่ส่ง param เปล่าไป backend
    filterParams() {
      const params = new URLSearchParams();
      if (this.filters.crNumber) params.set("crNumber", this.filters.crNumber);
      if (this.filters.status) params.set("status", this.filters.status);
      if (this.filters.date) params.set("date", this.filters.date);
      return params;
    },

    // ค้นใหม่ -> กลับหน้า 1 เสมอ กันค้างหน้าท้ายๆ ที่ผลค้นหาใหม่ไม่มีแล้ว
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

    // ปุ่ม PDF ต่อแถว — ไป ApproveView (มี form เต็มใบของ CR นี้อยู่แล้ว) พร้อม ?print=1
    // ให้เปิด print dialog ให้อัตโนมัติทันทีที่ข้อมูลโหลดเสร็จ (ดู mounted() ใน ApproveView.vue)
    openCrPdf(crId) {
      this.$router.push(`/approve?crId=${crId}&print=1`);
    },

    changePage(page) {
      if (page < 1 || page > this.totalPages || page === this.currentPage) return;
      this.currentPage = page;
      this.loadPage();   // เปลี่ยนหน้า = ไปขอแถวชุดใหม่จาก backend
    },

    // ทับ commonMethods.generatePDF (ตัวเดิมแค่ window.print() เฉยๆ) — หน้านี้ต้องสลับไปโชว์
    // ทุกแถวก่อนพิมพ์ (pagedRows อ่านค่า printing) ไม่งั้นได้ PDF แค่แถวที่เห็นในหน้าปัจจุบัน
    async generatePDF() {
      // หน้าจอมีแค่แถวของหน้าปัจจุบัน — ต้องไปขอทุกแถวตาม filter เดิมมาก่อน
      // (ไม่ใส่ page/pageSize = backend คืนครบทุกแถว)
      try {
        this.allRows = await apiFetch(`/change-requests?${this.filterParams()}`);
      } catch (err) {
        alert("เตรียมข้อมูลสำหรับพิมพ์ไม่สำเร็จ: " + err.message);
        return;
      }

      this.printing = true;
      await this.$nextTick();

      // บาง browser/OS ไม่ยิง afterprint ตอนปิด print dialog บางจังหวะ (เช่น cancel เร็วเกินไป)
      // -> printing ค้าง true ตลอด (ตารางไม่แบ่งหน้าอีกเลยจนกว่าจะ search/เปลี่ยนหน้าใหม่)
      // เพิ่ม focus เป็นตัวสำรอง: ปิด dialog แล้ว (ไม่ว่าพิมพ์จริงหรือ cancel) focus กลับมาที่ window เสมอ
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
      <!-- 1. สถานะกำลังโหลด -->
      <tr v-if="loading">
        <td colspan="8" class="text-center" style="padding: 20px;">กำลังโหลด...</td>
      </tr>

      <!-- 2. กรณีไม่มีข้อมูล -->
      <tr v-else-if="rows.length === 0">
        <td colspan="8" class="text-center" style="padding: 28px; color: var(--ink-light);">ไม่พบข้อมูล</td>
      </tr>

      <!-- 3. แสดงข้อมูล (ใช้ rows และตัวแปรเดิมของคุณ) -->
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
          <!-- @click.stop กัน event ไหลต่อไปโดน @click="openCr" ของ <tr> (ไม่งั้นเด้งไปหน้า approve ซ้อนก่อน print)
               PDF มีให้โหลดได้ก็ต่อเมื่อ CR ใบนี้ผ่านการอนุมัติแล้วเท่านั้น (ยังไม่อนุมัติ = ยังไม่มีผลพิจารณาให้ลงในเอกสาร) -->
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
      <!-- ไม่มีรายการก็ไม่มีอะไรให้พิมพ์ — ปิดปุ่มไว้ ไม่ใช่ปล่อยให้กดแล้วได้กระดาษเปล่า -->
      <button type="button" class="btn btn-pdf" :disabled="totalRows === 0" @click="generatePDF">
        <i class="fa-solid fa-file-pdf"></i> Download PDF ย้อนหลัง
      </button>
    </div>
  </div>
</template>

<style>
@import '../assets/css/form.css';

/* ทะเบียนเรื่องต้องการความกว้างมากกว่าหนังสือหนึ่งฉบับ */
.list-container {
  max-width: 1120px;
}

/* แถบค้นหาแยกตัวออกจากตาราง ด้วยพื้นอ่อนกับกรอบ — อ่านออกทันทีว่าส่วนนี้ไว้กรอกเงื่อนไข
   ไม่ใช่ข้อมูลผลลัพธ์ */
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

/* เลขที่หนังสือคือสิ่งที่คนกวาดตาหาก่อนเสมอ */
.action-table td:first-child strong {
  font-weight: 700;
}

/* ปุ่มออกเอกสารต่อแถว — ไอคอนในตาราง ไม่ใช่ปุ่มเต็มใบ */
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

/* ===== มือถือ: ทะเบียนเปลี่ยนจากตารางเป็นการ์ดรายฉบับ =====
   ตาราง 8 คอลัมน์บนจอ 375px ต่อให้เลื่อนแนวนอนได้ก็อ่านทีละแถวไม่ไหว
   (ต่างจากตารางแผนงานที่ต้องกรอกทีละช่อง ตารางนี้อ่านอย่างเดียว ยุบเป็นการ์ดได้)
   ชื่อคอลัมน์มาจาก data-label บนแต่ละ <td> */
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

  /* แถว "กำลังโหลด" / "ไม่พบข้อมูล" มี td เดียว ไม่ต้องมีป้ายชื่อคอลัมน์ */
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

  /* ตรายางกว้างตามข้อความ ไม่ยืดเต็มคอลัมน์ */
  .list-container .action-table .status-badge {
    justify-self: start;
  }

  .list-container .action-table td:not([colspan])::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--ink-light);
  }

  /* เลขที่ CR เป็นหัวการ์ด ไม่ใช่แถวข้อมูลแถวหนึ่ง */
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
