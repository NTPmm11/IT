// ============================================
// common.js — method ที่ใช้ร่วมกันหลายหน้า
// ============================================
//
// ปัญหาที่ไฟล์นี้แก้: ปุ่ม "ยกเลิก / บันทึกร่าง / PDF" มีทั้งใน
// form.html และ approve.html ถ้าเขียนโค้ดซ้ำ 2 ที่
// เวลาแก้ต้องไล่แก้ 2 ที่ -> เลยรวมไว้ที่เดียวตรงนี้
//
// วิธีใช้ (ดูใน form.js / approve.js):
// 1. HTML ต้องโหลดไฟล์นี้ "ก่อน" ไฟล์ของหน้านั้น
//    <script src="js/common.js"></script>
//    <script src="js/form.js"></script>
// 2. ในหน้านั้นเอาไปแตกใส่ methods ด้วย spread (...):
//    methods: { ...commonMethods, methodอื่นของหน้านั้น }
//    เครื่องหมาย ... = "แกะทุก method ในนี้ไปวางตรงนั้น"

const commonMethods = {

  // ปุ่ม "ยกเลิก (Cancel)"
  cancelForm() {
    alert("ยกเลิกทำรายการ");
  },

  // ปุ่ม "บันทึกร่าง (Save Draft)"
  saveDraft() {
    alert("บันทึกแบบร่างสำเร็จ");
  },

  // ปุ่ม "พิมพ์เอกสาร (PDF)"
  // window.print() = เปิดหน้าพิมพ์ของ browser -> เลือก Save as PDF ได้
  // ปุ่มต่างๆ จะไม่ติดไปในกระดาษ เพราะ base.css ซ่อนไว้ใน @media print
  generatePDF() {
    window.print();
  }
};
