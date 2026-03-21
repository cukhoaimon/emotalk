const express = require("express");

const upload = require("../middleware/uploadMiddleware");
const { analyzeAudio, analyzeLiveAudio } = require("../controllers/analyzeAudioController");

const router = express.Router();

router.post("/analyze-audio", upload.single("file"), analyzeAudio);
router.post("/analyze-audio/live", upload.single("file"), analyzeLiveAudio);

module.exports = router;
