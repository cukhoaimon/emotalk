const express = require("express");

const { chat, getSession, resetSession } = require("../controllers/chatController");

const router = express.Router();

router.post("/chat", chat);
router.get("/chat/:sessionId", getSession);
router.delete("/chat/:sessionId", resetSession);

module.exports = router;
