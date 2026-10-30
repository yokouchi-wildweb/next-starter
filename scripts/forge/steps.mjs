// forge の段の並び（純粋）と、段を順に回す runner（段の実行は差し替えられる = テスト用）。
// 順は依存から: 事前検査（何も書かない。作り直せる一覧のずれは見ない）→ 生成（role → dc → 一覧 → routes:map）→ 事後検査（速いもの → typecheck → lint）
// → デプロイ先の検査（生成とは別の段。今は Vercel だけ: vercel.json があるときの cron:check）。
// cron は生成しない（cron:generate は別コマンド、--plan 必須）。
// 生成直後に落ちうる検査は route-map だけ（routes:map で作り直してから見る）。調べた所要時間: typecheck 10〜13 秒、lint 全体 32 秒、ほかは 1 秒前後

/**
 * @typedef {object} Step
 * @property {"pre" | "generate" | "post" | "deploy"} phase
 * @property {string} name 表示名（落ちたときに出す）
 * @property {string} [script] package.json のスクリプト名（pnpm run で回す）
 * @property {string[]} [args] スクリプトに渡す引数
 * @property {string} [check] 関数で回す事前検査の名前（run.mjs が中身を持つ）
 * @property {string} [hint] 落ちたときに足す直し方
 */

const script = (phase, name, args = []) => ({ phase, name: [name, ...args].join(" "), script: name, args });

/**
 * デプロイ先の検査。今は Vercel だけ（vercel.json がある = Vercel にデプロイしている、とみなす）。
 * cron:check は vercel.json の crons が hobby / pro どちらかの生成結果と一致するかを自分で見るので plan は要らない
 * @param {{ vercel: boolean }} targets
 * @returns {Step[]}
 */
export function deploySteps({ vercel }) {
  return vercel ? [{ ...script("deploy", "cron:check"), hint: "vercel.json の crons がタスクとずれています。pnpm cron:generate --plan hobby|pro（契約中のプラン）で作り直してコミット" }] : [];
}

/**
 * @param {{ vercel: boolean, lint?: boolean }} options vercel = vercel.json があるか（無ければデプロイ先の検査は無し）
 * @returns {Step[]}
 */
export function buildSteps({ vercel, lint = false }) {
  return [
    { phase: "pre", name: "ロール・プロフィールの検査", check: "roles" },
    script("pre", "dc:generate:all", ["--dry-run"]),
    script("pre", "extensions:check", ["--no-stale"]),
    script("generate", "role:generate", ["--all"]),
    script("generate", "dc:generate:all"),
    script("generate", "registry:generate"),
    script("generate", "extensions:generate"),
    script("generate", "routes:map"),
    script("post", "registry:check"),
    script("post", "extensions:check"),
    script("post", "test:schema-registry"),
    script("post", "test:storage-purposes"),
    script("post", "test:service-registry"),
    script("post", "test:collection-wiring"),
    script("post", "routes:map", ["--check"]),
    script("post", "dc:feature-map", ["--check"]),
    script("post", "test:screens"),
    script("post", "test:wiring"),
    script("post", "test:feature-gate"),
    script("post", "typecheck"),
    ...(lint ? [script("post", "lint")] : []),
    ...deploySteps({ vercel }),
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
