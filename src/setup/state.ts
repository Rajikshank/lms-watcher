import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type SetupState = {
  version: 1;
  step: string;
  updatedAt: string;
};

export const SETUP_STATE_PATH = ".lms-watcher-setup.json";

export function readSetupState(path = SETUP_STATE_PATH): SetupState | null {
  if (!existsSync(path)) return null;

  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<SetupState>;
  if (parsed.version !== 1 || typeof parsed.step !== "string") return null;

  return {
    version: 1,
    step: parsed.step,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString()
  };
}

export function writeSetupState(step: string, path = SETUP_STATE_PATH): SetupState {
  const state: SetupState = {
    version: 1,
    step,
    updatedAt: new Date().toISOString()
  };

  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

