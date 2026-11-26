// .notices/20261126-185544-firestore-registration.firestore.mjs
// 移す道具(区切り firestore-registration、D335・D336、一度きり: fork が走らせた後に上流が消す): Firestore の登録の表のファイルを、
// ドメインの直下 entities/{model,form,schema,firestore}.ts から登録のフォルダ entities/<登録名>/ へ移す(Neon と同じ形)。
// - 対象: dbEngine Firestore の登録を持つドメインで、ドメインの直下にその種類のファイルが手で(集める入口の印なしで)置かれている物
// - 移す時: 相対の import を 1 段深く、頭の道の注記を新しい道に(生成器と同じ moveIntoRegistration)。firestore.ts の export collectionPath は
//   <登録名>CollectionPath に(集める入口で登録を並べても重ならない、D344)。entities/index.ts はそのまま(集める入口を読む)
// - 読み手: src・scripts・tests・eslint-rules で、そのドメインの entities/firestore・entities・entities/index から collectionPath を import する
//   ファイルの import の要素と参照を新しい名前に
// - 止める(何も書かない): Firestore の登録が 2 つ以上のドメインの直下のファイル(どの登録の物か決められない)、移す先に違う中身がある、
//   読み手に collectionPath という別の宣言がある・別名で読む(as)・import * で読む
//
// 使い方(リポのルートで): node .notices/20261126-185544-firestore-registration.firestore.mjs [--write]
//   既定 = 計画だけ。--write = 移す・書き換える。続けて pnpm generate registry(集める入口 entities/<種類>.ts を書く)と pnpm forge
//   何度走らせても同じ結果(移し済みは計画に出ない)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";

import { nodeDomainSource, readDomains } from "../src/lib/domain/node.mjs";
import { moveIntoRegistration } from "../scripts/structure/domain/render/entities/collector.mjs";

/** Firestore の登録が持つ表のファイルの種類 */
export const FIRESTORE_KINDS = ["firestore", "schema", "form", "model"];
const OLD_NAME = "collectionPath";
const COLLECTOR_HEAD = /生成物・編集不可: pnpm generate registry/;
const READER_ROOTS = ["src", "scripts", "tests", "eslint-rules"];
const CODE_FILE = /\.(ts|tsx|mts|mjs|js)$/;

/** firestore.ts の export const collectionPath を <登録名>CollectionPath に */
export function renameExport(text, registration) {
  return text.replace(new RegExp(`\\bexport const ${OLD_NAME}\\b`), `export const ${registration}CollectionPath`);
}

/** 指定子 → リポジトリ相対の道(拡張子なし。@/domains/<core の名前> は core/ を補う) */
function resolveSpecifier(root, rel, specifier) {
  let target = null;
  if (specifier.startsWith("@/")) target = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) target = path.posix.normalize(`${path.posix.dirname(rel)}/${specifier}`);
  if (!target) return null;
  target = target.replace(/\.(ts|tsx|mjs|js)$/, "").replace(/\/index$/, "");
  if (target.startsWith("src/domains/") && !target.startsWith("src/domains/core/")) {
    const name = target.split("/")[2];
    if (!fs.existsSync(path.join(root, "src/domains", name)) && fs.existsSync(path.join(root, "src/domains/core", name))) target = target.replace("src/domains/", "src/domains/core/");
  }
  return target;
}

/**
 * 読み手 1 本の書き換え: modules(道の集合)から collectionPath を import していれば、要素と参照を newName に
 * @returns {{ text: string, stop: string | null }}
 */
export function rewriteReader(root, rel, text, modules, newName) {
  const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  let importsIt = false;
  let stop = null;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!modules.has(resolveSpecifier(root, rel, statement.moduleSpecifier.text))) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) stop = `${rel}: import * で読む(${OLD_NAME} を ${newName} に手で)`;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text !== OLD_NAME) continue;
      if (element.propertyName) stop = `${rel}: ${OLD_NAME} を別名(as)で読む(${newName} に手で)`;
      else {
        importsIt = true;
        edits.push([element.name.getStart(source), element.name.getEnd()]);
      }
    }
  }
  if (!importsIt || stop) return { text, stop };
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === OLD_NAME) {
      const parent = node.parent;
      const isImportName = ts.isImportSpecifier(parent);
      const isPropertyName = (ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node);
      const isDeclaration = (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isFunctionDeclaration(parent) || ts.isBindingElement(parent)) && parent.name === node;
      if (isDeclaration) stop = `${rel}: ${OLD_NAME} という別の宣言がある(${newName} に手で)`;
      else if (ts.isShorthandPropertyAssignment(parent)) edits.push([node.getStart(source), node.getEnd(), `${OLD_NAME}: ${newName}`]);
      else if (!isImportName && !isPropertyName) edits.push([node.getStart(source), node.getEnd()]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (stop) return { text, stop };
  let out = text;
  for (const [start, end, replacement] of [...edits].sort((a, b) => b[0] - a[0])) out = `${out.slice(0, start)}${replacement ?? newName}${out.slice(end)}`;
  return { text: out, stop: null };
}

/**
 * 計画(何も書かない)
 * @returns {{ moves: { from: string, to: string, text: string }[], writes: Record<string, string>, stops: string[] }}
 */
export function planFirestore(root) {
  const moves = [];
  const writes = {};
  const stops = [];
  const declarations = readDomains(nodeDomainSource(root)).filter((declaration) => declaration.domain !== null);
  const listed = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z", "--", ...READER_ROOTS], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\0");
  const readers = listed.filter((rel) => rel && CODE_FILE.test(rel) && fs.existsSync(path.join(root, rel)));
  for (const declaration of declarations) {
    const firestore = declaration.registrations.filter((registration) => registration.entity?.dbEngine === "Firestore");
    if (firestore.length === 0) continue;
    const entitiesDir = `${declaration.dir}/entities`;
    const handFiles = FIRESTORE_KINDS.filter((kind) => {
      const file = path.join(root, entitiesDir, `${kind}.ts`);
      return fs.existsSync(file) && !COLLECTOR_HEAD.test(fs.readFileSync(file, "utf8").slice(0, 300));
    });
    if (handFiles.length === 0) continue;
    if (firestore.length > 1) {
      stops.push(`${entitiesDir}: Firestore の登録が ${firestore.length} つ(${firestore.map((r) => r.name).join(", ")})あり、直下の ${handFiles.map((k) => `${k}.ts`).join(", ")} がどの登録の物か決められない(登録のフォルダへ手で分けてから)`);
      continue;
    }
    const registration = firestore[0].name;
    for (const kind of handFiles) {
      const from = `${entitiesDir}/${kind}.ts`;
      const to = `${entitiesDir}/${registration}/${kind}.ts`;
      let text = moveIntoRegistration(fs.readFileSync(path.join(root, from), "utf8"), { domainRel: declaration.dir, registration, kind, siblings: FIRESTORE_KINDS });
      if (kind === "firestore") text = renameExport(text, registration);
      if (fs.existsSync(path.join(root, to)) && fs.readFileSync(path.join(root, to), "utf8") !== text) {
        stops.push(`${from} → ${to}: 移す先に違う中身のファイルがある`);
        continue;
      }
      moves.push({ from, to, text });
    }
    if (!handFiles.includes("firestore")) continue;
    const modules = new Set([`${entitiesDir}/firestore`, entitiesDir]);
    const moved = new Set(moves.map((move) => move.from));
    for (const rel of readers) {
      if (moved.has(rel) || rel === `${entitiesDir}/index.ts`) continue;
      const before = writes[rel] ?? fs.readFileSync(path.join(root, rel), "utf8");
      if (!before.includes(OLD_NAME)) continue;
      const { text, stop } = rewriteReader(root, rel, before, modules, `${registration}CollectionPath`);
      if (stop) stops.push(stop);
      else if (text !== before) writes[rel] = text;
    }
  }
  return { moves, writes, stops };
}

/** 計画を書く(止める物があれば何も書かない) */
export function applyFirestore(root, plan) {
  if (plan.stops.length > 0) throw new Error(`止める物があるので何も書きません:\n${plan.stops.map((s) => `  - ${s}`).join("\n")}`);
  for (const [rel, text] of Object.entries(plan.writes)) fs.writeFileSync(path.join(root, rel), text);
  for (const move of plan.moves) {
    fs.mkdirSync(path.dirname(path.join(root, move.to)), { recursive: true });
    fs.writeFileSync(path.join(root, move.to), move.text);
    fs.rmSync(path.join(root, move.from));
  }
}

function main() {
  const root = process.cwd();
  const plan = planFirestore(root);
  console.log(`移す: ${plan.moves.length} ファイル`);
  for (const move of plan.moves) console.log(`  ${move.from} → ${move.to}`);
  console.log(`読み手の書き換え(${OLD_NAME} → <登録名>CollectionPath): ${Object.keys(plan.writes).length} ファイル`);
  for (const rel of Object.keys(plan.writes)) console.log(`  ${rel}`);
  if (plan.stops.length > 0) {
    console.log(`止める: ${plan.stops.length}`);
    for (const stop of plan.stops) console.log(`  - ${stop}`);
    process.exitCode = 1;
    return;
  }
  if (!process.argv.includes("--write")) {
    console.log("計画だけ(何も書いていません)。--write で書きます。続けて pnpm generate registry と pnpm forge");
    return;
  }
  applyFirestore(root, plan);
  console.log("書きました。続けて pnpm generate registry(集める入口)と pnpm forge");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
