import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";

const NODESAGE_DIR = path.join(os.homedir(), ".nodesage");
const CONFIG_PATH = path.join(NODESAGE_DIR, "config.json");

export interface NodesageConfig {
  chatModel: string;
  embedModel: string;
  temperature: number;
  maxTokens: number;
  topK: number;
  chunkSize: number;
  chunkOverlap: number;
  contextWindow: number;
}

const DEFAULTS: NodesageConfig = {
  chatModel: "qwen2.5-coder:7b",
  embedModel: "nomic-embed-text",
  temperature: 0.2,
  maxTokens: 32000,
  topK: 5,
  chunkSize: 512,
  chunkOverlap: 64,
  contextWindow: 8,
};

let cached: NodesageConfig | null = null;

export async function loadConfig(): Promise<NodesageConfig> {
  if (cached) return cached;

  let fileConfig: Partial<NodesageConfig> = {};
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    fileConfig = JSON.parse(data);
  } catch {
    // No config file — use defaults
  }

  // Environment variable overrides
  const envOverrides: Partial<NodesageConfig> = {};
  if (process.env.NODESAGE_CHAT_MODEL) envOverrides.chatModel = process.env.NODESAGE_CHAT_MODEL;
  if (process.env.NODESAGE_EMBED_MODEL) envOverrides.embedModel = process.env.NODESAGE_EMBED_MODEL;
  if (process.env.NODESAGE_TEMPERATURE) envOverrides.temperature = parseFloat(process.env.NODESAGE_TEMPERATURE);
  if (process.env.NODESAGE_MAX_TOKENS) envOverrides.maxTokens = parseInt(process.env.NODESAGE_MAX_TOKENS, 10);
  if (process.env.NODESAGE_TOP_K) envOverrides.topK = parseInt(process.env.NODESAGE_TOP_K, 10);

  cached = { ...DEFAULTS, ...fileConfig, ...envOverrides };
  return cached;
}

export async function saveConfig(config: Partial<NodesageConfig>): Promise<void> {
  // Load existing file config (not merged with defaults)
  let existing: Partial<NodesageConfig> = {};
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    existing = JSON.parse(data);
  } catch {
    // No existing config
  }

  const merged = { ...existing, ...config };
  await fs.mkdir(NODESAGE_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");

  // Invalidate cache
  cached = null;
}

export function getDefaults(): NodesageConfig {
  return { ...DEFAULTS };
}

export const CONFIG_KEYS = Object.keys(DEFAULTS) as (keyof NodesageConfig)[];
