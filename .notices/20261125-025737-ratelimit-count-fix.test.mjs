// 区切り ratelimit-count-fix の道具(fork が足した・値を変えたカテゴリだけ「今と同じにする / そのまま」を聞く)のテスト。
// - 並べる: Extra で足したカテゴリ・上流と違う maxRequests。並べない: 上流と同じ値・窓だけの変更・空の上書き
// - maxRequests 1 は「変わらない」で聞かない、2 以上は聞く。same = N − 1 + 印、keep = 印だけ。印のある行は済み(2 回目は何も書かない)
// - maxRequests が式の行(boardgame-site の形)は「手で見る」に並べるだけ(止めない・聞かない・印を付けない)、--apply でその名前を答えると止める
// - 止める: 字面でない値・展開・計算した鍵・聞く物に無い名前・same / keep でない答え。書式は数字の外を変えない
// 実行: pnpm test .notices/20261125-025737-ratelimit-count-fix.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAnswers, parseAnswers, planRows, UPSTREAM_MAX_REQUESTS } from "./20261125-025737-ratelimit-count-fix.mjs";

const HEAD = 'import type { RateLimitOverride, RateLimitRule } from "@/domains/rateLimit/config";\n\n';

const ORIPA = `${HEAD}export type Extra = {
  winReportVerify: RateLimitRule;
  userItemRollback: RateLimitRule;
};

export default {
  // 当選報告の投稿検証（同一IPから5分に5回まで）
  winReportVerify: { windowSeconds: 300, maxRequests: 5 },
  userItemRollback: { windowSeconds: 60, maxRequests: 20 },
} satisfies RateLimitOverride<Extra>;
`;

test("上流の空の上書き: 聞く物なし", () => {
  const text = `${HEAD}export type Extra = Record<never, RateLimitRule>;\n\nexport default {} satisfies RateLimitOverride<Extra>;\n`;
  assert.deepEqual(planRows(text), { ok: true, ask: [], done: [], unchanged: [], manual: [] });
});

test("足したカテゴリ 2 つを聞き、same は N − 1 と印、keep は印だけ。2 回目は済みで何も書かない", () => {
  const plan = planRows(ORIPA);
  assert.deepEqual(plan.ask.map((row) => [row.name, row.origin, row.maxRequests]), [["winReportVerify", "added", 5], ["userItemRollback", "added", 20]]);
  const applied = applyAnswers(ORIPA, { winReportVerify: "same", userItemRollback: "keep" });
  assert.equal(applied.ok, true);
  assert.ok(applied.next.includes("winReportVerify: { windowSeconds: 300, maxRequests: 4 /* ratelimit-count-fix: same (was 5) */ },"));
  assert.ok(applied.next.includes("userItemRollback: { windowSeconds: 60, maxRequests: 20 /* ratelimit-count-fix: keep */ },"));
  assert.ok(applied.next.includes("// 当選報告の投稿検証（同一IPから5分に5回まで）"), "数字の外は変えない");
  const again = planRows(applied.next);
  assert.deepEqual(again.ask, []);
  assert.deepEqual(again.done.map((row) => [row.name, row.mark]), [["winReportVerify", "same"], ["userItemRollback", "keep"]]);
  const twice = applyAnswers(applied.next, { winReportVerify: "same", userItemRollback: "same" });
  assert.equal(twice.next, applied.next, "済みの行は書かない");
  assert.deepEqual(twice.applied, []);
});

test("答えていない行は残って聞かれる", () => {
  const applied = applyAnswers(ORIPA, { winReportVerify: "keep" });
  assert.deepEqual(planRows(applied.next).ask.map((row) => row.name), ["userItemRollback"]);
});

test("上流のカテゴリ: 違う maxRequests だけ聞く(同じ値・窓だけ・値の無い行は並べない)", () => {
  const text = `${HEAD}export type Extra = Record<never, RateLimitRule>;

export default {
  login: { maxRequests: 10 },
  signupEmail: { maxRequests: ${UPSTREAM_MAX_REQUESTS.signupEmail} },
  apiGeneral: { windowSeconds: 120 },
  "passwordReset": { windowSeconds: 600, maxRequests: 6 },
} satisfies RateLimitOverride<Extra>;
`;
  const plan = planRows(text);
  assert.deepEqual(plan.ask.map((row) => [row.name, row.origin, row.maxRequests, row.upstream]), [["login", "tuned", 10, 5], ["passwordReset", "tuned", 6, 3]]);
  const applied = applyAnswers(text, { login: "same" });
  assert.ok(applied.next.includes("login: { maxRequests: 9 /* ratelimit-count-fix: same (was 10) */ },"));
  assert.ok(applied.next.includes(`signupEmail: { maxRequests: ${UPSTREAM_MAX_REQUESTS.signupEmail} },`), "触らない");
});

test("maxRequests 1 は変わらない(聞かない)、2 は聞いて same → 1", () => {
  const text = `${HEAD}export type Extra = { one: RateLimitRule; two: RateLimitRule };

export default {
  one: { windowSeconds: 60, maxRequests: 1 },
  two: { windowSeconds: 60, maxRequests: 2 },
} satisfies RateLimitOverride<Extra>;
`;
  const plan = planRows(text);
  assert.deepEqual(plan.unchanged.map((row) => row.name), ["one"]);
  assert.deepEqual(plan.ask.map((row) => row.name), ["two"]);
  assert.ok(applyAnswers(text, { two: "same" }).next.includes("maxRequests: 1 /* ratelimit-count-fix: same (was 2) */"));
  assert.deepEqual(applyAnswers(text, { one: "same" }).applied, [], "聞かない行は書かない");
});

test("止める: 字面でない値・展開・計算した鍵・1 より小さい値・知らない名前・答えの形", () => {
  const wrap = (body) => `${HEAD}export type Extra = { a: RateLimitRule };\nconst base = { windowSeconds: 60, maxRequests: 3 };\nexport default {\n${body}\n} satisfies RateLimitOverride<Extra>;\n`;
  assert.match(planRows(wrap("  a: base,")).reason, /字面のオブジェクトでない/);
  assert.match(planRows(wrap("  ...base,")).reason, /字面でない項目/);
  assert.match(planRows(wrap('  ["a"]: { maxRequests: 3 },')).reason, /計算した鍵/);
  assert.match(planRows(wrap("  a: { maxRequests: 0 },")).reason, /1 より小さい/);
  const ok = wrap("  a: { windowSeconds: 60, maxRequests: 3 },");
  assert.match(applyAnswers(ok, { login: "same" }).reason, /聞く物に無い/);
  assert.match(applyAnswers(ok, { a: "yes" }).reason, /same か keep/);
  assert.match(parseAnswers(["a"]).reason, /<名前>=same\|keep/);
  assert.deepEqual(parseAnswers(["a=same", "b=keep"]), { ok: true, answers: { a: "same", b: "keep" } });
});

// boardgame-site の src/config/domains/rateLimit.config.ts の形(式の行・上流から変えた字面の行)+ 上流と同じ値の行
const BOARDGAME = `${HEAD.replace("\n\n", "\nimport { isDevelopment } from \"@/lib/appEnv\";\n\n")}export type Extra = Record<never, RateLimitRule>;

export default {
  // サインアップのメール送信: 開発環境では動作確認しやすいよう緩和(本番は上流と同じ 7 回/時)
  signupEmail: { maxRequests: isDevelopment() ? 100 : 7 },
  // 初回管理者セットアップ: 認証不要の入口なので上流(10 回/時)より絞る
  adminSetup: { maxRequests: 5 },
  passwordReset: { maxRequests: 3 },
} satisfies RateLimitOverride<Extra>;
`;

test("式の maxRequests(boardgame-site の形): 手で見るに並べて止めない、字面の行は今までどおり聞く", () => {
  const plan = planRows(BOARDGAME);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.manual, [{ name: "signupEmail", origin: "upstream", source: "isDevelopment() ? 100 : 7" }]);
  assert.deepEqual(plan.ask.map((row) => [row.name, row.origin, row.maxRequests, row.upstream]), [["adminSetup", "tuned", 5, UPSTREAM_MAX_REQUESTS.adminSetup]]);
  assert.deepEqual(plan.unchanged, []);
  const applied = applyAnswers(BOARDGAME, { adminSetup: "same" });
  assert.equal(applied.ok, true);
  assert.ok(applied.next.includes("adminSetup: { maxRequests: 4 /* ratelimit-count-fix: same (was 5) */ },"));
  assert.ok(applied.next.includes("signupEmail: { maxRequests: isDevelopment() ? 100 : 7 },"), "式の行は触らない");
  const again = planRows(applied.next);
  assert.deepEqual(again.ask, []);
  assert.deepEqual(again.done.map((row) => [row.name, row.mark]), [["adminSetup", "same"]]);
  assert.deepEqual(again.manual.map((row) => row.name), ["signupEmail"], "手で見る行は印が付かないので 2 回目も並ぶ");
});

test("手で見る行を --apply で答えると止める(何も書かない)。足したカテゴリの式も手で見る", () => {
  const refused = applyAnswers(BOARDGAME, { adminSetup: "same", signupEmail: "keep" });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /signupEmail は手で直す行\(maxRequests が isDevelopment\(\) \? 100 : 7\)/);
  const added = `${HEAD}export type Extra = { mine: RateLimitRule };\nconst N = 4;\n\nexport default {\n  mine: { windowSeconds: 60, maxRequests: N },\n} satisfies RateLimitOverride<Extra>;\n`;
  assert.deepEqual(planRows(added).manual, [{ name: "mine", origin: "added", source: "N" }]);
  assert.deepEqual(planRows(added.replace("maxRequests: N", "maxRequests: 2 * 3")).manual.map((row) => row.source), ["2 * 3"]);
});
