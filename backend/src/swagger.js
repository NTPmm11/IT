// ============================================
// swagger.js — ตั้งค่า Swagger (API docs)
// ============================================
//
// swagger-jsdoc อ่านคอมเมนต์ @openapi เหนือแต่ละ route (ใน routes/*.js)
// แล้วประกอบเป็น OpenAPI spec ให้เอง — ไม่ต้องเขียน spec แยกไฟล์เอง
//
// เปิดดูได้ที่ http://localhost:4000/api-docs หลัง npm run dev

const swaggerJsdoc = require("swagger-jsdoc");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IT Change Request API",
      version: "1.0.0",
      description:
        "REST API for IT Change Request (CR) system.\n\n" +
        "⚠️ **ไม่ใช่ระบบยืนยันตัวตนจริง — ห้าม deploy ใช้งานจริง** " +
        "ทุก endpoint เชื่อ header `X-User-Id` ตรงๆ ใครก็สวมเป็น user คนไหนก็ได้ " +
        "รวมถึง it_admin การตรวจสิทธิ์ทั้งหมดจึงเป็นแค่ UX ไม่ใช่ security " +
        "(ดู middleware/auth.js และกล่องเตือนใน README.md)"
    },
    servers: [{ url: "http://localhost:4000" }],
    components: {
      securitySchemes: {
        // โปรเจกต์นี้ auth ด้วย header X-User-Id ธรรมดา (ดู middleware/auth.js)
        XUserId: { type: "apiKey", in: "header", name: "X-User-Id" }
      }
    }
  },
  // ไฟล์ที่มีคอมเมนต์ @openapi ให้ไปอ่าน
  apis: ["./src/routes/*.js"]
});

module.exports = swaggerSpec;
