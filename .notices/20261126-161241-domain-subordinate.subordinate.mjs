// .notices/20261126-161241-domain-subordinate.subordinate.mjs
// 移す道具(区切り domain-subordinate、D334): 集まりの従属はドメインでなく主のドメインの中の登録。今ある従属のドメインを主のドメインの中へ移す。
// - 鍵の改名: 全ての entities/<登録>/entity.json の集まりの項目 collection.domain → collection.registration(値はそのまま = 従属の登録の singular)
// - 従属のドメイン = 主の集まりの項目(mediaCollection)の collection.registration(古い鍵 domain も読む)が指すドメインで、主と別のフォルダにある物。
//   その中身を主のドメインのフォルダの同じ相対の場所へ移す(entities/<従属>/ と一式・手で足したファイル)。
//   移さない物: domain.json(従属はドメインでなくなる)、ドメインの直下の集める入口 entities/{display,drizzle,form,index,model,schema}.ts(主のドメインの物を
//   pnpm generate registry が作り直す)、seed.ts(行の無い雛形なら消す。行があれば止める: 主の seed.ts へ手で移す)、主に同じ中身で既にある物(wrappers/.gitkeep など)
// - 門番の規則(src/featureGate/rules/*.ts)の domains から従属の名前を外す(従属は主のドメインと一緒に開け閉めする)。主が同じ規則に無ければ止める(開け閉めが変わる)
// - 読み手: src・scripts・tests・eslint-rules のコードの中の道 @/domains/<従属>/ と src/domains/<従属>/ を主のドメインの物に書き換える(import・import()・
//   mock.module の文字列・頭の道の注釈)。生成物も書き換え(続けて生成器で作り直す)
// - 止める(何も書かない): 従属のドメインに従属以外の登録がある、従属か主が core、移す先に違う中身のファイルが既にある、従属を 2 つの主が指す、
//   seed.ts に行がある、門番の規則に主が無い、ドメイン直下の display を読む読み手がある(主の表示の写しに変わるので読み手を直す)
//
// 使い方(リポのルートで): node .notices/20261126-161241-domain-subordinate.subordinate.mjs [--write]
//   既定 = 計画だけ(何も書かない)。--write = 移す・書き換える。続けて pnpm forge(生成器・登録表・地区の地図)。
//   何度走らせても同じ結果(移し済みの従属・改名済みの鍵は計画に出ない)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";

import { nodeDomainSource, readDomains } from "../src/lib/domain/node.mjs";

/** ドメインの直下の集める入口(主のドメインの物を pnpm generate registry が作り直すので移さない) */
export const COLLECTOR_FILES = ["display", "drizzle", "form", "index", "model", "schema"].map((kind) => `entities/${kind}.ts`);
/** 読み手を探す場所 */
const READER_ROOTS = ["src", "scripts", "tests", "eslint-rules"];
const CODE_FILE = /\.(ts|tsx|mts|mjs|js|cjs)$/;
const RULES_DIR = "src/featureGate/rules";
const COLLECTION_FIELD = "mediaCollection";

const toCamel = (value) => value.replace(/[-_]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, (c) => c.toLowerCase());
const posix = (value) => value.split(path.sep).join("/");
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** entity.json の本文の集まりの鍵 collection.domain を registration に(collection の中だけ。入れ子の無いオブジェクト) */
export function renameCollectionKey(text) {
  return text.replace(/("collection"\s*:\s*\{)([^{}]*)(\})/g, (all, head, body, tail) => `${head}${body.replace(/"domain"(\s*:)/, '"registration"$1')}${tail}`);
}

/** seed.ts に入れる行があるか(tables の各値の配列に要素が 1 つでもあれば true。読めない形も true = 止める) */
export function seedHasRows(text) {
  const source = ts.createSourceFile("seed.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let tables = null;
  const visit = (node) => {
    if (!tables && ts.isPropertyAssignment(node) && node.name.getText(source) === "tables") tables = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!tables || !ts.isObjectLiteralExpression(tables)) return true;
  return tables.properties.some((property) => !ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer) || property.initializer.elements.length > 0);
}

/** 読み手の本文の従属のドメインの道を主のドメインの物に(@/domains/<child>/・src/domains/<child>/、続きが / か " か ' か ` の時だけ) */
export function rewriteReader(text, child, owner) {
  return text
    .replace(new RegExp(`@/domains/${escape(child)}(?=[/"'\`])`, "g"), `@/domains/${owner}`)
    .replace(new RegExp(`src/domains/${escape(child)}(?=[/"'\`])`, "g"), `src/domains/${owner}`);
}

/** 門番の規則の本文から従属の名前の行を外す。外した時、主がその規則に無ければ problem */
export function rewriteRule(text, child, owner) {
  const line = new RegExp(`^\\s*["']${escape(child)}["'],?\\s*\\n`, "m");
  if (!line.test(text)) return { text, changed: false, problem: null };
  const listsOwner = new RegExp(`["']${escape(owner)}["']`).test(text);
  return { text: text.replace(line, ""), changed: true, problem: listsOwner ? null : `門番の規則が従属 ${child} を開けるのに主のドメイン ${owner} を開けない(主と一緒に開け閉めするよう、先に規則に ${owner} を足すか従属を外す)` };
}

function listFiles(root, dirs) {
  const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z", "--", ...dirs], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return out.split("\0").filter((file) => file && fs.existsSync(path.join(root, file)));
}

/**
 * 計画(何も書かない)
 * @returns {{ keyRenames: string[], moves: { child: string, owner: string, from: string, to: string }[], removes: string[], writes: Record<string, string>, stops: string[] }}
 */
export function planSubordinate(root) {
  const declarations = readDomains(nodeDomainSource(root)).filter((declaration) => declaration.domain !== null);
  const byName = new Map(declarations.map((declaration) => [declaration.name, declaration]));
  const writes = {};
  const keyRenames = [];
  const moves = [];
  const removes = [];
  const stops = [];
  const claims = new Map();

  for (const declaration of declarations) {
    for (const registration of declaration.registrations) {
      const entityPath = `${declaration.dir}/entities/${registration.name}/entity.json`;
      const full = path.join(root, entityPath);
      if (fs.existsSync(full)) {
        const text = fs.readFileSync(full, "utf8");
        const renamed = renameCollectionKey(text);
        if (renamed !== text) {
          writes[entityPath] = renamed;
          keyRenames.push(entityPath);
        }
      }
      for (const field of registration.entity?.fields ?? []) {
        if (field?.fieldType !== COLLECTION_FIELD) continue;
        const name = field.collection?.registration ?? field.collection?.domain;
        if (typeof name !== "string" || name === "") continue;
        const child = toCamel(name);
        if (child === declaration.name || declaration.registrations.some((other) => other.name === child)) continue; // もう主のドメインの中
        claims.set(child, [...(claims.get(child) ?? []), declaration.name]);
      }
    }
  }

  const files = listFiles(root, READER_ROOTS);
  for (const [child, owners] of claims) {
    const childDecl = byName.get(child);
    if (!childDecl) continue; // まだ書き出していない従属(次の生成で主のドメインの中に書く)
    if (owners.length > 1) {
      stops.push(`${child}: 従属を 2 つの主(${owners.join(", ")})が指す。1 つにしてから`);
      continue;
    }
    const ownerDecl = byName.get(owners[0]);
    if (childDecl.core || ownerDecl.core) {
      stops.push(`${child}: 従属か主(${ownerDecl.name})が core のドメイン(core は上流が移す。/order next-starter)`);
      continue;
    }
    const others = childDecl.registrations.filter((registration) => registration.name !== child);
    if (others.length > 0) {
      stops.push(`${child}: 従属のドメインに従属でない登録(${others.map((r) => r.name).join(", ")})がある。別のドメインに分けてから`);
      continue;
    }
    const owner = ownerDecl.name;
    const childDir = childDecl.dir;
    const ownerDir = ownerDecl.dir;
    const childFiles = listFiles(root, [childDir]);
    for (const file of childFiles) {
      const rel = posix(path.relative(childDir, file));
      if (rel === "domain.json" || COLLECTOR_FILES.includes(rel)) {
        removes.push(file);
        continue;
      }
      if (rel === "seed.ts") {
        if (seedHasRows(fs.readFileSync(path.join(root, file), "utf8"))) stops.push(`${file}: 行がある(主の ${ownerDir}/seed.ts の tables へ手で移して消してから)`);
        else removes.push(file);
        continue;
      }
      const to = `${ownerDir}/${rel}`;
      const target = path.join(root, to);
      if (fs.existsSync(target)) {
        if (fs.readFileSync(target, "utf8") === fs.readFileSync(path.join(root, file), "utf8")) removes.push(file);
        else stops.push(`${file} → ${to}: 移す先に違う中身のファイルがある`);
        continue;
      }
      moves.push({ child, owner, from: file, to });
    }
    const childFileSet = new Set(childFiles);
    for (const file of files) {
      if (!CODE_FILE.test(file) || childFileSet.has(file)) continue;
      const before = writes[file] ?? fs.readFileSync(path.join(root, file), "utf8");
      if (new RegExp(`@/domains/${escape(child)}/entities/display(?=["'\`])`).test(before) && !before.includes("生成物・編集不可")) {
        stops.push(`${file}: 従属のドメインの表示の写し(@/domains/${child}/entities/display)を読む(移すと主の表示に変わる。従属の entity.json を読むように直してから)`);
      }
      let after = rewriteReader(before, child, owner);
      if (file.startsWith(`${RULES_DIR}/`)) {
        const rule = rewriteRule(after, child, owner);
        if (rule.problem) stops.push(`${file}: ${rule.problem}`);
        after = rule.text;
      }
      if (after !== before) writes[file] = after;
    }
    // 移すファイルの中身の道(頭の注釈・import)も主の物に
    for (const move of moves.filter((m) => m.child === child)) {
      const text = fs.readFileSync(path.join(root, move.from), "utf8");
      move.text = rewriteReader(text, child, owner);
    }
    removes.push(`${childDir}/`);
  }
  return { keyRenames, moves, removes, writes, stops };
}

/** 計画を書く(止める物があれば何も書かない) */
export function applySubordinate(root, plan) {
  if (plan.stops.length > 0) throw new Error(`止める物があるので何も書きません:\n${plan.stops.map((s) => `  - ${s}`).join("\n")}`);
  for (const [file, text] of Object.entries(plan.writes)) fs.writeFileSync(path.join(root, file), text);
  for (const move of plan.moves) {
    fs.mkdirSync(path.dirname(path.join(root, move.to)), { recursive: true });
    fs.writeFileSync(path.join(root, move.to), move.text);
    fs.rmSync(path.join(root, move.from));
  }
  for (const target of plan.removes) fs.rmSync(path.join(root, target), { recursive: true, force: true });
}

function main() {
  const root = process.cwd();
  const write = process.argv.includes("--write");
  const plan = planSubordinate(root);
  console.log(`鍵の改名 collection.domain → collection.registration: ${plan.keyRenames.length} ファイル`);
  for (const file of plan.keyRenames) console.log(`  ${file}`);
  console.log(`移す: ${plan.moves.length} ファイル`);
  for (const move of plan.moves) console.log(`  ${move.from} → ${move.to}`);
  console.log(`消す: ${plan.removes.length}`);
  for (const target of plan.removes) console.log(`  ${target}`);
  const rewritten = Object.keys(plan.writes).filter((file) => !plan.keyRenames.includes(file));
  console.log(`読み手の書き換え: ${rewritten.length} ファイル`);
  for (const file of rewritten) console.log(`  ${file}`);
  if (plan.stops.length > 0) {
    console.log(`止める: ${plan.stops.length}`);
    for (const stop of plan.stops) console.log(`  - ${stop}`);
    process.exitCode = 1;
    return;
  }
  if (!write) {
    console.log("計画だけ(何も書いていません)。--write で書きます。続けて pnpm forge");
    return;
  }
  applySubordinate(root, plan);
  console.log("書きました。続けて pnpm forge(生成器・登録表・地区の地図を作り直す)");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
