// scripts/operations/setup/env.test.ts — pnpm test scripts/operations/setup
// pnpm ops setup env の部品: 段階の印・既にあるファイルは上書きせず足りない秘密の鍵だけ足す・秘密はファイルごとに別・APP_BASE_URL は開発だけ。
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createEnvFile, DEFAULT_ENV_FILES, GENERATED_SECRETS, isEnvFileName, stageOf } from "./lib.env";

const EXAMPLE = "APP_ENV=development\nAPP_BASE_URL=\nAUTH_JWT_SECRET=\nENCRYPTION_KEY=\nMESSAGING_UNSUBSCRIBE_SECRET=\nDATABASE_URL=\n";

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

test("作った秘密の鍵を置く(配信停止の鍵もファイルごとに別の値)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "env-init-"));
  try {
    writeFileSync(path.join(root, ".env.example"), EXAMPLE);
    for (const name of DEFAULT_ENV_FILES) createEnvFile(root, name);
    const value = (name: string) =>
      /^MESSAGING_UNSUBSCRIBE_SECRET=(.+)$/m.exec(readFileSync(path.join(root, name), "utf8"))?.[1];
    const dev = value(".env.development");
    const prod = value(".env.production");
    assert.ok(dev && prod && dev !== prod);
    assert.match(dev, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(
      GENERATED_SECRETS.map((secret) => secret.key),
      ["AUTH_JWT_SECRET", "ENCRYPTION_KEY", "MESSAGING_UNSUBSCRIBE_SECRET"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("既にあるファイルは上書きせず、無いか空の秘密の鍵だけ足す(値の入った鍵・APP_BASE_URL・ほかの行は触らない)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "env-init-"));
  try {
    writeFileSync(path.join(root, ".env.example"), EXAMPLE);
    const existing = "APP_ENV=production\nAPP_BASE_URL=\nAUTH_JWT_SECRET=keep-me\nENCRYPTION_KEY=\n# memo\nKEEP=1\n";
    writeFileSync(path.join(root, ".env.production"), existing);
    const result = createEnvFile(root, ".env.production");
    assert.deepEqual(result, { name: ".env.production", created: false, added: ["ENCRYPTION_KEY", "MESSAGING_UNSUBSCRIBE_SECRET"] });
    const text = readFileSync(path.join(root, ".env.production"), "utf8");
    assert.match(text, /^AUTH_JWT_SECRET=keep-me$/m);
    assert.match(text, /^APP_BASE_URL=$/m);
    assert.match(text, /^ENCRYPTION_KEY=[0-9a-f]{64}$/m);
    assert.match(text, /^MESSAGING_UNSUBSCRIBE_SECRET=.+$/m);
    assert.ok(text.startsWith("APP_ENV=production\nAPP_BASE_URL=\nAUTH_JWT_SECRET=keep-me\n"));
    assert.ok(text.includes("# memo\nKEEP=1\n"));
    assert.ok(text.endsWith("\n"));

    // 2 度目は何も足さず、ファイルも変えない
    const once = readFileSync(path.join(root, ".env.production"), "utf8");
    assert.deepEqual(createEnvFile(root, ".env.production"), { name: ".env.production", created: false, added: [] });
    assert.equal(readFileSync(path.join(root, ".env.production"), "utf8"), once);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("名前の形・段階", () => {
  const root = mkdtempSync(path.join(tmpdir(), "env-init-"));
  try {
    assert.equal(stageOf(".env.staging.local"), "staging");
    assert.equal(isEnvFileName(".env.example"), false);
    assert.equal(isEnvFileName("env"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
