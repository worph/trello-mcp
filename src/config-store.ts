import fs from "fs";
import path from "path";

export interface StoredConfig {
  apiKey?: string;
  token?: string;
  boardId?: string;
  workspaceId?: string;
}

const CONFIG_PATH = process.env.CONFIG_PATH || "/data/config.json";

export function loadStoredConfig(): StoredConfig {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`Could not load config from ${CONFIG_PATH}:`, err);
  }
  return {};
}

export function saveStoredConfig(config: StoredConfig): void {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    console.log(`Config saved to ${CONFIG_PATH}`);
  } catch (err) {
    console.error(`Could not save config to ${CONFIG_PATH}:`, err);
    throw err;
  }
}
