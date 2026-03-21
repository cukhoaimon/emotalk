const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "video/mp4",
  "audio/mp4",
  "audio/mpeg4",
  "audio/x-m4a",
  "audio/webm",
  "video/webm"
]);

const allowedExtensions = new Set([".wav", ".mp4", ".m4a", ".webm"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sanitizedOriginalName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${sanitizedOriginalName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeTypeAllowed = allowedMimeTypes.has(file.mimetype);
  const extensionAllowed = allowedExtensions.has(extension);

  if (!mimeTypeAllowed || !extensionAllowed) {
    const error = new Error(
      "Invalid file type. Only .wav, .mp4, .m4a, and .webm files are supported."
    );
    error.statusCode = 400;
    return cb(error);
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

module.exports = upload;
