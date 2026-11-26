// scripts/structure/registry/alpha/entityCollectors.mjs の検査(集める入口 entities/<種類>.ts。一時のフォルダの木で確かめる)。
// 実行: pnpm test scripts/structure/registry/alpha/entityCollectors.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { renderEntityCollectors } from "./entityCollectors.mjs";

test("export の無い登録のファイル(コメントだけ)は並べない、どの登録も持たない種類は入口を書かない(TS2306 を作らない)", () => {
  const root = mkdtempSync(join(tmpdir(), "entity-collectors-"));
  const put = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  try {
    const dir = "src/domains/message";
    put(`${dir}/entities/message/drizzle.ts`, "export const MessageTable = 1;\n");
    put(`${dir}/entities/message/schema.ts`, "// src/domains/message/entities/message/schema.ts\n// 文はドメイン全体の物へ移った\n");
    put(`${dir}/entities/messageLog/drizzle.ts`, "export const MessageLogTable = 1;\n");
    put(`${dir}/entities/messageLog/model.ts`, "// コメントだけ\n");
    const declaration = {
      dir,
      domain: { label: "メッセージ" },
      registrations: [
        { name: "message", dir: `${dir}/entities/message` },
        { name: "messageLog", dir: `${dir}/entities/messageLog` },
      ],
    };
    const outputs = renderEntityCollectors(root, [declaration]);
    assert.deepEqual(Object.keys(outputs).sort(), [`${dir}/entities/drizzle.ts`]);
    assert.match(outputs[`${dir}/entities/drizzle.ts`], /export \* from "\.\/message\/drizzle";\nexport \* from "\.\/messageLog\/drizzle";/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
