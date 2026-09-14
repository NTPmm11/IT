
const express = require("express");
const bcrypt = require("bcryptjs");
const store = require("../services/store");

const router = express.Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login สำเร็จ ได้ข้อมูล user กลับมา }
 *       400: { description: กรอกข้อมูลไม่ครบ }
 *       401: { description: Username หรือ password ไม่ถูกต้อง }
 */
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return res.status(400).json({ error: "ต้องกรอก username และ password" });
    }

    const user = await store.findUser(username);

    if (
      !user ||
      typeof user.password_hash !== "string" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({ error: "Username หรือ password ไม่ถูกต้อง" });
    }

    res.json({
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        department: user.department,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
