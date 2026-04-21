const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const config = require("./config");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// ✅ Middleware FIRST
app.use(cors());
app.use(express.json());

// ✅ Make io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ Routes AFTER middleware
app.use("/auth", authRoutes);
app.use("/", chatRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Socket
io.on("connection", (socket) => {
  console.log("User connected");
});

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});