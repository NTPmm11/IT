
const express = require("express");
const store = require("../services/store");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/systems:
 *   get:
 *     summary: รายชื่อระบบ (สำหรับ dropdown)
 *     tags: [Systems]
 *     responses:
 *       200: { description: รายการระบบที่ยังเปิดใช้งาน }
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const systemRows = await store.systems();

    res.json(systemRows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
