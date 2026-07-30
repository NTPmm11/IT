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
      description: "REST API for IT Change Request (CR) system"
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
