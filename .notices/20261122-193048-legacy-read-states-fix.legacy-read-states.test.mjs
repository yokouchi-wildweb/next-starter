// .notices/20261122-193048-legacy-read-states-fix.legacy-read-states.test.mjs
// 道具 legacy-read-states の回帰テスト。直す先(写しの task)は区切り messaging-drop-legacy で上流の木から消えたので、
// 区切り messaging-switch の版の lib.legacyCopyStore.ts の writeReadStates の本文を下に写し(STORE_AT_SWITCH)、それに当てる。
// 上流の木に旧の表が無いため、マイクロ秒の watermark を DB で写すテストは作れない: 書き換え後の SQL が値を JS に通さず
// 写し元の行から読むこと(マイクロ秒が落ちない形)を字面で確かめる。
// 実行: pnpm test .notices/20261122-193048-legacy-read-states-fix.legacy-read-states.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { ORIGINAL, REPLACEMENT, TARGET, main, plan } from "./20261122-193048-legacy-read-states-fix.legacy-read-states.mjs";

/** 区切り messaging-switch の lib.legacyCopyStore.ts の該当の所(前後の関数ごと。上流 e5f8eb878 〜 f7e9e2f86^ で同じ本文) */
const STORE_AT_SWITCH = `export const drizzleLegacyCopyStore: LegacyCopyStore = {
  async writeReads(rows) {
    for (const part of slices(rows)) {
      await db.insert(R).values(part).onConflictDoNothing();
    }
  },

  async nextReadStates(after, limit) {
    const rows = await db
      .select()
      .from(NS)
      .where(
        and(
          after ? gt(NS.userId, after) : undefined,
          notExists(
            db
              .select({ one: sql\`1\` })
              .from(S)
              .where(and(eq(S.user_id, NS.userId), or(isNull(NS.readWatermarkAt), sql\`\${S.read_watermark_at} >= \${NS.readWatermarkAt}\`))),
          ),
        ),
      )
      .orderBy(asc(NS.userId))
      .limit(limit);
    return rows.map((row) => ({ userId: row.userId, readWatermarkAt: row.readWatermarkAt ?? null, updatedAt: row.updatedAt ?? null }));
  },

  async writeReadStates(rows) {
    if (rows.length === 0) return;
    await db
      .insert(S)
      .values(rows)
      .onConflictDoUpdate({
        target: S.user_id,
        set: {
          read_watermark_at: sql\`GREATEST(\${S.read_watermark_at}, EXCLUDED.read_watermark_at)\`,
          updatedAt: sql\`GREATEST(\${S.updatedAt}, EXCLUDED.updated_at)\`,
        },
      });
  },

  async nextDispatchFills(after, limit) {
    return [];
  },
};
`;

function fork(text) {
  const root = mkdtempSync(join(tmpdir(), "legacy-read-states-"));
  if (text !== null) {
    mkdirSync(dirname(join(root, TARGET)), { recursive: true });
    writeFileSync(join(root, TARGET), text);
  }
  return root;
}

const quiet = () => {
  let out = "";
  return { stdout: { write: (s) => (out += s) }, text: () => out };
};

test("区切り messaging-switch の版に当たり、writeReadStates だけを書き換える(ほかの関数・照合の比較はそのまま)", () => {
  assert.ok(STORE_AT_SWITCH.includes(ORIGINAL), "見本の本文が写しと食い違う");
  const result = plan(STORE_AT_SWITCH);
  assert.equal(result.state, "apply");
  const next = /** @type {string} */ (result.next);
  assert.ok(next.includes(REPLACEMENT));
  assert.ok(!next.includes(".values(rows)"), "行の値をそのまま書く形が残っている");
  assert.equal(next.replace(REPLACEMENT, ORIGINAL), STORE_AT_SWITCH, "writeReadStates の外を変えた");
  assert.match(next, /sql`\$\{S\.read_watermark_at\} >= \$\{NS\.readWatermarkAt\}`/, "nextReadStates の比較はそのまま");
});

test("書き換え後の SQL: watermark は写し元の行から SQL の中で読み、JS の値を書かない(マイクロ秒が落ちない)。打ち直しは GREATEST で直す", () => {
  assert.match(REPLACEMENT, /INSERT INTO message_inbox_read_states \(user_id, read_watermark_at, updated_at\)/);
  assert.match(REPLACEMENT, /SELECT ns\.user_id, ns\.read_watermark_at, COALESCE\(ns\.updated_at, now\(\)\)/);
  assert.match(REPLACEMENT, /FROM notification_read_states ns/);
  assert.match(REPLACEMENT, /read_watermark_at = GREATEST\(message_inbox_read_states\.read_watermark_at, EXCLUDED\.read_watermark_at\)/);
  // rows から使うのは利用者の id だけ(Date の値 read_watermark_at・updatedAt を SQL へ渡さない)
  assert.doesNotMatch(REPLACEMENT, /row\.read_watermark_at|row\.updatedAt|\.values\(/);
  assert.match(REPLACEMENT, /rows\.map\(\(row\) => row\.user_id\)/);
});

test("--apply で書き、2 回目は already(何度走らせても同じ)。dry-run は書かない", () => {
  const root = fork(STORE_AT_SWITCH);
  try {
    const dry = quiet();
    assert.equal(main([], { root, stdout: dry.stdout }), 0);
    assert.match(dry.text(), /書き換える\(dry-run/);
    assert.equal(readFileSync(join(root, TARGET), "utf8"), STORE_AT_SWITCH);
    assert.equal(main(["--apply"], { root, stdout: quiet().stdout }), 0);
    const written = readFileSync(join(root, TARGET), "utf8");
    assert.ok(written.includes(REPLACEMENT));
    const again = quiet();
    assert.equal(main(["--apply", "--json"], { root, stdout: again.stdout }), 0);
    assert.deepEqual(JSON.parse(again.text()), { apply: true, file: TARGET, state: "already" });
    assert.equal(readFileSync(join(root, TARGET), "utf8"), written);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ファイルが無い木は missing(0)、手で変えた writeReadStates は unknown(2)で書かない", () => {
  const empty = fork(null);
  const changed = fork(STORE_AT_SWITCH.replace(".values(rows)", ".values(rows.map((row) => row))"));
  try {
    assert.equal(main(["--apply"], { root: empty, stdout: quiet().stdout }), 0);
    const out = quiet();
    assert.equal(main(["--apply"], { root: changed, stdout: out.stdout }), 2);
    assert.match(out.text(), /見本の形ではありません/);
    assert.ok(!readFileSync(join(changed, TARGET), "utf8").includes(REPLACEMENT));
    assert.equal(main(["--bogus"], { root: empty, stdout: quiet().stdout }), 1);
  } finally {
    rmSync(empty, { recursive: true, force: true });
    rmSync(changed, { recursive: true, force: true });
  }
});
