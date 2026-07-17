// ============================================
// approve.js — โค้ดของหน้า approve.html (หน้าอนุมัติ)
// ============================================
//
// ★ LAB 7 — บันทึกผลอนุมัติลง database (ต้องผ่าน LAB 4C ฝั่ง backend ก่อน)
//
// โจทย์นี้มีของใหม่ 1 อย่าง: อ่านค่าจาก URL
// หน้า form (LAB 6) ส่งเลข CR มาทาง URL แบบนี้: approve.html?crId=7
// หน้านี้ต้องอ่านเลขนั้นมาใช้ตอนยิง API
//
// ติดตรงไหนดูเฉลย:  git diff main solution -- frontend/js/approve.js

const { createApp } = Vue;

createApp({

  data() {
    return {
      // เลข id ของ CR ที่กำลังพิจารณา — LAB 7 จะอ่านจาก URL มาใส่
      crId: null,

      form: {
        comment: "",    // ความเห็นทีมพัฒนา/ผู้ประเมิน
        result: "",     // radio ผลการพิจารณา: approved / rejected / more-info
        approver: "",   // ชื่อผู้อนุมัติ
        date: ""        // วันที่พิจารณา
      }
    };
  },

  // mounted() = ทำงานอัตโนมัติ 1 ครั้งตอนหน้าเปิดเสร็จ
  mounted() {
    // TODO(LAB 7.1): localStorage ไม่มี "user" -> เด้งกลับ index.html (ท่าเดียวกับ LAB 6.1)

    // TODO(LAB 7.2): อ่าน crId จาก URL
    // hint: this.crId = new URLSearchParams(window.location.search).get("crId");
    //   (URLSearchParams = ตัวแกะของหลัง ? ใน URL ให้เรา)

    // TODO(LAB 7.3): เติมชื่อผู้อนุมัติจาก localStorage (ท่าเดียวกับ LAB 6.2)
  },

  methods: {
    // ดึงปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) มาจาก js/common.js
    ...commonMethods,

    // ถูกเรียกตอนกดปุ่ม "บันทึกผลอนุมัติ" (@submit.prevent="handleSubmit")
    //
    // TODO(LAB 7.4): เติม async -> async handleSubmit()
    handleSubmit() {
      // TODO(LAB 7.5): เช็คของก่อนส่ง
      //   - this.crId ว่าง -> alert บอกให้เข้าหน้านี้ผ่านการ Submit ฟอร์ม แล้ว return
      //   - this.form.result ว่าง (ยังไม่เลือก radio) -> alert แล้ว return

      // TODO(LAB 7.6): ยิง API บันทึกผล (ครอบ try/catch)
      // hint:
      //   await apiFetch(`/change-requests/${this.crId}/approval`, {
      //     method: "POST",
      //     body: JSON.stringify({
      //       result: this.form.result,
      //       comment: this.form.comment,
      //       approvalDate: this.form.date
      //     })
      //   });
      //   (`...${...}...` = template string — แทนค่าตัวแปรกลาง string ได้)
      //
      //   สำเร็จ -> alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว!")
      //   catch  -> alert("บันทึกไม่สำเร็จ: " + err.message)
      //
      //   โจทย์แถม: ลอง login ด้วย somchai (role requester) แล้วกดบันทึก
      //   ต้องเจอ "Forbidden: insufficient role" — นั่นคือฝีมือ LAB 3.4

      // ⛔ ของเก่า — LAB 7 ให้แทนที่ทั้งก้อนนี้
      console.log("Approval data:", JSON.stringify(this.form, null, 2));
      alert("บันทึกผลการพิจารณาเรียบร้อยแล้ว! (โหมดปลอม — ยังไม่ลง database)");
    }
  }

}).mount("#app");
