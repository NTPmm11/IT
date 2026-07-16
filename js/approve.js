// ============================================
// approve.js — โค้ดของหน้า approve.html (หน้าอนุมัติ)
// ============================================
//
// ภาพรวมการทำงาน:
// 1. ช่องกรอกผูกกับตัวแปรใน form ผ่าน v-model
// 2. ปุ่มยกเลิก/บันทึกร่าง/PDF ใช้ของร่วมจาก js/common.js
// 3. กด Submit -> handleSubmit() บันทึกผลการพิจารณา

const { createApp } = Vue;

createApp({

  // data() = "ตัวแปรของหน้านี้"
  data() {
    return {
      form: {
        comment: "",    // ความเห็นทีมพัฒนา/ผู้ประเมิน
        result: "",     // radio ผลการพิจารณา: approved / rejected / more-info
                        // เริ่มเป็นค่าว่าง = ยังไม่ได้เลือก
        approver: "",   // ชื่อผู้อนุมัติ
        date: ""        // วันที่พิจารณา
      }
    };
  },

  methods: {
    // ดึงปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) มาจาก js/common.js
    ...commonMethods,

    // ถูกเรียกตอนกดปุ่ม "บันทึกผลอนุมัติ" (@submit.prevent="handleSubmit")
    handleSubmit() {
      // พิมพ์ข้อมูลลง Console (เปิด F12 ดูได้)
      console.log("Approval data:", JSON.stringify(this.form, null, 2));

      alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว!");
    }
  }

// สั่ง Vue เริ่มทำงาน คุมพื้นที่ <div id="app"> ใน approve.html
}).mount("#app");
