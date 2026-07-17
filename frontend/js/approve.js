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
      // เลข id ของ CR ที่กำลังพิจารณา — อ่านจาก URL ตอนหน้าเปิด (ดู mounted)
      crId: null,

      form: {
        comment: "",    // ความเห็นทีมพัฒนา/ผู้ประเมิน
        result: "",     // radio ผลการพิจารณา: approved / rejected / more-info
                        // เริ่มเป็นค่าว่าง = ยังไม่ได้เลือก
        approver: "",   // ชื่อผู้อนุมัติ
        date: ""        // วันที่พิจารณา
      }
    };
  },

  // mounted() = ทำงานอัตโนมัติ 1 ครั้งตอนหน้าเปิดเสร็จ
  mounted() {
    // ยังไม่ได้ login -> เด้งกลับหน้า login
    if (!localStorage.getItem("token")) {
      window.location.href = "index.html";
      return;
    }

    // อ่าน crId จาก URL เช่น approve.html?crId=7
    // (หน้า form ส่งมาให้ตอน submit สำเร็จ)
    this.crId = new URLSearchParams(window.location.search).get("crId");

    // เติมชื่อผู้อนุมัติจากข้อมูล user ที่ login ไว้
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    this.form.approver = user.fullName || "";
  },

  methods: {
    // ดึงปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) มาจาก js/common.js
    ...commonMethods,

    // ถูกเรียกตอนกดปุ่ม "บันทึกผลอนุมัติ" (@submit.prevent="handleSubmit")
    // ส่งผลพิจารณาไปบันทึกลง DB — backend จะ update สถานะ CR ให้ด้วย
    async handleSubmit() {
      if (!this.crId) {
        alert("ไม่พบเลขที่ CR — กรุณาเข้าหน้านี้ผ่านการ Submit ฟอร์ม");
        return;
      }
      if (!this.form.result) {
        alert("กรุณาเลือกผลการพิจารณา");
        return;
      }

      try {
        await apiFetch(`/change-requests/${this.crId}/approval`, {
          method: "POST",
          body: JSON.stringify({
            result: this.form.result,
            comment: this.form.comment,
            approvalDate: this.form.date
          })
        });

        alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว!");
      } catch (err) {
        alert("บันทึกไม่สำเร็จ: " + err.message);
      }
    }
  }

// สั่ง Vue เริ่มทำงาน คุมพื้นที่ <div id="app"> ใน approve.html
}).mount("#app");
