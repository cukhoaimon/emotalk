const fs = require("fs/promises");
const path = require("path");

const outputDir = path.join(__dirname, "..", "..", "outputs");

function buildTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function saveAnalysisResult(result) {
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = buildTimestamp();
  const timestampedFilename = `analysis-${timestamp}.json`;
  const latestFilename = "latest-output.json";

  const payload = JSON.stringify(result, null, 2);

  await Promise.all([
    fs.writeFile(path.join(outputDir, timestampedFilename), payload, "utf8"),
    fs.writeFile(path.join(outputDir, latestFilename), payload, "utf8")
  ]);

  return {
    directory: outputDir,
    timestampedFilename,
    latestFilename
  };
}

module.exports = {
  saveAnalysisResult
};
