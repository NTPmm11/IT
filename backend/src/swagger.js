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
        XUserId: { type: "apiKey", in: "header", name: "X-User-Id" }
      }
    }
  },
  apis: ["./src/routes/*.js"]
});

module.exports = swaggerSpec;
