const store = require("../services/store");

async function requireAuth(req, res, next) {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({ error: "Missing X-User-Id header" });
    }

    if (!/^\d+$/.test(userId) || !Number.isSafeInteger(Number(userId)) || Number(userId) < 1) {
      return res.status(401).json({ error: "Invalid X-User-Id header" });
    }

    const user = await store.getUser(userId);

    if (!user || ![1, true].includes(user.is_active)) {
      return res.status(401).json({ error: "Unknown user" });
    }

    req.user = { userId: user.user_id, username: user.username, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
