// ============================================
// form.js — โค้ดของหน้า form.html (ฟอร์ม CR)
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

const { createApp } = Vue;

createApp({

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
      // (form.html วาดด้วย v-for="s in systems" รอไว้แล้ว)
      systems: []
    };
  },


  

  // mounted() = ทำงานอัตโนมัติ 1 ครั้งตอนหน้าเปิดเสร็จ
  async mounted() {
    // TODO(LAB 6.1): กันคนไม่ได้ login แอบเข้าหน้านี้ตรงๆ
    //   ถ้า localStorage ไม่มี "user" -> เด้งกลับ index.html แล้ว return
    // hint: if (!localStorage.getItem("user")) { ... }

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
    // ดึงปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) มาจาก js/common.js
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

    // ปุ่ม "ลบ" ท้ายแถว (@click="deleteRow(index)")
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
      //   window.location.href = "approve.html?crId=" + data.crId;
      //
      //   catch -> alert("บันทึกไม่สำเร็จ: " + err.message);

      // ⛔ ของเก่า (แค่พิมพ์ลง Console) — LAB 6 ให้แทนที่ทั้งก้อนนี้
      console.log("CR data:", JSON.stringify({ ...this.form, plan: this.rows }, null, 2));
      alert("ระบบได้ส่งคำขอ Change Request (CR) เข้าสู่ขั้นตอนการอนุมัติแล้ว! (โหมดปลอม — ยังไม่ลง database)");
      window.location.href = "approve.html";
    }
  }
  

}).mount("#app");


// ============================================
// form.js — โค้ดของหน้า form.html (ฟอร์ม CR)
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
