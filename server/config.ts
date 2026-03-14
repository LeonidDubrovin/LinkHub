import fs from "fs";
import path from "path";

export function getConfigPath() {
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
  return path.join(exeDir, "linkhub.config.json");
}

export function getConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to read config:", e);
    }
  }
  return {
    userAgent: "Mozilla/5.0 (compatible; Twitterbot/1.0)"
  };
}

export function saveConfig(config: any) {
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}
