// scripts/runner/phases/run.mjs — 段階の入口(pnpm check / pnpm generate)
// 実行: node scripts/runner/phases/run.mjs <check|generate> [<対象>] [--phase=<段階>]
//   対象なし = 全部の対象の check(generate)を順に / <対象> = その 1 つ / --phase=<段階>[,<段階>…] = そのどれかに乗る物だけ(phases.json の段階の名前。
//   複数なら after の順に 1 回ずつ、env PHASE はその対象が乗る最初の段階)
//   各対象の入口(phase.json の check / generate のファイル)を、.mjs/.js は node、.ts は tsx(+ server-only の下駄)で起動する。
//   引数は入口にそのまま渡し、env PHASE=<段階 | ->を付ける。
//   features の機能が閉じていれば飛ばし「機能 <名前> が閉じているので飛ばした」を必ず出す。
//   offline の段階(build・build:post)に乗る対象の check は、DB・外部の env を外し(未設定にする。"" は値なので `??` に残り、
//   "https://${id}.web.app" のような組み立てを壊す)、netGuard.mjs を preload して起動し、外に届こうとしたら落とす。
//   watch の段階(phases.json の "watch": true、今は ship)で選んだ対象のうち phase.json に watch を持つ物は、範囲(上流の追跡先か
//   origin/<枝>、無ければ origin/HEAD との分岐点から HEAD まで + 作業ツリー・未追跡)の変更が watch の glob に当たらなければ飛ばし、
//   飛ばしたことを 1 行出す。範囲が決まらなければ回す。--all で watch を見ずに全部回す。名前で呼んだ対象は watch を見ない。
//   exit 0 = 全部通る(対象なし含む)| 1 = 落ちた・外に届いた | 2 = 宣言の誤り(知らない段階・欄・入口のファイル・after の循環)
import { spawnSync } from "node:child_process";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { changedFiles, globToRegExp } from "./changed.mjs";
import { MARK } from "./netGuard.mjs";
import { PhaseError, loadPhases, scanTargets } from "./scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export { changedFiles, globToRegExp };
export const OFFLINE_ENV = /^(DATABASE_URL.*|MY_SERVICE_ACCOUNT_KEY|NEXT_PUBLIC_FIREBASE_.*|FIREBASE_.*|GOOGLE_APPLICATION_CREDENTIALS|GCS_.*|ANTHROPIC_API_KEY|RESEND_.*|SENDGRID_.*|SMTP_.*|CLOUDFLARE_.*)$/;

/** 機能の開閉: env GATES_FEATURES(JSON、テスト用)か features.ts を tsx で */
function featureStates(repo) {
  if (process.env.GATES_FEATURES) return JSON.parse(process.env.GATES_FEATURES);
  const r = spawnSync("npx", ["tsx", "--import", "./scripts/runner/preload/serverOnly.mjs", join(HERE, "features.ts")], { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) throw new PhaseError(`機能の開閉が読めない: ${(r.stderr || r.stdout).trim().split("\n").slice(-2).join(" / ")}`);
  return JSON.parse(r.stdout);
}

/** 対象の入口の起動のしかた: .ts は tsx + server-only の下駄(scripts/runner/preload/entries.test.mjs が確かめる)、ほかは node */
export function command(repo, file, offline) {
  const guard = offline ? ["--import", join(HERE, "netGuard.mjs")] : [];
  if (extname(file) === ".ts") return ["npx", ["tsx", ...guard, "--import", "./scripts/runner/preload/serverOnly.mjs", file]];
  return [process.execPath, [...guard, file]];
}

/** 本体: { code, lines }(テストは scriptsDir・repo・log を渡す) */
export function run(argv, { repo = join(HERE, "../../.."), scriptsDir = join(repo, "scripts"), log = console.log, changed = changedFiles } = {}) {
  const mode = argv[0];
  if (mode !== "check" && mode !== "generate") {
    console.error("usage: pnpm check|generate [<対象>] [--phase=<段階>] [--all] [-- <入口への引数>]");
    return 2;
  }
  const sep = argv.indexOf("--");
  const own = sep < 0 ? argv.slice(1) : argv.slice(1, sep);
  const pass = sep < 0 ? [] : argv.slice(sep + 1);
  const phase = own.find((a) => a.startsWith("--phase="))?.slice("--phase=".length) ?? null;
  const phaseList = phase ? phase.split(",").map((g) => g.trim()).filter(Boolean) : null;
  const name = own.find((a) => !a.startsWith("--")) ?? null;
  const all = own.includes("--all");
  let phases;
  let targets;
  try {
    phases = loadPhases(scriptsDir);
    for (const g of phaseList ?? []) if (!(g in phases.phases)) throw new PhaseError(`知らない段階 ${g}(段階は ${Object.keys(phases.phases).join(", ")})`);
    targets = scanTargets(scriptsDir, phases);
  } catch (e) {
    if (!(e instanceof PhaseError)) throw e;
    log(`phases: 止まる — ${e.message}`);
    return 2;
  }
  if (name && !targets.some((t) => t.name === name)) {
    log(`phases: 対象 ${name} が無い(phase.json を持つ対象: ${targets.map((t) => t.name).join(", ") || "なし"})`);
    return 2;
  }
  // explicit の段階(build:post = 組み上がった物が要る)だけに乗る対象は、その段階か名前で呼んだ時だけ回す
  const explicitPhases = Object.entries(phases.phases).filter(([, g]) => g.explicit).map(([n]) => n);
  const onlyExplicit = (t) => (t.decl.phases ?? []).length > 0 && (t.decl.phases ?? []).every((g) => explicitPhases.includes(g));
  const picked = targets.filter((t) => t.decl[mode] && (!name || t.name === name) && (phaseList ? phaseList.some((g) => (t.decl.phases ?? []).includes(g)) : name || !onlyExplicit(t)));
  if (!phase && !name) for (const t of targets.filter((x) => x.decl[mode] && onlyExplicit(x))) log(`phases: ${t.kind}/${t.name}: ${t.decl.phases.join(", ")} だけの対象なので飛ばした(--phase=${t.decl.phases[0]} か名前で回す)`);
  if (!picked.length) {
    log(`phases: ${mode}${phase ? ` --phase=${phase}` : ""}${name ? ` ${name}` : ""}: 対象なし`);
    return 0;
  }
  let states = null;
  if (picked.some((t) => t.decl.features?.length)) {
    try {
      states = featureStates(repo);
    } catch (e) {
      log(`phases: 止まる — ${e.message}`);
      return 2;
    }
  }
  const offlinePhases = Object.entries(phases.phases).filter(([, g]) => g.offline).map(([n]) => n);
  // watch の段階で選んだ時だけ範囲の変更を読む(1 回)
  const watchPhases = (phaseList ?? []).filter((g) => phases.phases[g]?.watch);
  let range = null;
  const watched = (t) => !all && !name && t.decl.watch?.length && watchPhases.some((g) => (t.decl.phases ?? []).includes(g));
  if (picked.some(watched)) {
    range = changed(repo);
    if (range.files === null) log(`phases: watch: ${range.why}ので watch を見ずに全部回す`);
  }
  let code = 0;
  for (const t of picked) {
    const label = `${t.kind}/${t.name}`;
    const closed = (t.decl.features ?? []).filter((f) => states && states[f] === false);
    const unknown = (t.decl.features ?? []).filter((f) => states && !(f in states));
    if (unknown.length) {
      log(`phases: ${label}: 知らない機能 ${unknown.join(", ")}`);
      return 2;
    }
    if (closed.length) {
      log(`phases: ${label}: 機能 ${closed.join(", ")} が閉じているので飛ばした`);
      continue;
    }
    if (watched(t) && range?.files) {
      const res = t.decl.watch.map(globToRegExp);
      if (!range.files.some((f) => res.some((re) => re.test(f)))) {
        log(`phases: ${label}: 変更が watch に当たらないので飛ばした(--all で回す)`);
        continue;
      }
    }
    const offline = mode === "check" && (t.decl.phases ?? []).some((g) => offlinePhases.includes(g));
    const env = { ...process.env, PHASE: phaseList?.find((g) => (t.decl.phases ?? []).includes(g)) ?? "-" };
    if (offline) for (const k of Object.keys(env)) if (OFFLINE_ENV.test(k)) delete env[k];
    const [cmd, args] = command(repo, join(t.dir, t.decl[mode]), offline);
    const r = spawnSync(cmd, [...args, ...pass], { cwd: repo, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.stdout) process.stdout.write(r.stdout);
    const err = r.stderr ?? "";
    const hit = err.split("\n").find((l) => l.startsWith(MARK));
    process.stderr.write(err.split("\n").filter((l) => !l.startsWith(MARK)).join("\n"));
    if (hit) {
      log(`phases: ${label}: build に宣言した検査が外に届いた(${hit.slice(MARK.length).trim()})。この宣言は拒む: phase.json の phases から offline の段階を外すか、外に届かない検査にする`);
      code = 1;
    } else if (r.status !== 0) {
      log(`phases: ${label}: ${mode} が落ちた(exit ${r.status})`);
      code = 1;
    } else log(`phases: ${label}: ${mode} 通る`);
  }
  return code;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = run(process.argv.slice(2));
