import path from "path";

export function getBaseDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}
