// scripts/runner/gates/run.mjs — 門の入口(pnpm check / pnpm generate)
// 実行: node scripts/runner/gates/run.mjs <check|generate> [<対象>] [--gate=<門>]
//   対象なし = 全部の対象の check(generate)を順に / <対象> = その 1 つ / --gate=<門> = その門に乗る物だけ(gates.json の門の名前)
//   各対象の入口(gate.json の check / generate のファイル)を、.mjs/.js は node、.ts は tsx(+ server-only の下駄)で起動する。
//   引数は入口にそのまま渡し、env GATE=<門 | ->を付ける。
//   features の機能が閉じていれば飛ばし「機能 <名前> が閉じているので飛ばした」を必ず出す。
//   offline の門(build)に乗る対象の check は、DB・外部の env を空にし netGuard.mjs を preload して起動し、外に届こうとしたら落とす。
//   exit 0 = 全部通る(対象なし含む)| 1 = 落ちた・外に届いた | 2 = 宣言の誤り(知らない門・欄・入口のファイル・after の循環)
import { spawnSync } from "node:child_process";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MARK } from "./netGuard.mjs";
import { GateError, loadGates, scanTargets } from "./scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const OFFLINE_ENV = /^(DATABASE_URL.*|MY_SERVICE_ACCOUNT_KEY|NEXT_PUBLIC_FIREBASE_.*|FIREBASE_.*|GOOGLE_APPLICATION_CREDENTIALS|GCS_.*|ANTHROPIC_API_KEY|RESEND_.*|SENDGRID_.*|SMTP_.*|CLOUDFLARE_.*)$/;

/** 機能の開閉: env GATES_FEATURES(JSON、テスト用)か features.ts を tsx で */
function featureStates(repo) {
  if (process.env.GATES_FEATURES) return JSON.parse(process.env.GATES_FEATURES);
  const r = spawnSync("npx", ["tsx", "--import", "./scripts/test/serverOnlyStub.mjs", join(HERE, "features.ts")], { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) throw new GateError(`機能の開閉が読めない: ${(r.stderr || r.stdout).trim().split("\n").slice(-2).join(" / ")}`);
  return JSON.parse(r.stdout);
}

function command(repo, file, offline) {
  const guard = offline ? ["--import", join(HERE, "netGuard.mjs")] : [];
  if (extname(file) === ".ts") return ["npx", ["tsx", ...guard, "--import", "./scripts/test/serverOnlyStub.mjs", file]];
  return [process.execPath, [...guard, file]];
}

/** 本体: { code, lines }(テストは scriptsDir・repo・log を渡す) */
export function run(argv, { repo = join(HERE, "../../.."), scriptsDir = join(repo, "scripts"), log = console.log } = {}) {
  const mode = argv[0];
  if (mode !== "check" && mode !== "generate") {
    console.error("usage: pnpm check|generate [<対象>] [--gate=<門>] [-- <入口への引数>]");
    return 2;
  }
  const sep = argv.indexOf("--");
  const own = sep < 0 ? argv.slice(1) : argv.slice(1, sep);
  const pass = sep < 0 ? [] : argv.slice(sep + 1);
  const gate = own.find((a) => a.startsWith("--gate="))?.slice(7) ?? null;
  const name = own.find((a) => !a.startsWith("--")) ?? null;
  let gates;
  let targets;
  try {
    gates = loadGates(scriptsDir);
    if (gate && !(gate in gates.gates)) throw new GateError(`知らない門 ${gate}(門は ${Object.keys(gates.gates).join(", ")})`);
    targets = scanTargets(scriptsDir, gates);
  } catch (e) {
    if (!(e instanceof GateError)) throw e;
    log(`gates: 止まる — ${e.message}`);
    return 2;
  }
  if (name && !targets.some((t) => t.name === name)) {
    log(`gates: 対象 ${name} が無い(gate.json を持つ対象: ${targets.map((t) => t.name).join(", ") || "なし"})`);
    return 2;
  }
  const picked = targets.filter((t) => t.decl[mode] && (!name || t.name === name) && (!gate || (t.decl.gates ?? []).includes(gate)));
  if (!picked.length) {
    log(`gates: ${mode}${gate ? ` --gate=${gate}` : ""}${name ? ` ${name}` : ""}: 対象なし`);
    return 0;
  }
  let states = null;
  if (picked.some((t) => t.decl.features?.length)) {
    try {
      states = featureStates(repo);
    } catch (e) {
      log(`gates: 止まる — ${e.message}`);
      return 2;
    }
  }
  const offlineGates = Object.entries(gates.gates).filter(([, g]) => g.offline).map(([n]) => n);
  let code = 0;
  for (const t of picked) {
    const label = `${t.kind}/${t.name}`;
    const closed = (t.decl.features ?? []).filter((f) => states && states[f] === false);
    const unknown = (t.decl.features ?? []).filter((f) => states && !(f in states));
    if (unknown.length) {
      log(`gates: ${label}: 知らない機能 ${unknown.join(", ")}`);
      return 2;
    }
    if (closed.length) {
      log(`gates: ${label}: 機能 ${closed.join(", ")} が閉じているので飛ばした`);
      continue;
    }
    const offline = mode === "check" && (t.decl.gates ?? []).some((g) => offlineGates.includes(g));
    const env = { ...process.env, GATE: gate ?? "-" };
    if (offline) for (const k of Object.keys(env)) if (OFFLINE_ENV.test(k)) env[k] = "";
    const [cmd, args] = command(repo, join(t.dir, t.decl[mode]), offline);
    const r = spawnSync(cmd, [...args, ...pass], { cwd: repo, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.stdout) process.stdout.write(r.stdout);
    const err = r.stderr ?? "";
    const hit = err.split("\n").find((l) => l.startsWith(MARK));
    process.stderr.write(err.split("\n").filter((l) => !l.startsWith(MARK)).join("\n"));
    if (hit) {
      log(`gates: ${label}: build に宣言した検査が外に届いた(${hit.slice(MARK.length).trim()})。この宣言は拒む: gate.json の gates から offline の門を外すか、外に届かない検査にする`);
      code = 1;
    } else if (r.status !== 0) {
      log(`gates: ${label}: ${mode} が落ちた(exit ${r.status})`);
      code = 1;
    } else log(`gates: ${label}: ${mode} 通る`);
  }
  return code;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(run(process.argv.slice(2)));
