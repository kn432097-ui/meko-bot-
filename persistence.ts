import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "data/verification-state.json");
export interface PendingVerification {
  guildId: string;
  userId: string;
  step: "gender" | "birthYear";
  gender?: "M" | "F";
  joinedAt: number;
  timeoutAt: number;
}

export interface State {
  pending: Record<string, PendingVerification>;
  serials: Record<string, number>;
}

function defaultState(): State {
  return { pending: {}, serials: {} };
}

export function loadState(): State {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) as State;
  } catch {
    return defaultState();
  }
}

export function saveState(state: State): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}
