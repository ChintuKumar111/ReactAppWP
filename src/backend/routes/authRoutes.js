const express = require("express");
const router = express.Router();
const db = require("../db");

// 🔐 LOGIN API
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // ✅ Validate input
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  const sql = "SELECT * FROM auth_users WHERE username = ?";

  db.query(sql, [username], (err, result) => {
    if (err) return res.status(500).send(err);

    if (result.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result[0];

    if (user.password !== password) {
      return res.status(400).json({ message: "Wrong password" });
    }

    if (user.status === "paused") {
      return res.status(403).json({ message: "Account is paused" });
    }

    res.json({
      message: "Login successful",
      role: user.role,
      userId: user.id
    });
  });
});

module.exports = router;