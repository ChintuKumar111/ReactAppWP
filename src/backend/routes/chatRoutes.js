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


function normalizeReferralValue(value) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

function extractReferralFields(referral) {
  if (!referral || typeof referral !== "object") {
    return null;
  }

  const source = normalizeReferralValue(referral.source);
  const videoUrl = normalizeReferralValue(referral.video_url);
  const thumbnailUrl = normalizeReferralValue(referral.thumbnail_url);
  const ctwaClid = normalizeReferralValue(referral.ctwa_clid);

  if (!source && !videoUrl && !thumbnailUrl && !ctwaClid) {
    return null;
  }

  return {
    source,
    videoUrl,
    thumbnailUrl,
    ctwaClid,
  };
}

function toMysqlDateTime(value) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

async function findMessageByWhatsAppId(whatsappMessageId) {
  const normalizedId = String(whatsappMessageId || "").trim();
  if (!normalizedId) {
    return null;
  }

  const rows = await runQuery("SELECT * FROM messages WHERE whatsapp_message_id = ? LIMIT 1", [normalizedId]);
  return rows[0] || null;
}

async function findMessageById(messageId) {
  const rows = await runQuery(
    `
      SELECT
        *,
        COALESCE(whatsapp_timestamp, created_at) AS display_created_at
      FROM messages
      WHERE id = ?
      LIMIT 1
    `,
    [messageId]
  );

  return rows[0] || null;
}

function buildSocketMessage(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    message: row.message,
    sender: row.sender,
    created_at: row.created_at || new Date().toISOString(),
    sort_created_at:
      row.display_created_at || row.whatsapp_timestamp || row.created_at || new Date().toISOString(),
    whatsapp_message_id: row.whatsapp_message_id || null,
  };
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
    const webhookReferral = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.referral;
    if (webhookReferral) {
      console.log("Inbound referral data:", webhookReferral);
    }

    const inboundMessages = extractInboundMessages(req.body);

    for (const inboundMessage of inboundMessages) {
      const user = await findOrCreateUserByPhone(inboundMessage.from, inboundMessage.name);
      const referralFields = extractReferralFields(inboundMessage.referral);
      const whatsappTimestamp = toMysqlDateTime(inboundMessage.whatsappTimestamp);

      if (referralFields) {
        await runQuery(
          `
            UPDATE users
            SET
              source = COALESCE(?, source),
              video_url = COALESCE(?, video_url),
              thumbnail_url = COALESCE(?, thumbnail_url),
              ctwa_clid = COALESCE(?, ctwa_clid)
            WHERE id = ?
          `,
          [
            referralFields.source,
            referralFields.videoUrl,
            referralFields.thumbnailUrl,
            referralFields.ctwaClid,
            user.id,
          ]
        );
      }

      const existingMessage = await findMessageByWhatsAppId(inboundMessage.whatsappMessageId);
      if (existingMessage) {
        continue;
      }

      const insertResult = await runQuery(
        `
          INSERT INTO messages (
            user_id,
            message,
            sender,
            is_read,
            whatsapp_message_id,
            whatsapp_timestamp
          )
          VALUES (?, ?, ?, 0, ?, ?)
        `,
        [
          user.id,
          inboundMessage.text,
          "customer",
          inboundMessage.whatsappMessageId || null,
          whatsappTimestamp,
        ]
      );

      const storedMessage = await findMessageById(insertResult.insertId);

      if (req.io && storedMessage) {
        req.io.emit("newMessage", buildSocketMessage(storedMessage));
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
        u.source,
        u.video_url,
        u.thumbnail_url,
        u.ctwa_clid,
        latest.message AS last_message,
        latest.display_time AS last_seen,
        latest.sender AS last_sender,
        COALESCE(customer_counts.customer_message_count, 0) AS customer_message_count,
        COALESCE(unread_counts.unread_message_count, 0) AS unread_message_count,
        customer_latest.last_customer_message_id,
        customer_latest.last_customer_message_at
      FROM users u
      LEFT JOIN (
        SELECT
          m1.user_id,
          m1.message,
          COALESCE(m1.whatsapp_timestamp, m1.created_at) AS message_time,
          m1.created_at AS display_time,
          m1.sender
        FROM messages m1
        LEFT JOIN messages m2
          ON m2.user_id = m1.user_id
         AND (
           COALESCE(m2.whatsapp_timestamp, m2.created_at) > COALESCE(m1.whatsapp_timestamp, m1.created_at)
           OR (
             COALESCE(m2.whatsapp_timestamp, m2.created_at) = COALESCE(m1.whatsapp_timestamp, m1.created_at)
             AND m2.id > m1.id
           )
         )
        WHERE m2.id IS NULL
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
        SELECT user_id, COUNT(*) AS unread_message_count
        FROM messages
        WHERE sender = 'customer' AND COALESCE(is_read, 0) = 0
        GROUP BY user_id
      ) unread_counts
        ON unread_counts.user_id = u.id
      LEFT JOIN (
        SELECT
          m.user_id,
          m.id AS last_customer_message_id,
          COALESCE(m.whatsapp_timestamp, m.created_at) AS last_customer_message_at
        FROM messages m
        LEFT JOIN messages m_next
          ON m_next.user_id = m.user_id
         AND m_next.sender = 'customer'
         AND (
           COALESCE(m_next.whatsapp_timestamp, m_next.created_at) > COALESCE(m.whatsapp_timestamp, m.created_at)
           OR (
             COALESCE(m_next.whatsapp_timestamp, m_next.created_at) = COALESCE(m.whatsapp_timestamp, m.created_at)
             AND m_next.id > m.id
           )
         )
        WHERE m.sender = 'customer'
          AND m_next.id IS NULL
      ) customer_latest
        ON customer_latest.user_id = u.id
      ORDER BY latest.message_time DESC, u.id DESC
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
    `
      SELECT
        *,
        created_at AS display_created_at,
        COALESCE(whatsapp_timestamp, created_at) AS sort_created_at
      FROM messages
      WHERE user_id = ?
      ORDER BY COALESCE(whatsapp_timestamp, created_at) ASC, id ASC
    `,
    [userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(result);
    }
  );
});

router.post("/messages/:userId/read", async (req, res) => {
  const userId = req.params.userId;

  try {
    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const result = await runQuery(
      `
        UPDATE messages
        SET is_read = 1
        WHERE user_id = ? AND sender = 'customer' AND COALESCE(is_read, 0) = 0
      `,
      [userId]
    );

    return res.json({
      success: true,
      userId,
      markedRead: result?.affectedRows || 0,
    });
  } catch (error) {
    console.error("Mark read failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/chats/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const users = await runQuery("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const deletedMessages = await runQuery("DELETE FROM messages WHERE user_id = ?", [userId]);
    await runQuery("DELETE FROM users WHERE id = ?", [userId]);

    return res.json({
      success: true,
      deletedUserId: userId,
      deletedMessages: deletedMessages?.affectedRows || 0,
    });
  } catch (error) {
    console.error("Delete chat failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
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

    const insertResult = await runQuery(
      `
        INSERT INTO messages (user_id, message, sender, is_read, whatsapp_message_id)
        VALUES (?, ?, 'admin', 1, ?)
      `,
      [userId, trimmedMessage, whatsappResponse?.messages?.[0]?.id || null]
    );

    const newMsg = await findMessageById(insertResult.insertId);

    if (req.io && newMsg) {
      req.io.emit("newMessage", buildSocketMessage(newMsg));
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

    const insertResult = await runQuery(
      `
        INSERT INTO messages (user_id, message, sender, is_read, whatsapp_message_id)
        VALUES (?, ?, 'admin', 1, ?)
      `,
      [userId, readableText, whatsappResponse?.messages?.[0]?.id || null]
    );

    const newMsg = await findMessageById(insertResult.insertId);

    if (req.io && newMsg) {
      req.io.emit("newMessage", buildSocketMessage(newMsg));
    }

    return res.json({ success: true, whatsapp: whatsappResponse });
  } catch (error) {
    console.error("Send template message failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
