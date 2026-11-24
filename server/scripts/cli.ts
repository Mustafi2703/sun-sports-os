import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNode(script: string, args: string[]): number {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: serverRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

export function prismaExitCode(args: string[]): number {
  return runNode(path.join(serverRoot, "node_modules", "prisma", "build", "index.js"), args);
}

export function runPrisma(args: string[]) {
  const code = prismaExitCode(args);
  if (code !== 0) process.exit(code);
}

export function runTsx(script: string) {
  const code = runNode(path.join(serverRoot, "node_modules", "tsx", "dist", "cli.mjs"), [script]);
  if (code !== 0) process.exit(code);
}
