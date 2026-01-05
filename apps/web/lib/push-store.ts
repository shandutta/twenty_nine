import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PushTokenRecord = {
  deviceId: string;
  token: string;
  platform?: string;
  appVersion?: string;
  updatedAt: string;
};

const resolveStorePath = () => {
  if (process.env.PUSH_TOKEN_STORE_PATH) {
    return process.env.PUSH_TOKEN_STORE_PATH;
  }
  const cwd = process.cwd();
  const isWebApp = path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps";
  const root = isWebApp ? path.resolve(cwd, "..", "..") : cwd;
  return path.join(root, ".data", "push-tokens.json");
};

export const readPushTokens = async (): Promise<PushTokenRecord[]> => {
  const filePath = resolveStorePath();
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as PushTokenRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const upsertPushToken = async (record: PushTokenRecord) => {
  const filePath = resolveStorePath();
  const existing = await readPushTokens();
  const next = existing.filter((entry) => entry.deviceId !== record.deviceId && entry.token !== record.token);
  next.push(record);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2));
  return record;
};
