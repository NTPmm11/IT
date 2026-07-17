// ============================================
// form.js — โค้ดของหน้า form.html (ฟอร์ม CR)
// ============================================
//
// ภาพรวมการทำงาน:
// 1. ทุกช่องกรอกผูกกับตัวแปรใน form ผ่าน v-model
// 2. ตาราง action plan ไม่ได้เขียน <tr> ไว้ใน HTML ตรงๆ
//    แต่เก็บเป็น array ชื่อ rows แล้วให้ v-for วาดแถวตามข้อมูล
//    - เพิ่มแถว = push ข้อมูลเข้า array -> Vue วาดแถวใหม่ให้เอง
//    - ลบแถว   = เอาออกจาก array   -> Vue ลบแถวออกให้เอง
//    - เลขลำดับ = {{ index + 1 }} ใน HTML อัปเดตเองตลอด
// 3. กด Submit -> handleSubmit() -> ไปหน้า approve.html

const { createApp } = Vue;

createApp({

  // data() = "ตัวแปรของหน้านี้" — Vue คอยเฝ้าดูค่าพวกนี้
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
                            // เช่นติ๊ก 2 อัน -> ["App", "DB"]
        impact: "none",     // radio ผลกระทบ — เริ่มที่ "ไม่มีผลกระทบ"
        impactDetail: "",   // ช่องระบุระบบที่กระทบ (เปิดใช้เมื่อ impact = "other")
        downtime: false,    // checkbox เดี่ยว — ติ๊ก = true
        duration: "",       // ระยะเวลาที่คาดใช้
        deployDate: ""      // เป้าหมาย deploy
      },

      // ตาราง action plan — 1 object ใน array = 1 แถวในตาราง
      // เริ่มต้นมี 1 แถวว่างให้กรอกเลย
      rows: [
        { step: "", start: "", end: "", owner: "", note: "" }
      ],

      // ตัวเลือก dropdown ระบบ — โหลดจาก API ตอนหน้าเปิด (ดู mounted)
      systems: []
    };
  },

  // mounted() = ทำงานอัตโนมัติ 1 ครั้งตอนหน้าเปิดเสร็จ
  async mounted() {
    // ยังไม่ได้ login -> เด้งกลับหน้า login
    if (!localStorage.getItem("token")) {
      window.location.href = "index.html";
      return;
    }

    // เติมชื่อผู้ร้องขอ/แผนกจากข้อมูล user ที่ login ไว้
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    this.form.requester = user.fullName || "";
    this.form.department = user.department || "";

    // โหลดตัวเลือกระบบจาก DB มาใส่ dropdown
    try {
      this.systems = await apiFetch("/systems");
    } catch (err) {
      console.error("Load systems failed:", err.message);
    }
  },

  methods: {
    // ดึงปุ่มร่วม (ยกเลิก / บันทึกร่าง / PDF) มาจาก js/common.js
    // ... = แกะทุก method ใน commonMethods มาวางตรงนี้
    ...commonMethods,

    // ปุ่ม "+ เพิ่มขั้นตอนงาน" (@click="addRow")
    // push object ว่างเข้า array -> v-for เห็นข้อมูลเพิ่ม -> วาดแถวใหม่เอง
    addRow() {
      this.rows.push({ step: "", start: "", end: "", owner: "", note: "" });
    },

    // ปุ่ม "ลบ" ท้ายแถว (@click="deleteRow(index)")
    // index = ลำดับแถวที่ถูกกด (แถวแรก = 0)
    deleteRow(index) {
      if (this.rows.length > 1) {
        // splice(ตำแหน่ง, จำนวน) = เอาสมาชิกออกจาก array
        // เอาออก 1 ตัวตรงตำแหน่ง index -> Vue ลบแถวนั้นออกจากจอเอง
        this.rows.splice(index, 1);
      } else {
        // เหลือแถวเดียว ห้ามลบ — ฟอร์มต้องมีแผนอย่างน้อย 1 ขั้นตอน
        alert("ต้องมีแผนดำเนินงานอย่างน้อย 1 ขั้นตอน");
      }
    },

    // ถูกเรียกตอนกดปุ่ม Submit (@submit.prevent="handleSubmit")
    // ส่งข้อมูลฟอร์ม + แผนงานไปบันทึกลง DB ผ่าน backend
    async handleSubmit() {
      try {
        // key ฝั่งซ้าย = ชื่อ field ที่ backend รอรับ (ดู backend/src/routes/cr.js)
        const data = await apiFetch("/change-requests", {
          method: "POST",
          body: JSON.stringify({
            crNumber: this.form.crId,
            requestDate: this.form.requestDate,
            department: this.form.department,
            systemCode: this.form.system,
            contact: this.form.contact,
            priority: this.form.priority,
            subject: this.form.subject,
            problem: this.form.problem,
            requestDetail: this.form.request,
            impact: this.form.impact,
            impactDetail: this.form.impactDetail,
            downtime: this.form.downtime,
            duration: this.form.duration,
            deployDate: this.form.deployDate,
            changeTypes: this.form.changeTypes,
            plan: this.rows
          })
        });

        alert("ระบบได้ส่งคำขอ Change Request (CR) เข้าสู่ขั้นตอนการอนุมัติแล้ว!");

        // ไปหน้าอนุมัติต่อ พร้อมส่งเลข id ของ CR ที่เพิ่งบันทึกไปทาง URL
        window.location.href = "approve.html?crId=" + data.crId;
      } catch (err) {
        alert("บันทึกไม่สำเร็จ: " + err.message);
      }
    }
  }

// สั่ง Vue เริ่มทำงาน คุมพื้นที่ <div id="app"> ใน form.html
}).mount("#app");
