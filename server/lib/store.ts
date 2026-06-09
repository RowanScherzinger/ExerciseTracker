import { join } from "path";

const DATA_DIR = join(import.meta.dir, "..", "data");

function filePath(name: string) {
  return join(DATA_DIR, `${name}.json`);
}

export function readJson<T>(name: string): T {
  const text = Bun.file(filePath(name)).text();
  return JSON.parse(text as unknown as string);
}

export async function readJsonAsync<T>(name: string): Promise<T> {
  const text = await Bun.file(filePath(name)).text();
  return JSON.parse(text);
}

export async function writeJsonAsync(name: string, data: unknown): Promise<void> {
  const tmp = filePath(name) + ".tmp";
  await Bun.write(tmp, JSON.stringify(data, null, 2));
  // Rename for atomic write
  const fs = await import("fs/promises");
  await fs.rename(tmp, filePath(name));
}
