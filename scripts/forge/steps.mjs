// forge の段の並び（純粋）と、段を順に回す runner（段の実行は差し替えられる = テスト用）。
// 順は依存から: 事前検査（何も書かない）→ 生成（role → dc → routes:map → cron）→ 事後検査（速いもの → typecheck → lint）。
// 生成直後に落ちうる検査は route-map だけ（routes:map で作り直してから見る）。調べた所要時間: typecheck 10〜13 秒、lint 全体 32 秒、ほかは 1 秒前後

/**
 * @typedef {object} Step
 * @property {"pre" | "generate" | "post"} phase
 * @property {string} name 表示名（落ちたときに出す）
 * @property {string} [script] package.json のスクリプト名（pnpm run で回す）
 * @property {string[]} [args] スクリプトに渡す引数
 * @property {string} [check] 関数で回す事前検査の名前（run.mjs が中身を持つ）
 */

const script = (phase, name, args = []) => ({ phase, name: [name, ...args].join(" "), script: name, args });

/**
 * @param {{ cronPlan: "hobby" | "pro" | null, lint?: boolean }} options cronPlan = null なら cron の段と cron:check を飛ばす
 * @returns {Step[]}
 */
export function buildSteps({ cronPlan, lint = false }) {
  const cron = cronPlan !== null;
  return [
    { phase: "pre", name: "ロール・プロフィールの検査", check: "roles" },
    script("pre", "dc:generate:all", ["--dry-run"]),
    script("pre", "registry:check"),
    script("generate", "role:generate", ["--all"]),
    script("generate", "dc:generate:all"),
    script("generate", "routes:map"),
    ...(cron ? [script("generate", "cron:generate", ["--plan", cronPlan])] : []),
    script("post", "registry:check"),
    script("post", "test:schema-registry"),
    script("post", "test:storage-purposes"),
    script("post", "test:service-registry"),
    script("post", "test:collection-wiring"),
    script("post", "routes:map", ["--check"]),
    script("post", "dc:feature-map", ["--check"]),
    script("post", "test:screens"),
    script("post", "test:wiring"),
    script("post", "test:feature-gate"),
    ...(cron ? [script("post", "cron:check")] : []),
    script("post", "typecheck"),
    ...(lint ? [script("post", "lint")] : []),
  ];
}

const PHASE_LABEL = { pre: "事前検査", generate: "生成", post: "事後検査" };

/**
 * 段を順に回し、最初に落ちた段で止まる
 * @param {Step[]} steps
 * @param {{ exec: (step: Step) => boolean, io?: { log: Function, error: Function } }} options exec = 段を回して成否を返す
 * @returns {{ ok: boolean, failed?: Step, ran: string[] }}
 */
export function runSteps(steps, { exec, io = console }) {
  const ran = [];
  for (const [index, step] of steps.entries()) {
    io.log(`\n[forge ${index + 1}/${steps.length}] ${PHASE_LABEL[step.phase]}: ${step.name}`);
    ran.push(step.name);
    if (!exec(step)) {
      const rerun = step.script ? `pnpm ${[step.script, ...step.args].join(" ")} で確かめ、pnpm forge をもう一度` : "pnpm forge をもう一度";
      io.error(`\n✗ forge: ${PHASE_LABEL[step.phase]}「${step.name}」で止まりました。${step.phase === "pre" ? "何も書いていません。" : ""}直してから ${rerun}`);
      return { ok: false, failed: step, ran };
    }
  }
  return { ok: true, ran };
}
