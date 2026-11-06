// forge の段の並び（純粋）と、段を順に回す runner（段の実行は差し替えられる = テスト用）。
// 順は依存から: 事前検査（何も書かない。作り直せる一覧のずれは見ない）→ 生成（role → dc → 一覧 → extensions → routes:map、門の after の順）
// → 事後検査（門の検査 → テスト → typecheck → lint）→ デプロイ先の検査（生成とは別の段。今は Vercel だけ: vercel.json があるときの cron の検査）。
// cron は生成しない（cron:generate は別コマンド、--plan 必須）。
// 生成直後に落ちうる検査は route-map だけ（routes:map で作り直してから見る）。調べた所要時間: typecheck 10〜13 秒、lint 全体 32 秒、ほかは 1 秒前後

/**
 * @typedef {object} Step
 * @property {"pre" | "generate" | "post" | "deploy"} phase
 * @property {string} name 表示名（落ちたときに出す）
 * @property {string} [script] package.json のスクリプト名（pnpm run で回す）
 * @property {string[]} [args] スクリプトに渡す引数
 * @property {string} [hint] 落ちたときに足す直し方
 */

const script = (phase, name, args = []) => ({ phase, name: [name, ...args].join(" "), script: name, args });

/**
 * 段の並び。生成器・検査器は門(scripts/runner/gates)で回す: 各道具の gate.json が乗る門と順序(after)を持つ
 *   pre = pnpm check --gate=forge:pre(role の宣言・domain の --dry-run・extensions の --no-stale)
 *   generate = pnpm generate --gate=forge:pre,forge:post(after の順 role → domain → registry → extensions → routes。cron は生成しない)
 *   post = pnpm check --gate=forge:post(domain の feature-map・registry・extensions・routes の地図)+ 門に乗らないテストと typecheck(・lint)
 *   deploy = pnpm check --gate=deploy(vercel.json が無ければ cron が飛ばして出す)
 * @param {{ lint?: boolean }} options
 * @returns {Step[]}
 */
export function buildSteps({ lint = false } = {}) {
  return [
    script("pre", "check", ["--gate=forge:pre"]),
    script("generate", "generate", ["--gate=forge:pre,forge:post"]),
    script("post", "check", ["--gate=forge:post"]),
    script("post", "test:schema-registry"),
    script("post", "test:storage-purposes"),
    script("post", "test:service-registry"),
    script("post", "test:collection-wiring"),
    script("post", "test:screens"),
    script("post", "test:wiring"),
    script("post", "test:feature-gate"),
    script("post", "typecheck"),
    ...(lint ? [script("post", "lint")] : []),
    { ...script("deploy", "check", ["--gate=deploy"]), hint: "vercel.json の crons がタスクとずれていれば pnpm cron:generate --plan hobby|pro（契約中のプラン）で作り直してコミット" },
  ];
}

const PHASE_LABEL = { pre: "事前検査", generate: "生成", post: "事後検査", deploy: "デプロイ先の検査" };

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
      io.error(`\n✗ forge: ${PHASE_LABEL[step.phase]}「${step.name}」で止まりました。${step.phase === "pre" ? "何も書いていません。" : ""}${step.hint ? `${step.hint}。` : ""}直してから ${rerun}`);
      return { ok: false, failed: step, ran };
    }
  }
  return { ok: true, ran };
}
