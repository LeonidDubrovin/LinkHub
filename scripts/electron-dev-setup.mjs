import fs from "fs";

try {
  fs.unlinkSync(".server-port");
} catch {}
