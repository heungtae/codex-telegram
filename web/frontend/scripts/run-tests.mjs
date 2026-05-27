import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function collectTests(rootDir) {
  const stack = [rootDir];
  const files = [];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    for (const entry of readdirSync(currentDir)) {
      const fullPath = join(currentDir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }
  }

  files.sort();
  return files;
}

const testFiles = collectTests("src");
if (testFiles.length === 0) {
  console.error("No .test.ts files found under src/");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);