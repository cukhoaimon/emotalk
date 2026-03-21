const express = require("express");

const { chat, getDefaultSession, getSession, resetSession } = require("../controllers/chatController");

const router = express.Router();

router.post("/chat", chat);
router.get("/chat", getDefaultSession);
router.get("/chat/:sessionId", getSession);
router.delete("/chat/:sessionId", resetSession);

module.exports = router;
