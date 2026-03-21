const express = require("express");

const { getAvatarVoices, saveAvatarVoices, speakAvatar } = require("../controllers/avatarController");

const router = express.Router();

router.get("/avatar/voices", getAvatarVoices);
router.put("/avatar/voices", saveAvatarVoices);
router.post("/avatar/speech", speakAvatar);

module.exports = router;
