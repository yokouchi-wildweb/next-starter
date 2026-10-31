// scripts/bundle/clientChunks.test.mjs
// 実行: pnpm test:client-chunks

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { scanClientChunks } from "./clientChunks.mjs";

test("公開ページだけを見て、語のある chunk を読むページを出す。build が無ければ null", () => {
  const dist = mkdtempSync(join(tmpdir(), "chunks-"));
  try {
    assert.equal(scanClientChunks(dist), null);
    const put = (path, text) => {
      mkdirSync(dirname(join(dist, path)), { recursive: true });
      writeFileSync(join(dist, path), text);
    };
    put("static/chunks/clean.js", "x");
    put("static/chunks/leak.js", 'text("local_password")');
    const manifest = "page_client-reference-manifest.js";
    put(`server/app/(user)/ok/${manifest}`, `"static/chunks/clean.js"`);
    put(`server/app/(user)/bad/${manifest}`, `"static/chunks/clean.js","static/chunks/leak.js"`);
    put(`server/app/admin/users/${manifest}`, `"static/chunks/leak.js"`);
    assert.deepEqual(scanClientChunks(dist), { pages: 2, problems: ["(user)/bad: local_password"] });
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
