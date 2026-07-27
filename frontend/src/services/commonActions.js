// ============================================
// commonActions.js — method ที่ใช้ร่วมกันหลายหน้า
// ============================================
//
// เดิมคือ js/common.js — ปุ่ม "ยกเลิก / PDF" ใช้ร่วมกันใน FormView และ ListView เลยรวมไว้ที่เดียวตรงนี้
// (บันทึกร่างย้ายไปเขียนตรงใน FormView.vue เอง เพราะต้อง apiFetch ส่ง this.form จริง
//  ไม่ใช่แค่ alert เฉยๆ แบบเดิม — ดู handleSaveDraft() ใน FormView.vue)
//
// วิธีใช้ (ดูใน FormView.vue / ApproveView.vue):
//   methods: { ...commonMethods, methodอื่นของหน้านั้น }
//   เครื่องหมาย ... = "แกะทุก method ในนี้ไปวางตรงนั้น"
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง (import ไฟล์นี้): views/FormView.vue, views/ListView.vue (...commonMethods ใน methods)
// ปลายทาง: ไม่เรียก apiFetch/backend เลย — ทุก method ในนี้เป็น UI ล้วนๆ (alert, window.print)
// ไม่ผูกกับ component ไหนโดยเฉพาะ เลยแยกเป็น plain object ธรรมดา (ไม่ใช่ .vue) ใช้ spread ผสมเข้า
// methods ของ component อื่นได้ตรงๆ ไม่ต้องทำเป็น mixin/component ซ้อนให้ซับซ้อน

export const commonMethods = {

  // ปุ่ม "ยกเลิก (Cancel)"
  cancelForm() {
    alert("ยกเลิกทำรายการ");
  },

  // ปุ่ม "พิมพ์เอกสาร (PDF)"
  // window.print() = เปิดหน้าพิมพ์ของ browser -> เลือก Save as PDF ได้
  // ปุ่มต่างๆ จะไม่ติดไปในกระดาษ เพราะ base.css ซ่อนไว้ใน @media print
  generatePDF() {
    window.print();
  }
};
