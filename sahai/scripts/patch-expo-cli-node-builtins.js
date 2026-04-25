const fs = require("fs");
const path = require("path");

const cliExternalsPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@expo",
  "cli",
  "build",
  "src",
  "start",
  "server",
  "metro",
  "externals.js"
);

if (!fs.existsSync(cliExternalsPath)) {
  process.exit(0);
}

const source = fs.readFileSync(cliExternalsPath, "utf8");

if (source.includes('!x.startsWith("node:")')) {
  process.exit(0);
}

const patched = source.replace(
  "]).filter((x)=>!/^_|^(internal|v8|node-inspect)\\/|\\//.test(x) && ![",
  ']).filter((x)=>!x.startsWith("node:") && !/^_|^(internal|v8|node-inspect)\\/|\\//.test(x) && !['
);

if (patched === source) {
  console.warn("Expo CLI Node builtin patch was not applied; expected code was not found.");
  process.exit(0);
}

fs.writeFileSync(cliExternalsPath, patched);
console.log("Patched Expo CLI Node builtin handling for Windows and Node 24.");
