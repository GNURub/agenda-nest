import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..");
const exampleDir = process.cwd();

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
};

const packDir = await mkdtemp(join(tmpdir(), "agenda-nest-pack-"));

try {
  const packOutput = run(
    "npm",
    ["pack", repoRoot, "--ignore-scripts", "--pack-destination", packDir],
    repoRoot,
  );
  const tarballName = packOutput.split("\n").at(-1);

  if (!tarballName) {
    throw new Error("Could not determine packed tarball name.");
  }

  const tarballPath = resolve(packDir, tarballName);

  run(
    "npm",
    ["install", "--no-save", "--legacy-peer-deps", tarballPath],
    exampleDir,
  );
} finally {
  await rm(packDir, { force: true, recursive: true });
}
