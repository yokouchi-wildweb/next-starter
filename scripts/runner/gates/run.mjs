// scripts/runner/gates/run.mjs — 門の入口(pnpm check / pnpm generate)
// 実行: node scripts/runner/gates/run.mjs <check|generate> [<対象>] [--gate=<門>]
//   対象なし = 全部の対象の check(generate)を順に / <対象> = その 1 つ / --gate=<門>[,<門>…] = そのどれかに乗る物だけ(gates.json の門の名前。
//   複数なら after の順に 1 回ずつ、env GATE はその対象が乗る最初の門)
//   各対象の入口(gate.json の check / generate のファイル)を、.mjs/.js は node、.ts は tsx(+ server-only の下駄)で起動する。
//   引数は入口にそのまま渡し、env GATE=<門 | ->を付ける。
//   features の機能が閉じていれば飛ばし「機能 <名前> が閉じているので飛ばした」を必ず出す。
//   offline の門(build・build:post)に乗る対象の check は、DB・外部の env を空にし netGuard.mjs を preload して起動し、外に届こうとしたら落とす。
//   watch の門(gates.json の "watch": true、今は ship)で選んだ対象のうち gate.json に watch を持つ物は、範囲(上流の追跡先か
//   origin/<枝>、無ければ origin/HEAD との分岐点から HEAD まで + 作業ツリー・未追跡)の変更が watch の glob に当たらなければ飛ばし、
//   飛ばしたことを 1 行出す。範囲が決まらなければ回す。--all で watch を見ずに全部回す。名前で呼んだ対象は watch を見ない。
//   exit 0 = 全部通る(対象なし含む)| 1 = 落ちた・外に届いた | 2 = 宣言の誤り(知らない門・欄・入口のファイル・after の循環)
import { spawnSync } from "node:child_process";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MARK } from "./netGuard.mjs";
import { GateError, loadGates, scanTargets } from "./scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** watch の glob(** = 何段でも、* = 1 段の中、? = 1 文字)を正規表現に。リポジトリ直下からの相対パスに丸ごと当てる */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

const git = (repo, args) => {
  const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** 範囲の変更したファイル(リポジトリ直下からの相対)。範囲が決まらなければ { files: null, why } */
export function changedFiles(repo) {
  const branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const candidates = ["@{upstream}", branch && branch !== "HEAD" ? `origin/${branch}` : null, "origin/HEAD", "origin/main"].filter(Boolean);
  const base = candidates.find((ref) => git(repo, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]) !== null);
  if (!base) return { files: null, why: "比べる上流の枝が無い" };
  const lists = [["diff", "--name-only", `${base}...HEAD`], ["diff", "--name-only", "HEAD"], ["ls-files", "--others", "--exclude-standard"]].map((a) => git(repo, a));
  if (lists.some((l) => l === null)) return { files: null, why: "git の差分が読めない" };
  return { files: [...new Set(lists.flatMap((l) => l.split("\n").filter(Boolean)))], base };
}
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
export function run(argv, { repo = join(HERE, "../../.."), scriptsDir = join(repo, "scripts"), log = console.log, changed = changedFiles } = {}) {
  const mode = argv[0];
  if (mode !== "check" && mode !== "generate") {
    console.error("usage: pnpm check|generate [<対象>] [--gate=<門>] [--all] [-- <入口への引数>]");
    return 2;
  }
  const sep = argv.indexOf("--");
  const own = sep < 0 ? argv.slice(1) : argv.slice(1, sep);
  const pass = sep < 0 ? [] : argv.slice(sep + 1);
  const gate = own.find((a) => a.startsWith("--gate="))?.slice(7) ?? null;
  const gateList = gate ? gate.split(",").map((g) => g.trim()).filter(Boolean) : null;
  const name = own.find((a) => !a.startsWith("--")) ?? null;
  const all = own.includes("--all");
  let gates;
  let targets;
  try {
    gates = loadGates(scriptsDir);
    for (const g of gateList ?? []) if (!(g in gates.gates)) throw new GateError(`知らない門 ${g}(門は ${Object.keys(gates.gates).join(", ")})`);
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
  // explicit の門(build:post = 組み上がった物が要る)だけに乗る対象は、その門か名前で呼んだ時だけ回す
  const explicitGates = Object.entries(gates.gates).filter(([, g]) => g.explicit).map(([n]) => n);
  const onlyExplicit = (t) => (t.decl.gates ?? []).length > 0 && (t.decl.gates ?? []).every((g) => explicitGates.includes(g));
  const picked = targets.filter((t) => t.decl[mode] && (!name || t.name === name) && (gateList ? gateList.some((g) => (t.decl.gates ?? []).includes(g)) : name || !onlyExplicit(t)));
  if (!gate && !name) for (const t of targets.filter((x) => x.decl[mode] && onlyExplicit(x))) log(`gates: ${t.kind}/${t.name}: ${t.decl.gates.join(", ")} だけの対象なので飛ばした(--gate=${t.decl.gates[0]} か名前で回す)`);
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
  // watch の門で選んだ時だけ範囲の変更を読む(1 回)
  const watchGates = (gateList ?? []).filter((g) => gates.gates[g]?.watch);
  let range = null;
  const watched = (t) => !all && !name && t.decl.watch?.length && watchGates.some((g) => (t.decl.gates ?? []).includes(g));
  if (picked.some(watched)) {
    range = changed(repo);
    if (range.files === null) log(`gates: watch: ${range.why}ので watch を見ずに全部回す`);
  }
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
    if (watched(t) && range?.files) {
      const res = t.decl.watch.map(globToRegExp);
      if (!range.files.some((f) => res.some((re) => re.test(f)))) {
        log(`gates: ${label}: 変更が watch に当たらないので飛ばした(--all で回す)`);
        continue;
      }
    }
    const offline = mode === "check" && (t.decl.gates ?? []).some((g) => offlineGates.includes(g));
    const env = { ...process.env, GATE: gateList?.find((g) => (t.decl.gates ?? []).includes(g)) ?? "-" };
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
