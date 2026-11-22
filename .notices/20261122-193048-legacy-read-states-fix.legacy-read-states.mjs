// .notices/20261122-193048-legacy-read-states-fix.legacy-read-states.mjs
// 区切り messaging-switch の写しの task(pnpm task messaging:copy-legacy-notifications)の既読の位置(readStates)の直し。
// 写し元の read_watermark_at はマイクロ秒まで持つが、task はそれを JS の Date(ミリ秒)に通して書くので、写し先が 1ms 未満
// 小さくなり、照合「写し先 >= 写し元」が合わずに task が failed(照合が合いません: readStates)で止まる。打ち直しても GREATEST で
// 同じ値が書かれるだけだった。
// この道具は fork の木(messaging-switch の区切りの時点、写しの task がまだある木)の
// src/features/core/messaging/scripts/migrations/lib.legacyCopyStore.ts の writeReadStates を、写し元の行から SQL の中で
// 写す形(INSERT … SELECT、値を JS に通さない)に書き換える。照合の SQL と nextReadStates はそのまま。何度走らせても同じ結果。
//
//   node .notices/20261122-193048-legacy-read-states-fix.legacy-read-states.mjs            # dry-run(既定、書かない)
//   node .notices/20261122-193048-legacy-read-states-fix.legacy-read-states.mjs --apply    # 書く
//   --json(機械向けの出力)
//
// 結果: apply = 書き換える(書いた)| already = 書き換え済み | missing = ファイルが無い(写しの task を消した後の木。直す物は無い)|
// unknown = writeReadStates が見本の形でない(fork が手で変えた。exit 2、手で直す形を出す)
// TARGET のパス(src/features/…)は区切り messaging-switch の時点の木の名前(区切り district-stage1 で src/domains に改名される前)。
// 道具はその木にだけ当てるので、今の木の名前に合わせて書き換えない(.notices/README.md: 道具は自分の区切りの時点の木に対して走る)
// 手順: --apply → pnpm task messaging:copy-legacy-notifications を打ち直す → succeeded + 照合 ok(写し済みの行も GREATEST で直る)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const TARGET = "src/features/core/messaging/scripts/migrations/lib.legacyCopyStore.ts";

/** 直す前の writeReadStates(区切り messaging-switch の版。行の値をそのまま INSERT … VALUES で書く) */
export const ORIGINAL = `  async writeReadStates(rows) {
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
`;

/** 直した後の writeReadStates(写す利用者だけを rows から取り、値は写し元の行から SQL の中で読む) */
export const REPLACEMENT = `  async writeReadStates(rows) {
    if (rows.length === 0) return;
    // 既読の位置は写し元の行から SQL の中で写す(JS の Date に通すとマイクロ秒が落ち、照合の「写し先 >= 写し元」が合わない。
    // notice 20261122-193048-legacy-read-states-fix の道具が書き換えた)。updated_at が無い行は今の時刻(mapReadState と同じ)
    const userIds = rows.map((row) => row.user_id);
    await db.execute(sql\`
      INSERT INTO message_inbox_read_states (user_id, read_watermark_at, updated_at)
      SELECT ns.user_id, ns.read_watermark_at, COALESCE(ns.updated_at, now())
      FROM notification_read_states ns
      WHERE ns.user_id IN (\${sql.join(
        userIds.map((id) => sql\`\${id}\`),
        sql\`, \`,
      )})
      ON CONFLICT (user_id) DO UPDATE SET
        read_watermark_at = GREATEST(message_inbox_read_states.read_watermark_at, EXCLUDED.read_watermark_at),
        updated_at = GREATEST(message_inbox_read_states.updated_at, EXCLUDED.updated_at)
    \`);
  },
`;

/**
 * 書き換えの判定(読むだけ)
 * @param {string | null} text TARGET の中身(無ければ null)
 * @returns {{ state: "apply" | "already" | "missing" | "unknown", next?: string }}
 */
export function plan(text) {
  if (text === null) return { state: "missing" };
  const normalized = text.replaceAll("\r\n", "\n");
  if (normalized.includes(REPLACEMENT)) return { state: "already" };
  const at = normalized.indexOf(ORIGINAL);
  if (at < 0 || normalized.indexOf(ORIGINAL, at + 1) >= 0) return { state: "unknown" };
  return { state: "apply", next: normalized.replace(ORIGINAL, REPLACEMENT) };
}

const MESSAGES = {
  apply: (apply) => `${TARGET}: writeReadStates を INSERT … SELECT に${apply ? "書き換えた" : "書き換える(dry-run、書くのは --apply)"}`,
  already: () => `${TARGET}: 書き換え済み(直す物なし)`,
  missing: () => `${TARGET} がありません(写しの task を消した後の木。直す物なし)`,
  unknown: () =>
    `${TARGET}: writeReadStates が見本の形ではありません(手で変えた)。手で直す: writeReadStates が行の read_watermark_at を JS の値で書かず、` +
    `notification_read_states から INSERT … SELECT で写すようにする(形はこの道具の REPLACEMENT)`,
};

/** CLI。exit 0 = apply / already / missing、2 = unknown、1 = 引数の誤り */
export function main(argv = process.argv.slice(2), { root = process.cwd(), stdout = process.stdout } = {}) {
  const flags = new Set(argv);
  for (const flag of flags) {
    if (flag !== "--apply" && flag !== "--json") {
      stdout.write(`知らない引数 ${flag}(--apply | --json)\n`);
      return 1;
    }
  }
  const apply = flags.has("--apply");
  const file = join(root, TARGET);
  const result = plan(existsSync(file) ? readFileSync(file, "utf8") : null);
  if (apply && result.state === "apply" && result.next !== undefined) writeFileSync(file, result.next);
  if (flags.has("--json")) stdout.write(`${JSON.stringify({ apply, file: TARGET, state: result.state })}\n`);
  else stdout.write(`${MESSAGES[result.state](apply)}\n`);
  return result.state === "unknown" ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
