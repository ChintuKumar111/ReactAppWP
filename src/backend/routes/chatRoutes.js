const express = require("express");
const router = express.Router();
const db = require("../db");
const config = require("../config");
const {
  extractInboundMessages,
  hasWhatsAppConfig,
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
} = require("../whatsapp");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

async function findOrCreateUserByPhone(phone, name) {
  const users = await runQuery("SELECT * FROM users WHERE phone = ? LIMIT 1", [phone]);

  if (users.length > 0) {
    return users[0];
  }

  const insertResult = await runQuery(
    "INSERT INTO users (name, phone) VALUES (?, ?)",
    [name || "WhatsApp User", phone]
  );

  const createdUsers = await runQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [insertResult.insertId]);
  return createdUsers[0];
}

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  try {
    const inboundMessages = extractInboundMessages(req.body);

    for (const inboundMessage of inboundMessages) {
      const user = await findOrCreateUserByPhone(inboundMessage.from, inboundMessage.name);

      await runQuery(
        "INSERT INTO messages (user_id, message, sender) VALUES (?, ?, ?)",
        [user.id, inboundMessage.text, "customer"]
      );

      if (req.io) {
        req.io.emit("newMessage", {
          userId: user.id,
          message: inboundMessage.text,
          sender: "customer",
        });
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook processing failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/users", (req, res) => {
  db.query(
    `
      SELECT
        u.id,
        u.name,
        u.phone,
        latest.message AS last_message,
        latest.created_at AS last_seen,
        latest.sender AS last_sender,
        COALESCE(customer_counts.customer_message_count, 0) AS customer_message_count,
        customer_latest.last_customer_message_id,
        customer_latest.last_customer_message_at
      FROM users u
      LEFT JOIN (
        SELECT m1.user_id, m1.message, m1.created_at, m1.sender
        FROM messages m1
        INNER JOIN (
          SELECT user_id, MAX(created_at) AS max_created_at
          FROM messages
          GROUP BY user_id
        ) recent
          ON recent.user_id = m1.user_id
         AND recent.max_created_at = m1.created_at
      ) latest
        ON latest.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS customer_message_count
        FROM messages
        WHERE sender = 'customer'
        GROUP BY user_id
      ) customer_counts
        ON customer_counts.user_id = u.id
      LEFT JOIN (
        SELECT
          m.user_id,
          m.id AS last_customer_message_id,
          m.created_at AS last_customer_message_at
        FROM messages m
        INNER JOIN (
          SELECT user_id, MAX(id) AS last_customer_message_id
          FROM messages
          WHERE sender = 'customer'
          GROUP BY user_id
        ) customer_max
          ON customer_max.user_id = m.user_id
         AND customer_max.last_customer_message_id = m.id
      ) customer_latest
        ON customer_latest.user_id = u.id
      ORDER BY latest.created_at DESC, u.id DESC
    `,
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(result);
    }
  );
});

router.get("/messages/:userId", (req, res) => {
  const userId = req.params.userId;

  db.query(
    "SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC, id ASC",
    [userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(result);
    }
  );
});

router.post("/send-message", async (req, res) => {
  const { userId, message } = req.body;

  try {
    const trimmedMessage = String(message || "").trim();

    if (!userId || !trimmedMessage) {
      return res.status(400).json({ error: "userId and message are required." });
    }

    if (!hasWhatsAppConfig()) {
      return res.status(500).json({
        error: "WhatsApp Cloud API is not configured on the server.",
      });
    }

    const users = await runQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
    const user = users[0];

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!user.phone) {
      return res.status(400).json({ error: "Selected user does not have a phone number." });
    }

    const whatsappResponse = await sendWhatsAppTextMessage(user.phone, trimmedMessage);

    await runQuery(
      "INSERT INTO messages (user_id, message, sender) VALUES (?, ?, 'admin')",
      [userId, trimmedMessage]
    );

    const newMsg = {
      user_id: userId,
      message: trimmedMessage,
      sender: "admin",
      whatsappMessageId: whatsappResponse?.messages?.[0]?.id || null,
    };

    if (req.io) {
      req.io.emit("newMessage", newMsg);
    }

    return res.json({ success: true, whatsapp: whatsappResponse });
  } catch (error) {
    console.error("Send message failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/send-template-message", async (req, res) => {
  const { userId, templateName, languageCode, bodyParameters } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    if (!hasWhatsAppConfig()) {
      return res.status(500).json({
        error: "WhatsApp Cloud API is not configured on the server.",
      });
    }

    const users = await runQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
    const user = users[0];

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!user.phone) {
      return res.status(400).json({ error: "Selected user does not have a phone number." });
    }

    const chosenTemplateName = String(templateName || config.whatsapp.defaultTemplateName || "").trim();
    const chosenLanguageCode = String(languageCode || config.whatsapp.defaultTemplateLanguage || "en_US").trim();

    if (!chosenTemplateName) {
      return res.status(400).json({
        error: "Template name is required. Set WHATSAPP_DEFAULT_TEMPLATE_NAME or pass templateName.",
      });
    }

    const normalizedParams = Array.isArray(bodyParameters)
      ? bodyParameters.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    const whatsappResponse = await sendWhatsAppTemplateMessage(
      user.phone,
      chosenTemplateName,
      chosenLanguageCode,
      normalizedParams
    );

    const readableText =
      normalizedParams.length > 0
        ? `Template: ${chosenTemplateName} (${normalizedParams.join(" | ")})`
        : `Template: ${chosenTemplateName}`;

    await runQuery(
      "INSERT INTO messages (user_id, message, sender) VALUES (?, ?, 'admin')",
      [userId, readableText]
    );

    if (req.io) {
      req.io.emit("newMessage", {
        user_id: userId,
        message: readableText,
        sender: "admin",
      });
    }

    return res.json({ success: true, whatsapp: whatsappResponse });
  } catch (error) {
    console.error("Send template message failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
