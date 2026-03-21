const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const agoraRouter = require("./routes/agoraRoute");
const analyzeAudioRouter = require("./routes/analyzeAudioRoute");
const chatRouter = require("./routes/chatRoute");
const avatarRouter = require("./routes/avatarRoute");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests. Please try again in a moment."
    }
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/", agoraRouter);
app.use("/", analyzeAudioRouter);
app.use("/", chatRouter);
app.use("/", avatarRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. The maximum allowed size is 25MB."
        : err.message;

    return res.status(400).json({ error: message });
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: err.message || "Internal server error."
  });
});

module.exports = app;
