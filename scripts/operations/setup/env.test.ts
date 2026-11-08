// scripts/operations/setup/env.test.ts — pnpm test scripts/operations/setup
// pnpm ops setup env の部品: 段階の印・既にあるファイルは触らない・秘密はファイルごとに別・APP_BASE_URL は開発だけ。
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createEnvFile, DEFAULT_ENV_FILES, isEnvFileName, stageOf } from "./lib.env";

const EXAMPLE = "APP_ENV=development\nAPP_BASE_URL=\nAUTH_JWT_SECRET=\nENCRYPTION_KEY=\nDATABASE_URL=\n";

test("既定は .env.development と .env.production の 2 つ、印はファイル名から、秘密は別の値、APP_BASE_URL は開発だけ", () => {
  const root = mkdtempSync(path.join(tmpdir(), "env-init-"));
  try {
    writeFileSync(path.join(root, ".env.example"), EXAMPLE);
    assert.deepEqual([...DEFAULT_ENV_FILES], [".env.development", ".env.production"]);
    for (const name of DEFAULT_ENV_FILES) assert.equal(createEnvFile(root, name).created, true);
    const dev = readFileSync(path.join(root, ".env.development"), "utf8");
    const prod = readFileSync(path.join(root, ".env.production"), "utf8");
    assert.match(dev, /^APP_ENV=development$/m);
    assert.match(prod, /^APP_ENV=production$/m);
    assert.match(dev, /^APP_BASE_URL=http:\/\/localhost:3000$/m);
    assert.match(prod, /^APP_BASE_URL=$/m);
    const secret = (text: string) => /^AUTH_JWT_SECRET=(.+)$/m.exec(text)?.[1];
    assert.ok(secret(dev) && secret(prod) && secret(dev) !== secret(prod));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("既にあるファイルは触らない、名前の形・段階", () => {
  const root = mkdtempSync(path.join(tmpdir(), "env-init-"));
  try {
    writeFileSync(path.join(root, ".env.example"), EXAMPLE);
    writeFileSync(path.join(root, ".env.production"), "KEEP=1\n");
    assert.deepEqual(createEnvFile(root, ".env.production"), { name: ".env.production", created: false });
    assert.equal(readFileSync(path.join(root, ".env.production"), "utf8"), "KEEP=1\n");
    assert.equal(stageOf(".env.staging.local"), "staging");
    assert.equal(isEnvFileName(".env.example"), false);
    assert.equal(isEnvFileName("env"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
