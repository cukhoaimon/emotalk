const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const rootEnvPath = path.resolve(__dirname, "..", "..", "..", ".env");
const localEnvPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
