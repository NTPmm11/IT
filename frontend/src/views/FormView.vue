<script>
// ============================================
// FormView.vue — เดิมคือ form.html + js/form.js
// ============================================
//
// ★ LAB 6 — ส่งฟอร์มลง database จริง (ต้องผ่าน LAB 1, 4B ฝั่ง backend ก่อน)
//
// ภาพรวมการทำงาน (ของเดิมที่ยังใช้อยู่):
// 1. ทุกช่องกรอกผูกกับตัวแปรใน form ผ่าน v-model
// 2. ตาราง action plan เก็บเป็น array ชื่อ rows แล้วให้ v-for วาดแถวตามข้อมูล
//    - เพิ่มแถว = push เข้า array / ลบแถว = splice ออก -> Vue วาดจอให้เอง
//
// ของใหม่ที่ LAB นี้ต้องทำ:
// - โหลด dropdown ระบบจาก API ตอนหน้าเปิด (mounted)
// - กด Submit แล้วส่งข้อมูลทั้งฟอร์มไปเก็บลง database
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- frontend/js/form.js

import { apiFetch } from "../services/api.js";
import { commonMethods } from "../services/commonActions.js";

export default {
  data() {
    return {

      // ข้อมูลฟอร์มหลัก — 1 ตัวแปรต่อ 1 ช่องกรอก (ผูกด้วย v-model)
      form: {
        crId: "",           // เลขที่เอกสาร
        requestDate: "",    // วันที่ร้องขอ
        requester: "",      // ชื่อผู้ร้องขอ
        department: "",     // แผนก/ฝ่าย
        system: "",         // dropdown ระบบที่เกี่ยวข้อง
        contact: "",        // อีเมล/เบอร์โทร
        priority: "Low",    // radio — ค่าเริ่มต้นเลือก Low ไว้ก่อน
        subject: "",        // หัวข้อการเปลี่ยน
        problem: "",        // ปัญหาที่พบ
        request: "",        // สิ่งที่ต้องการให้ปรับปรุง
        changeTypes: [],    // checkbox หลายอัน — ติ๊กอันไหน ค่าเข้า array นี้
        impact: "none",     // radio ผลกระทบ — เริ่มที่ "ไม่มีผลกระทบ"
        impactDetail: "",   // ช่องระบุระบบที่กระทบ (เปิดใช้เมื่อ impact = "other")
        downtime: false,    // checkbox เดี่ยว — ติ๊ก = true
        duration: "",       // ระยะเวลาที่คาดใช้
        deployDate: ""      // เป้าหมาย deploy
      },

      // ตาราง action plan — 1 object ใน array = 1 แถวในตาราง
      rows: [
        { step: "", Date:"", start: "", Date:"", end: "", owner: "", note: "" }
      ],
        rows2: [
        { step2: "", Date2:"",start2: "", Date2:"", end2: "", owner2: "", note2: "" }
      ],

      // ตัวเลือก dropdown ระบบ — LAB 6 จะโหลดจาก API มาใส่ตัวนี้
      // (เดิม form.html วาดด้วย v-for="s in systems" รอไว้แล้ว)
      systems: []
    };
  },

  // mounted() = ทำงานอัตโนมัติ 1 ครั้งตอนหน้าเปิดเสร็จ
  async mounted() {
    // TODO(LAB 6.1): กันคนไม่ได้ login แอบเข้าหน้านี้ตรงๆ
    //   ถ้า localStorage ไม่มี "user" -> เด้งกลับหน้า login (path "/") แล้ว return
    // hint: if (!localStorage.getItem("user")) { this.$router.push("/"); return; }

    // TODO(LAB 6.2): เติมชื่อผู้ร้องขอ/แผนกอัตโนมัติจากข้อมูลที่เก็บตอน login
    // hint:
    //   const user = JSON.parse(localStorage.getItem("user") || "{}");
    //   this.form.requester = user.fullName || "";
    //   this.form.department = user.department || "";

    // TODO(LAB 6.3): โหลดตัวเลือก dropdown จาก API
    //   this.systems = await apiFetch("/systems");
    //   ครอบ try/catch — โหลดพลาดอย่าให้ทั้งหน้าพัง แค่ console.error พอ
  },

  methods: {
    // ดึงปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) มาจาก services/commonActions.js
    ...commonMethods,

    // ปุ่ม "+ เพิ่มขั้นตอนงาน" (@click="addRow")
    addRow() {
      this.rows.push({ step: "", start: "", end: "", owner: "", note: "" });
    },

    // ปุ่ม "ลบ" ท้ายแถว (@click="deleteRow(index)")
    deleteRow(index) {
      if (this.rows.length > 1) {
        this.rows.splice(index, 1);
      } else {
        alert("ต้องมีแผนดำเนินงานอย่างน้อย 1 ขั้นตอน");
      }
    },

    addRow2() {
      this.rows2.push({ step2: "", start2: "", Date2:"", end2: "", owner2: "", note2: "" });
    },

    // ปุ่ม "ลบ" ท้ายแถว (@click="deleteRow2(index)")
    deleteRow2(index) {
      if (this.rows2.length > 1) {
        this.rows2.splice(index, 1);
      } else {
        alert("ต้องมีแผนดำเนินงานอย่างน้อย 1 ขั้นตอน");
      }
    },

    // ถูกเรียกตอนกดปุ่ม Submit (@submit.prevent="handleSubmit")
    //
    // TODO(LAB 6.4): เติม async ข้างหน้า -> async handleSubmit()
    handleSubmit() {
      // TODO(LAB 6.5): เปลี่ยนจาก console.log เป็นยิง API จริง
      //   ครอบ try/catch แล้วใน try:
      //
      //   const data = await apiFetch("/change-requests", {
      //     method: "POST",
      //     body: JSON.stringify({
      //       crNumber: this.form.crId,        // ← ชื่อฝั่งซ้ายต้องตรงกับ
      //       requestDate: this.form.requestDate,  //   ที่ backend รอรับ (LAB 4B)
      //       department: this.form.department,
      //       systemCode: this.form.system,
      //       contact: this.form.contact,
      //       priority: this.form.priority,
      //       subject: this.form.subject,
      //       problem: this.form.problem,
      //       requestDetail: this.form.request,
      //       impact: this.form.impact,
      //       impactDetail: this.form.impactDetail,
      //       downtime: this.form.downtime,
      //       duration: this.form.duration,
      //       deployDate: this.form.deployDate,
      //       changeTypes: this.form.changeTypes,
      //       plan: this.rows
      //     })
      //   });
      //
      //   สำเร็จ -> alert แล้วพาไปหน้าอนุมัติพร้อมแนบเลข CR:
      //   this.$router.push("/approve?crId=" + data.crId);
      //
      //   catch -> alert("บันทึกไม่สำเร็จ: " + err.message);

      // ⛔ ของเก่า (แค่พิมพ์ลง Console) — LAB 6 ให้แทนที่ทั้งก้อนนี้
      console.log("CR data:", JSON.stringify({ ...this.form, plan: this.rows }, null, 2));
      alert("ระบบได้ส่งคำขอ Change Request (CR) เข้าสู่ขั้นตอนการอนุมัติแล้ว! (โหมดปลอม — ยังไม่ลง database)");
      this.$router.push("/approve");
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

    <!-- @submit.prevent = ส่งฟอร์มแล้วเรียก handleSubmit() โดยไม่ reload หน้า -->
    <form @submit.prevent="handleSubmit">

      <!-- [ 1. ข้อมูลทั่วไป ] -->
      <div class="section-title">
        <div>1. ข้อมูลทั่วไป (General Information)</div>
      </div>

      <div class="grid-2col">

        <div class="form-group">
          <label for="cr-id">เลขที่เอกสาร (CR ID):</label>
          <input type="text" id="cr-id" v-model="form.crId" placeholder="ระบุเลขที่เอกสาร เช่น CR6908001">
        </div>

        <div class="form-group">
          <label for="cr-request-date">วันที่ร้องขอ:</label>
          <input type="date" id="cr-request-date" v-model="form.requestDate">
        </div>

        <div class="form-group">
          <label for="cr-requester">ผู้ร้องขอ (Requester):</label>
          <input type="text" id="cr-requester" v-model="form.requester" placeholder="ชื่อ-สกุลผู้ร้องขอ">
        </div>

        <div class="form-group">
          <label for="cr-department">แผนก/ฝ่าย:</label>
          <input type="text" id="cr-department" v-model="form.department" placeholder="ระบุแผนก/ฝ่าย">
        </div>

        <div class="form-group">
          <label for="cr-system">ระบบที่เกี่ยวข้อง:</label>
          <select id="cr-system" v-model="form.system" required>
            <option value="">-- เลือกโครงการ/ระบบงาน --</option>
               <option value="web-portal">Server</option>
            <option value="mobile-app">Network</option>
            <option value="sap">Database</option>
               <option value="sap">Application</option>
                  <option value="sap">Backup</option>
                     <option value="sap">UPS</option>
          </select>
        </div>

        <div class="form-group">
          <label for="cr-contact">อีเมล/เบอร์โทร:</label>
          <input type="text" id="cr-contact" v-model="form.contact" placeholder="ระบุอีเมลหรือเบอร์โทรติดต่อ">
        </div>

      </div>

      <div class="form-group" style="margin-top: 10px;">
        <label>ระดับความสำคัญ (Priority):</label>
        <div class="options-group">
          <label class="option-item"><input type="radio" value="Low" v-model="form.priority"> Low
            (ไม่กระทบงานหลัก)</label>
          <label class="option-item"><input type="radio" value="Medium" v-model="form.priority"> Medium
            (มีระบบสำรอง)</label>
          <label class="option-item"><input type="radio" value="High" v-model="form.priority"> High (เร่งด่วน)</label>
          <label class="option-item"><input type="radio" value="Critical" v-model="form.priority"> Critical
            (ระบบหยุดทำงาน)</label>
        </div>
      </div>

      <!-- [ 2. รายละเอียดการขอเปลี่ยนระบบ ] -->
      <div class="section-title">
        <div>2. รายละเอียดการขอเปลี่ยนระบบ (Change Details)</div>
        <span class="note">*ส่วนสำหรับผู้ร้องขอกรอก</span>
      </div>

      <div class="form-group">
        <label for="cr-subject">หัวข้อการเปลี่ยน (Subject):</label>
        <input type="text" id="cr-subject" v-model="form.subject"
          placeholder="ระบุชื่อเรื่อง เช่น เพิ่มปุ่มดาวน์โหลดรายงาน PDF ในหน้า Dashboard..." required>
      </div>

      <div class="form-group align-top">
        <label for="cr-problem">สถานะปัจจุบัน / ปัญหาที่พบ:</label>
        <textarea id="cr-problem" v-model="form.problem" rows="3"
          placeholder="อธิบายสภาพปัญหาปัจจุบัน หรือเหตุผลความจำเป็น..."></textarea>
      </div>

      <div class="form-group align-top">
        <label for="cr-request">สิ่งที่ต้องการให้ปรับปรุง:</label>
        <textarea id="cr-request" v-model="form.request" rows="3"
          placeholder="ระบุรายละเอียด เงื่อนไข หรือขั้นตอนของระบบใหม่ที่ต้องการให้พัฒนา..."></textarea>
      </div>

      <!-- [ 3. การประเมินผลกระทบ ] -->
      <div class="section-title">
        <div>3. การประเมินผลกระทบและทรัพยากร (Impact & Resource Assessment)</div>
        <span class="note">*เฉพาะสิทธิ์ IT / Admin</span>
      </div>

      <div class="form-group">
        <label>ประเภทการเปลี่ยน:</label>
        <div class="options-group">
          <label class="option-item"><input type="checkbox" value="App" v-model="form.changeTypes"> Application /
            Software</label>
          <label class="option-item"><input type="checkbox" value="DB" v-model="form.changeTypes"> Database
            Schema</label>
          <label class="option-item"><input type="checkbox" value="Infra" v-model="form.changeTypes">
            Infrastructure</label>
        </div>
      </div>

      <div class="form-group">
        <label>ผลกระทบระบบ:</label>
        <div class="options-group">
          <label class="option-item"><input type="radio" value="none" v-model="form.impact">
            ไม่มีผลกระทบส่วนอื่น</label>
          <label class="option-item"><input type="radio" value="other" v-model="form.impact"> กระทบระบบอื่น
            (ระบุ):</label>
          <input type="text" v-model="form.impactDetail" :disabled="form.impact !== 'other'"
            placeholder="ระบุระบบที่ได้รับผลกระทบ...">
          <label class="option-item"><input type="checkbox" v-model="form.downtime"> ต้องปิดระบบชั่วคราว
            (Downtime)</label>
        </div>
      </div>

      <div class="grid-2col" style="margin-top: 10px;">
        <div class="form-group">
          <label for="cr-duration">ระยะเวลาที่คาดใช้:</label>
          <input type="text" id="cr-duration" v-model="form.duration" placeholder="ระบุจำนวนวันทำการ เช่น 2 วัน">
        </div>
        <div class="form-group">
          <label for="cr-deploy-date">เป้าหมาย Deploy:</label>
          <input type="date" id="cr-deploy-date" v-model="form.deployDate">
        </div>
      </div>

      <!-- [ 4. แผนดำเนินงาน ] -->
      <div class="section-title">
        <div>แผนดำเนินงาน (Action Plan)</div>
        <span class="note">*โปรดระบุขั้นตอนและกำหนดเวลาปฏิบัติงาน</span>
      </div>

      <div class="table-wrapper">
        <table class="action-table">
          <thead>
            <tr>
              <th style="width:40px;">ลำดับ</th>
              <th>ขั้นตอนงาน</th>
              <th style="width:100px;">วัน/เดือน/ปี</th>
              <th style="width:100px;">เวลาเริ่ม</th>
              <th style="width:100px;">วัน/เดือน/ปี</th>
              <th style="width:100px;">สิ้นสุด</th>
              <th>หมายเหตุ</th>
              <th style="width:60px;">ลบ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="index">
              <td class="text-center">{{ index + 1 }}</td>
              <td><input type="text" v-model="row.step" placeholder="ระบุขั้นตอนงาน" required></td>
              <td><input type="date" v-model="row.Date" required></td>
              <td><input type="time" v-model="row.start" required></td>
              <td><input type="date" v-model="row.Date" required></td>
              <td><input type="time" v-model="row.end" required></td>
              <td><input type="text" v-model="row.note" placeholder="หมายเหตุ"></td>
              <td class="text-center">
                <button type="button" class="btn-delete-row" @click="deleteRow(index)">ลบ</button>
              </td>
            </tr>
          </tbody>
        </table>

        <button type="button" class="btn-add-row" @click="addRow">
          + เพิ่มขั้นตอนงาน
        </button>
      </div>

      <div class="section-title">
        <div>แผนการกู้คืน(Roll Back Plan)</div>
      </div>

      <table class="action-table">
        <thead>
          <tr>
            <th style="width:40px;">ลำดับ</th>
            <th>ขั้นตอนงาน</th>
            <th style="width:0px;">วัน/เดือน/ปี</th>
            <th style="width:100px;">เวลาเริ่ม</th>
            <th style="width:100px;">วัน/เดือน/ปี</th>
            <th style="width:100px;">เวลาสิ้นสุด</th>
            <th>หมายเหตุ</th>
            <th style="width:60px;">ลบ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row2, index) in rows2" :key="index">
            <td class="text-center">{{ index + 1 }}</td>
            <td><input type="text" v-model="row2.step2" placeholder="ระบุขั้นตอนงาน" required></td>
            <td><input type="date" v-model="row2.Date2" required></td>
            <td><input type="time" v-model="row2.start2" required></td>
            <td><input type="date" v-model="row2.Date2" required></td>
            <td><input type="time" v-model="row2.end2" required></td>
            <td><input type="text" v-model="row2.note2" placeholder="หมายเหตุ"></td>
            <td class="text-center">
              <button type="button" class="btn-delete-row" @click="deleteRow2(index)">ลบ</button>
            </td>
          </tr>
        </tbody>
      </table>

      <button type="button" class="btn-add-row" @click="addRow2">
        + เพิ่มขั้นตอนงาน
      </button>

      <div class="ui-action-buttons">
        <button type="button" class="btn btn-cancel" @click="cancelForm">
          <i class="fa-solid fa-xmark"></i> ยกเลิก (Cancel)
        </button>

        <button type="submit" class="btn btn-submit">
          <i class="fa-solid fa-paper-plane"></i> ส่งคำขออนุมัติ (Submit CR)
        </button>
      </div>

    </form>
  </div>
</template>

<style>
@import '../assets/css/form.css';
</style>
