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

db.connect((err) => {
  if (err) {
    console.log("DB Error:", err);
  } else {
    console.log("MySQL Connected");
    ensureUsersSchema().catch((schemaError) => {
      console.log("Schema ensure error:", schemaError.message);
    });
  }
});

module.exports = db;
