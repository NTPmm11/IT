// ============================================
// commonActions.js — method ที่ใช้ร่วมกันหลายหน้า
// ============================================
//
// เดิมคือ js/common.js — ปุ่ม "ยกเลิก / บันทึกร่าง / PDF" ใช้ร่วมกันใน
// FormView และ ApproveView เลยรวมไว้ที่เดียวตรงนี้
//
// วิธีใช้ (ดูใน FormView.vue / ApproveView.vue):
//   methods: { ...commonMethods, methodอื่นของหน้านั้น }
//   เครื่องหมาย ... = "แกะทุก method ในนี้ไปวางตรงนั้น"

export const commonMethods = {

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
