export const commonMethods = {

  cancelForm() {
    if (!confirm("ยกเลิกรายการนี้? ข้อมูลที่กรอกไว้จะไม่ถูกบันทึก")) return;
    this.$router.push("/home");
  },

  generatePDF() {
    window.print();
  }
};
