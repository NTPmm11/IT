require("dotenv").config();

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const authRoutes = require("./routes/auth");
const systemRoutes = require("./routes/systems");
const crRoutes = require("./routes/cr");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/systems", systemRoutes);
app.use("/api/change-requests", crRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.warn("⚠️  ไม่มีการยืนยันตัวตนจริง: backend เชื่อ header X-User-Id ตรงๆ ใครก็สวมเป็น user คนไหนก็ได้ — ห้าม deploy ใช้งานจริง");
});

module.exports = app;
