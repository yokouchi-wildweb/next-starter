#!/usr/bin/env node
// scripts/codemods/admin-header.mjs
// 管理のヘッダーの差し込みを AdminPage の props へ移す(共有の棚の計画書 03・指令 20、D134・D135・D127・D171)。fork のリポのルートで走らせる。
// 使い方: node scripts/codemods/admin-header.mjs [--apply] [--base <rev>] [--upstream <rev>] [--json]
//   既定は dry-run(変更の一覧と止める一覧を出すだけ)。--apply で書き換える。何度走らせても同じ結果。手順: ./README.md「管理ヘッダーへ移す」
//
// 触るのは fork が足したファイルだけ = 上流のどちらの版にも無いファイル(上流のファイルは取り込みで移る):
// - 台帳の最後の upstream:<sha>(--base)の版と、取り込んだ上流の版(--upstream。既定 = HEAD と upstream/main の merge-base = 取り込んだ最後の上流の commit)
// - 台帳だけで決めると、台帳の版の後に上流が足したファイル(帯の区切りの AdminHeader.tsx など)を fork の物と取り違える
// 区切り(checkpoint)は取り込んだ後のツリーで決める(台帳では決めない):
// - band: AdminPage の title がある(_layout/AdminPageTitle.tsx)+ 差し込みの互換が残っている(AdminHeaderPortal.tsx)。止めた物は portal の区切りまでに直す
//   (ItemNavigator の消えた props は帯で消えたので due: now)
// - portal: 差し込みの互換が消えた。止めた物は今直す(直すまで型の検査が落ちる)
// - AdminPage の title が無い = まだ帯の版を取り込んでいない → exit 2
// 機械で書き換える物(どちらの区切りでも):
// - AdminPage の最初の子(か、最初の子の <Stack> の最初の子)の <PageTitle>(placement 無し / "header"、ほかの props 無し、子は文字か {式} 1 つ)
//   → <AdminPage title="…">、PageTitle を消し、使われなくなった import を消す
// - AdminPage の直接の子の <CouponSectionTabs placement="header" />(ほかの props 無し、AdminPage に center が無い)→ center={<CouponSectionTabs variant="header" />}
// ほかは止める(書き換えず、種類と移し先を一覧に出す。種類は STOP_KINDS の閉じた一覧)。この道具はほかの道具を呼ばない
// (useRouter の import 元は guarded-router.mjs、枠の宣言は frame-declarations.mjs の持ち分。順番は README)。

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { checkAdminPageScreen } from "../../src/lib/screens/checks.mjs";
import { readBaseFiles } from "./fork-name-markers.mjs";

/** 止める種類(閉じた一覧)→ 移し先 */
export const STOP_KINDS = Object.freeze({
  "portal-title": "<AdminPage title=\"…\">(題は位置を選ばず AdminPage が描く)",
  "portal-center": "<AdminPage center={…}>(src/features の部品の中から差していたら、その部分を部品の外へ出して route の Screen が center に渡す)",
  "portal-right": "<AdminPage actions={…}>(src/features の部品の中から差していたら、その部分を部品の外へ出して route の Screen が actions に渡す)",
  "page-title-in-body": "<AdminPage title=\"…\">(ページの題)か、本文の見出しなら SecTitle などの見出しの部品",
  "coupon-tabs-placement": "<AdminPage center={<CouponSectionTabs variant=\"header\" />}>",
  "item-navigator": "<AdminPage actions={<AdminEditItemNavigator domain={domainDisplay} current={record} />}>、または ItemNavigator + useDomainItemNavigation(src/lib/crud)。移るだけ(保存・検証は移る前にしない)。domain.json の generate が true のドメインは pnpm dc:generate <Domain> が Edit*Form と編集の Screen を作り直す(手で直さない)",
  "admin-layout-header-prop": "src/app/admin/_layout/AdminHeader.replace.tsx(名前 AdminHeader・props { title, center, actions, className })+ AdminHeader.tsx の 1 行をそちらへ向ける",
  "slot-id-css": "[data-slot=\"admin-header-title\"] / [data-slot=\"admin-header-center\"] / [data-slot=\"admin-header-right\"](受け口の id は消えた)",
  "own-unsaved-guard": "@/lib/unsavedGuard(useUnsavedGuard(isDirty)・AppForm は既定で守る)。自前の beforeunload・popstate の処理と確認の部品を外す",
  "page-without-admin-page": "<AdminPage title=\"…\"> で包む。子の部品(src/features・_components)の中で AdminPage を描いていたら、AdminPage を Screen へ上げて部品はその中に置く。転送だけの Screen(loader が redirect する)は return <AdminPage title=\"…\" />(上流の settings の入口と同じ)。ヘッダーを出さないページは隣の frame.ts に { page: { hide: { header: { sp: true, pc: true } } } }",
});

/** 機械で書き換えた物の種類 */
export const CHANGE_KINDS = Object.freeze({ title: "PageTitle → AdminPage title", "coupon-tabs-center": "CouponSectionTabs placement=\"header\" → AdminPage center" });

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage"]);
const ADMIN_PAGE_TITLE_FILE = "src/app/admin/_layout/AdminPageTitle.tsx";
const PORTAL_FILE = "src/components/AppFrames/Admin/Elements/AdminHeaderPortal.tsx";
const GUARD_LIB = "@/lib/unsavedGuard";
/** 守りの lib の中(lib 自身の beforeunload・useUnsavedGuard は自前の守りではない) */
const GUARD_LIB_DIR = "src/lib/unsavedGuard/";

const MODULES = {
  adminPage: /(?:^|\/)_layout\/AdminPage$/,
  pageTitle: /(?:^|\/)_layout\/PageTitle$|AppFrames\/Admin\/Elements\/PageTitle$/,
  couponTabs: /(?:^|\/)CouponSectionTabs$/,
  portal: /(?:^|\/)AdminHeaderPortal$/,
  itemNavigator: /(?:^|\/)ItemNavigator(?:\/index)?$|AppFrames\/Admin\/Elements$/,
  adminLayout: /(?:^|\/)_layout\/AdminLayout$/,
  headerSlots: /(?:^|\/)_layout\/(?:HeaderSlots|Header|AdminHeaderContext)$/,
};
const NAMES = { adminPage: "AdminPage", pageTitle: "PageTitle", couponTabs: "CouponSectionTabs", portal: "AdminHeaderPortal", itemNavigator: "ItemNavigator", adminLayout: "AdminLayout" };
const ADMIN_SCREEN = /^src\/app\/admin\/.*\/(?:_screen|_components)\/(?:.*\/)?[A-Za-z0-9]+Screen\.tsx$/;
const SLOT_ID = /admin-header-(?:title|center|right)-slot|ADMIN_HEADER_(?:TITLE|CENTER|RIGHT)_SLOT_ID/;
const BEFORE_UNLOAD = /["'`]beforeunload["'`]|\bonbeforeunload\b/;
const OWN_GUARD_NAME = /\b(use\w*Unsaved\w*Guard)\b/;

/** 既定の取り込んだ上流の版の手がかり(リモートの追跡ブランチ) */
const UPSTREAM_REFS = ["refs/remotes/upstream/main", "refs/remotes/upstream/HEAD"];

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).trim();

/**
 * 取り込んだ上流の版のファイル。{ rev, files } / { rev: null, files: [], note } / { problem }
 * rev を渡せばその版、無ければ HEAD と upstream の追跡ブランチの merge-base(= 取り込んだ最後の上流の commit)
 */
export function readUpstreamFiles(root, rev) {
  let target = rev;
  if (!target) {
    for (const ref of UPSTREAM_REFS) {
      try {
        git(root, ["rev-parse", "--verify", "--quiet", ref]);
        target = git(root, ["merge-base", "HEAD", ref]);
        break;
      } catch {
        // 次の手がかり
      }
    }
    if (!target) return { rev: null, files: [], note: "取り込んだ上流の版が分からない(upstream/main が無い)。台帳の版だけで fork のファイルを決めた: 台帳の後に上流が足したファイルを fork の物と取り違えることがある(--upstream <取り込んだ上流の rev> を渡す)" };
  }
  try {
    return { rev: target, files: git(root, ["ls-tree", "-r", "--name-only", target]).split("\n").filter(Boolean) };
  } catch {
    return { problem: `取り込んだ上流の版 ${target} を読めない(git の履歴に無い)` };
  }
}

/** 区切りを取り込んだ後のツリーで決める。{ checkpoint: "band" | "portal" } か { problem } */
export function detectCheckpoint(root) {
  if (!existsSync(join(root, ADMIN_PAGE_TITLE_FILE))) {
    return { problem: `AdminPage の title がまだ無い(${ADMIN_PAGE_TITLE_FILE} が無い = 帯の版を取り込んでいない)。上流の帯の版を /flux で取り込んでから走らせる` };
  }
  return { checkpoint: existsSync(join(root, PORTAL_FILE)) ? "band" : "portal" };
}

function listFiles(root) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.push(path);
    }
  };
  walk("src");
  return out.sort();
}

const isTest = (path) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /\.d\.ts$/.test(path);
const isScript = (path) => /\.[cm]?[jt]sx?$/.test(path);
const isStyle = (path) => /\.(css|scss|sass|less)$/.test(path);

/** import の名前(ローカル名)を種類ごとに集める */
function importsOf(source) {
  const locals = Object.fromEntries(Object.keys(MODULES).map((k) => [k, new Set()]));
  const decls = [];
  const useItemNavigator = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const spec = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    for (const [kind, re] of Object.entries(MODULES)) {
      if (!re.test(spec)) continue;
      decls.push({ kind, statement, spec });
      if (!clause || clause.isTypeOnly) continue;
      if (clause.name && NAMES[kind]) locals[kind].add(clause.name.text);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          if (el.isTypeOnly) continue;
          const imported = (el.propertyName ?? el.name).text;
          if (imported === NAMES[kind] || (kind === "pageTitle" && imported === "default")) locals[kind].add(el.name.text);
          if (kind === "itemNavigator" && imported === "useItemNavigator") useItemNavigator.add(el.name.text);
        }
      }
    }
  }
  return { locals, decls, useItemNavigator };
}

const tagName = (node) => (ts.isJsxElement(node) ? node.openingElement.tagName : ts.isJsxSelfClosingElement(node) ? node.tagName : null)?.getText() ?? null;
const attributesOf = (node) => (ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes).properties;
const attrName = (attr) => (ts.isJsxAttribute(attr) ? attr.name.getText() : null);
/** 属性の文字の値("x" / {"x"})。無ければ undefined、式なら null */
function attrString(attr) {
  if (!attr.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isStringLiteralLike(attr.initializer.expression)) return attr.initializer.expression.text;
  return null;
}
const findAttr = (node, name) => attributesOf(node).find((a) => attrName(a) === name);
const meaningfulChildren = (node) => (ts.isJsxElement(node) ? node.children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces)) : []);

/** 行ごと消す範囲(行にその要素しか無ければ行と改行を、そうでなければ要素だけ) */
function removalRange(text, node, source) {
  const start = node.getStart(source);
  const end = node.getEnd();
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const newline = text.indexOf("\n", end);
  const lineEnd = newline === -1 ? text.length : newline;
  if (text.slice(lineStart, start).trim() === "" && text.slice(end, lineEnd).trim() === "") return [lineStart, newline === -1 ? text.length : newline + 1];
  return [start, end];
}

/** PageTitle の子から題の属性を作る。作れなければ null */
function titleAttribute(pageTitle) {
  const children = meaningfulChildren(pageTitle);
  if (children.length !== 1) return null;
  const [child] = children;
  if (ts.isJsxText(child)) {
    const value = child.getText().replace(/\s+/g, " ").trim();
    if (!value) return null;
    return value.includes('"') ? `title={${JSON.stringify(value)}}` : `title="${value}"`;
  }
  if (ts.isJsxExpression(child) && child.expression) return `title={${child.expression.getText()}}`;
  return null;
}

/**
 * 1 ファイル(.ts / .tsx)の書き換えと止める物
 * @param {string} path リポジトリ直下からの相対
 * @param {string} text
 * @returns {{ text: string | null, changes: { line: number, kind: string, detail: string }[], stops: { line: number, kind: string, detail: string }[] }}
 */
export function rewriteAdminHeader(path, text) {
  const kind = path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const { locals, decls, useItemNavigator } = importsOf(source);
  const changes = [];
  const stops = [];
  const ranges = [];
  const inserts = [];
  const consumed = new Set();
  const underFeatures = path.startsWith("src/features/");

  const visitAdminPage = (page) => {
    if (!ts.isJsxElement(page)) return;
    const added = [];
    const children = meaningfulChildren(page);
    // 題: 最初の子か、最初の子の <Stack> の最初の子
    let candidate = children[0];
    if (candidate && tagName(candidate) === "Stack") candidate = meaningfulChildren(candidate)[0];
    if (candidate && locals.pageTitle.has(tagName(candidate))) {
      const attrs = attributesOf(candidate);
      const placement = findAttr(candidate, "placement");
      const placementValue = placement ? attrString(placement) : "header";
      const others = attrs.filter((a) => attrName(a) !== "placement");
      const title = titleAttribute(candidate);
      if (placementValue === "header" && others.length === 0 && title && !findAttr(page, "title")) {
        added.push(title);
        ranges.push(removalRange(text, candidate, source));
        consumed.add(candidate);
        changes.push({ line: lineOf(candidate), kind: "title", detail: `<${tagName(candidate)}> → <AdminPage ${title}>` });
      }
    }
    // クーポンのタブ: 直接の子の自己閉じ、placement="header" だけ、center が無い
    const tabs = children.find((c) => ts.isJsxSelfClosingElement(c) && locals.couponTabs.has(tagName(c)) && findAttr(c, "placement"));
    if (tabs) {
      const attrs = attributesOf(tabs);
      if (attrs.length === 1 && attrString(findAttr(tabs, "placement")) === "header" && !findAttr(page, "center")) {
        const center = `center={<${tagName(tabs)} variant="header" />}`;
        added.push(center);
        ranges.push(removalRange(text, tabs, source));
        consumed.add(tabs);
        changes.push({ line: lineOf(tabs), kind: "coupon-tabs-center", detail: `<${tagName(tabs)} placement="header" /> → <AdminPage ${center}>` });
      }
    }
    if (added.length > 0) inserts.push([page.openingElement.tagName.getEnd(), ` ${added.join(" ")}`]);
  };

  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      if (locals.adminPage.has(tag)) visitAdminPage(node);
      if (locals.pageTitle.has(tag) && !consumed.has(node)) {
        const placement = findAttr(node, "placement");
        stops.push({ line: lineOf(node), kind: "page-title-in-body", detail: placement && attrString(placement) === "page" ? `<${tag} placement="page">` : `<${tag}> が AdminPage の最初の子でない・AdminPage に title がある・props か子が機械で移せない` });
      }
      if (locals.couponTabs.has(tag) && !consumed.has(node) && findAttr(node, "placement")) {
        stops.push({ line: lineOf(node), kind: "coupon-tabs-placement", detail: `<${tag} placement> が AdminPage の直接の子でない・ほかの props がある・AdminPage に center がある` });
      }
      if (locals.portal.has(tag)) {
        const slot = findAttr(node, "slot");
        const value = slot ? attrString(slot) : null;
        const stopKind = value === "title" ? "portal-title" : value === "right" ? "portal-right" : "portal-center";
        stops.push({ line: lineOf(node), kind: stopKind, detail: `<${tag} slot=${value === null ? "{…}" : `"${value}"`}>${underFeatures ? "(src/features の部品の中: 部分を外へ出して route の Screen が組む)" : ""}` });
      }
      if (locals.itemNavigator.has(tag)) {
        const old = attributesOf(node).map(attrName).filter((n) => n === "usePortal" || n === "slot" || n === "onBeforeNavigate");
        // ItemNavigator の props は帯の区切り(指令 16)で消えた: どちらの区切りでも今直す(型の検査が落ちる)
        if (old.length > 0) stops.push({ line: lineOf(node), kind: "item-navigator", detail: `<${tag}> の消えた props: ${old.join(", ")}`, now: true });
      }
      if (locals.adminLayout.has(tag) && findAttr(node, "header")) stops.push({ line: lineOf(node), kind: "admin-layout-header-prop", detail: `<${tag} header={…}>` });
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && useItemNavigator.has(node.expression.text)) {
      stops.push({ line: lineOf(node), kind: "item-navigator", detail: `${node.expression.text}(…)(消えた互換)` });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const d of decls.filter((d) => d.kind === "headerSlots")) stops.push({ line: lineOf(d.statement), kind: "admin-layout-header-prop", detail: `import "${d.spec}"(消えた受け口・ヘッダーの部品)` });

  if (ranges.length === 0) return { text: null, changes, stops };
  // 後ろから当てる(挿入と削除は重ならない: 挿入は開きタグの名前の直後、削除は子)
  let out = text;
  const ops = [...ranges.map(([s, e]) => ({ at: s, end: e, insert: "" })), ...inserts.map(([at, insert]) => ({ at, end: at, insert }))];
  for (const op of ops.sort((a, b) => b.at - a.at)) out = out.slice(0, op.at) + op.insert + out.slice(op.end);
  return { text: dropUnusedPageTitleImport(path, out), changes, stops };
}

/** 使われなくなった PageTitle の import を消す */
function dropUnusedPageTitleImport(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const { locals, decls } = importsOf(source);
  const used = (name) => new RegExp(`<${name}[\\s>/]|\\b${name}\\b(?!\\s*from)`).test(text.slice(source.statements.filter(ts.isImportDeclaration).at(-1)?.getEnd() ?? 0));
  let out = text;
  for (const d of decls.filter((d) => d.kind === "pageTitle").sort((a, b) => b.statement.getStart(source) - a.statement.getStart(source))) {
    const names = [...locals.pageTitle];
    if (names.some(used)) continue;
    const clause = d.statement.importClause;
    const onlyTitle = clause && !(clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some((el) => !locals.pageTitle.has(el.name.text)));
    if (!onlyTitle) continue;
    const [s, e] = removalRange(out, d.statement, source);
    out = out.slice(0, s) + out.slice(e);
  }
  return out;
}

/** 文字で見つける止める物(CSS・スクリプトの受け口の id、自前の未保存の守り)。行ごと */
export function scanText(path, text) {
  const stops = [];
  const lines = text.split("\n");
  const script = isScript(path);
  lines.forEach((line, index) => {
    if (SLOT_ID.test(line)) stops.push({ line: index + 1, kind: "slot-id-css", detail: line.trim().slice(0, 160) });
    if (!script) return;
    if (BEFORE_UNLOAD.test(line) && /addEventListener|onbeforeunload/.test(line)) {
      stops.push({ line: index + 1, kind: "own-unsaved-guard", detail: line.trim().slice(0, 160) });
      return;
    }
    // 自前の守りの定義(function / const useXxxUnsavedXxxGuard)か、守りの lib 以外からの import
    const defined = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*|const\s+|let\s+)(use\w*Unsaved\w*Guard)\b/.exec(line);
    const imported = /^\s*import\s/.test(line) && !line.includes(GUARD_LIB) ? OWN_GUARD_NAME.exec(line) : null;
    const name = defined?.[1] ?? imported?.[1];
    if (name) stops.push({ line: index + 1, kind: "own-unsaved-guard", detail: `${name}(自前の守り)` });
  });
  return stops;
}

/**
 * 移行の計画
 * @param {string} root fork のリポのルート
 * @param {{ baseFiles: string[], checkpoint: "band" | "portal" }} options
 */
export function planAdminHeader(root, { baseFiles, checkpoint }) {
  const base = new Set(baseFiles);
  const due = checkpoint === "band" ? "portal" : "now";
  const changes = [];
  const stops = [];
  const writes = [];
  for (const path of listFiles(root)) {
    if (base.has(path) || isTest(path) || path.startsWith(GUARD_LIB_DIR) || !(isScript(path) || isStyle(path))) continue;
    const text = readFileSync(join(root, path), "utf8");
    const found = [];
    let after = text;
    if (/\.[cm]?[jt]sx?$/.test(path)) {
      const result = rewriteAdminHeader(path, text);
      for (const c of result.changes) changes.push({ path, ...c });
      found.push(...result.stops);
      if (result.text !== null && result.text !== text) {
        writes.push({ path, text: result.text });
        after = result.text;
      }
    }
    found.push(...scanText(path, after));
    if (ADMIN_SCREEN.test(path)) for (const problem of checkAdminPageScreen(after)) found.push({ line: 1, kind: "page-without-admin-page", detail: problem.slice(0, 60) });
    for (const s of found) stops.push({ path, line: s.line, kind: s.kind, target: STOP_KINDS[s.kind], due: s.now ? "now" : due, detail: s.detail });
  }
  stops.sort((a, b) => (a.path === b.path ? a.line - b.line : a.path < b.path ? -1 : 1));
  return { checkpoint, changes, stops, writes };
}

function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const apply = args.includes("--apply");
  const json = args.includes("--json");
  const point = detectCheckpoint(root);
  if (point.problem) {
    console.error(`[admin-header] ${point.problem}`);
    process.exit(2);
  }
  const baseIndex = args.indexOf("--base");
  const base = readBaseFiles(root, baseIndex >= 0 ? args[baseIndex + 1] : null);
  if (base.problem) {
    console.error(`[admin-header] ${base.problem}`);
    process.exit(2);
  }
  const upstreamIndex = args.indexOf("--upstream");
  const upstream = readUpstreamFiles(root, upstreamIndex >= 0 ? args[upstreamIndex + 1] : null);
  if (upstream.problem) {
    console.error(`[admin-header] ${upstream.problem}`);
    process.exit(2);
  }
  const plan = planAdminHeader(root, { baseFiles: [...base.files, ...upstream.files], checkpoint: point.checkpoint });
  if (apply) for (const w of plan.writes) writeFileSync(join(root, w.path), w.text);
  const result = { base: base.rev, upstream: upstream.rev, checkpoint: plan.checkpoint, mode: apply ? "apply" : "dry-run", changes: plan.changes, stops: plan.stops, notes: upstream.note ? [upstream.note] : [] };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`[admin-header] ${result.mode}(台帳の版 ${String(base.rev).slice(0, 10)}、取り込んだ上流の版 ${upstream.rev ? upstream.rev.slice(0, 10) : "不明"}、区切り ${plan.checkpoint})`);
  for (const note of result.notes) console.log(`注意: ${note}`);
  console.log(`機械で書き換える: ${plan.changes.length} か所(${plan.writes.length} ファイル)`);
  for (const c of plan.changes) console.log(`  ${c.path}:${c.line} ${c.detail}`);
  console.log(`止めた物(手で直す、期限 ${plan.checkpoint === "band" ? "portal の区切りまで(due: now の物は今)" : "今"}): ${plan.stops.length} 件`);
  for (const kind of Object.keys(STOP_KINDS)) {
    const rows = plan.stops.filter((s) => s.kind === kind);
    if (rows.length === 0) continue;
    console.log(`  [${kind}] ${rows.length} 件 → ${STOP_KINDS[kind]}`);
    for (const s of rows) console.log(`    ${s.path}:${s.line} ${s.detail}`);
  }
  if (!apply && plan.writes.length > 0) console.log("--apply で書き換える(続けて pnpm typecheck・pnpm lint)");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
