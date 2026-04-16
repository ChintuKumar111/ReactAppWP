const config = require("./config");

function normalizePhoneNumber(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function hasWhatsAppConfig() {
  return Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);
}

async function sendWhatsAppTextMessage(to, body) {
  if (!hasWhatsAppConfig()) {
    throw new Error("Missing WhatsApp Cloud API configuration.");
  }

  const endpoint = `https://graph.facebook.com/${config.whatsapp.graphApiVersion}/${config.whatsapp.phoneNumberId}/messages`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhoneNumber(to),
      type: "text",
      text: {
        preview_url: false,
        body,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "WhatsApp message send failed.");
  }

  return data;
}

function extractInboundMessages(payload) {
  const inbound = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      for (const message of messages) {
        const contact = contacts.find((item) => item.wa_id === message.from);

        inbound.push({
          from: normalizePhoneNumber(message.from),
          name: contact?.profile?.name || "WhatsApp User",
          text:
            message?.text?.body ||
            message?.button?.text ||
            message?.interactive?.button_reply?.title ||
            message?.interactive?.list_reply?.title ||
            "",
          type: message?.type || "unknown",
          whatsappMessageId: message?.id || "",
          timestamp: message?.timestamp || "",
        });
      }
    }
  }

  return inbound.filter((message) => message.from && message.text);
}

module.exports = {
  extractInboundMessages,
  hasWhatsAppConfig,
  normalizePhoneNumber,
  sendWhatsAppTextMessage,
};
