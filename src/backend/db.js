const mysql = require("mysql2");
const config = require("./config");

const db = mysql.createConnection({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
});

function runQuery(sql) {
  return new Promise((resolve, reject) => {
    db.query(sql, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

function runQueryWithParams(sql, params = []) {
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

async function ensureUsersSchema() {
  const requiredColumns = [
    { name: "source", definition: "VARCHAR(100) NULL" },
    { name: "video_url", definition: "TEXT NULL" },
    { name: "thumbnail_url", definition: "TEXT NULL" },
    { name: "ctwa_clid", definition: "VARCHAR(255) NULL" },
  ];

  for (const column of requiredColumns) {
    try {
      await runQuery(
        `ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`
      );
      console.log(`Schema update: added users.${column.name}`);
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("duplicate column")) {
        throw error;
      }
    }
  }
}

async function ensureMessagesSchema() {
  const requiredColumns = [
    { name: "whatsapp_message_id", definition: "VARCHAR(255) NULL" },
    { name: "whatsapp_timestamp", definition: "DATETIME NULL" },
  ];

  for (const column of requiredColumns) {
    try {
      await runQuery(
        `ALTER TABLE messages ADD COLUMN ${column.name} ${column.definition}`
      );
      console.log(`Schema update: added messages.${column.name}`);
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("duplicate column")) {
        throw error;
      }
    }
  }

  const timestampColumns = await runQueryWithParams(
    "SHOW COLUMNS FROM messages LIKE ?",
    ["whatsapp_timestamp"]
  );
  const timestampColumn = Array.isArray(timestampColumns) ? timestampColumns[0] : null;
  const timestampType = String(timestampColumn?.Type || "").toLowerCase();

  if (timestampColumn && timestampType !== "datetime") {
    if (["bigint", "int", "integer", "decimal", "double", "float"].some((type) => timestampType.startsWith(type))) {
      await runQuery(`
        UPDATE messages
        SET whatsapp_timestamp = CASE
          WHEN whatsapp_timestamp IS NULL THEN NULL
          WHEN whatsapp_timestamp >= 1000000000000 THEN FROM_UNIXTIME(whatsapp_timestamp / 1000)
          WHEN whatsapp_timestamp > 0 THEN FROM_UNIXTIME(whatsapp_timestamp)
          ELSE NULL
        END
      `);
    }

    await runQuery(`
      ALTER TABLE messages
      MODIFY COLUMN whatsapp_timestamp DATETIME NULL
    `);
    console.log("Schema update: converted messages.whatsapp_timestamp to DATETIME");
  }
}

async function ensureMessagesIndexes() {
  await runQuery(`
    UPDATE messages
    SET whatsapp_message_id = NULL
    WHERE TRIM(COALESCE(whatsapp_message_id, '')) = ''
  `);

  await runQuery(`
    DELETE duplicate_messages
    FROM messages duplicate_messages
    INNER JOIN messages kept_messages
      ON duplicate_messages.whatsapp_message_id = kept_messages.whatsapp_message_id
     AND duplicate_messages.id > kept_messages.id
    WHERE duplicate_messages.whatsapp_message_id IS NOT NULL
      AND duplicate_messages.whatsapp_message_id <> ''
  `);

  try {
    await runQuery(
      "ALTER TABLE messages ADD UNIQUE INDEX uniq_messages_whatsapp_message_id (whatsapp_message_id)"
    );
    console.log("Schema update: added messages.uniq_messages_whatsapp_message_id");
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("duplicate key name")) {
      throw error;
    }
  }
}

db.connect((err) => {
  if (err) {
    console.log("DB Error:", err);
  } else {
    console.log("MySQL Connected");
    Promise.all([ensureUsersSchema(), ensureMessagesSchema(), ensureMessagesIndexes()]).catch((schemaError) => {
      console.log("Schema ensure error:", schemaError.message);
    });
  }
});

module.exports = db;
