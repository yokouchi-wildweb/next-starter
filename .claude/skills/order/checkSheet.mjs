// ブラウザ確認のシート（<指令>.check.md）の読み書き。mailbox.mjs の `check` サブコマンドと /browser-check が使う
// 書式（機械向け。人が読むのは title: と /browser-check の報告だけ）:
//   # CHECK SHEET order:<指令 id | ->  repo:<fork-id | ->
//   title: <日本語の短い題 | ->
//   created: <ISO8601>  updated: <ISO8601>
//   base: <項目を書いたときの commit | ->
//   last_run: <ISO8601 | ->  runs: <n>
//
//   ## C<n>                 1 項目 = 1 つの期待
//   source: <出どころ>       （同じ項目が別の出どころからも来れば行が増える）
//   page: /<パス>
//   as: guest | user | admin
//   needs: <前提のデータ・機能の切り替え | ->
//   steps:
//     1. <手順>
//   expect: <期待すること>
//   widths: 375,1280
//   result: - | ok | ng | skip   （最後に回したときの結果）
//   evidence: <見たもの。ng はスクリーンショットのパスも | ->
//   ran_at: <ISO8601 | ->
//   was: <写し元の項目と前の結果>   （ng の項目だけを直しの指令へ写したときだけ）
// ng のスクリーンショットはシートの隣の <シートの名前から .md を除いたもの>/（例 x.check/）に置く
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export const AS = ["guest", "user", "admin"];
export const RESULTS = ["ok", "ng", "skip"];
export const DEFAULT_WIDTHS = "375,1280";
const ITEM_KEYS = ["source", "page", "as", "needs", "steps", "expect", "widths", "result", "evidence", "ran_at", "was"];

export function isSheetFile(name) {
  return name.endsWith(".check.md");
}

// 指令ファイルのパス → 隣のシートのパス（<名前>.md → <名前>.check.md）
export function sheetPathFor(orderPath) {
  return orderPath.replace(/\.md$/, ".check.md");
}

// シートのパス → スクリーンショットの置き場（<名前>.check.md → <名前>.check/）
export function shotsDirOf(sheetPath) {
  return sheetPath.replace(/\.md$/, "");
}

export function newSheet({ now, title = "-", base = "-", order = "-", repo = "-" }) {
  return { head: { order, repo, title, created: now, updated: now, base, lastRun: "-", runs: 0 }, items: [] };
}

export function parseSheet(text) {
  const [headText, ...blocks] = text.split(/^(?=## C\d+\s*$)/m);
  const first = headText.match(/^# CHECK SHEET order:(\S+)\s+repo:(\S+)/m);
  if (!first) throw new Error("シートの 1 行目が `# CHECK SHEET order:<id> repo:<fork-id>` ではありません");
  const val = (re, d = "-") => (headText.match(re) || [])[1] ?? d;
  const head = {
    order: first[1],
    repo: first[2],
    title: val(/^title:[ \t]*(.*)$/m).trim() || "-",
    created: val(/^created:[ \t]*(\S+)/m),
    updated: val(/updated:[ \t]*(\S+)/m),
    base: val(/^base:[ \t]*(\S+)/m),
    lastRun: val(/^last_run:[ \t]*(\S+)/m),
    runs: Number(val(/runs:[ \t]*(\d+)/m, "0")),
  };
  const items = blocks.map((b) => {
    const lines = b.split("\n");
    const item = { id: lines[0].replace(/^## /, "").trim(), source: [], steps: [] };
    let inSteps = false;
    for (const l of lines.slice(1)) {
      if (inSteps && /^\s+\S/.test(l)) {
        item.steps.push(l.trim().replace(/^\d+\.\s*/, ""));
        continue;
      }
      inSteps = false;
      const m = l.match(/^([a-z_]+):[ \t]*(.*)$/);
      if (!m) continue;
      if (m[1] === "steps") inSteps = true;
      else if (m[1] === "source") item.source.push(m[2].trim());
      else item[m[1]] = m[2].trim();
    }
    return item;
  });
  return { head, items };
}

export function renderSheet({ head, items }) {
  const out = [
    `# CHECK SHEET order:${head.order}  repo:${head.repo}`,
    `title: ${head.title || "-"}`,
    `created: ${head.created}  updated: ${head.updated}`,
    `base: ${head.base || "-"}`,
    `last_run: ${head.lastRun || "-"}  runs: ${head.runs || 0}`,
  ];
  for (const it of items) {
    out.push("", `## ${it.id}`);
    for (const k of ITEM_KEYS) {
      if (k === "source") for (const s of it.source.length ? it.source : ["-"]) out.push(`source: ${s}`);
      else if (k === "steps") out.push("steps:", ...it.steps.map((s, i) => `  ${i + 1}. ${s}`));
      else if (k === "was") {
        if (it.was) out.push(`was: ${it.was}`);
      } else out.push(`${k}: ${it[k] || "-"}`);
    }
  }
  return `${out.join("\n")}\n`;
}

export function readSheet(path) {
  if (!existsSync(path)) throw new Error(`シートがありません: ${path}`);
  return parseSheet(readFileSync(path, "utf8"));
}

export function writeSheet(path, sheet) {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, renderSheet(sheet));
  renameSync(tmp, path);
}

function nextId(items) {
  return `C${items.reduce((n, it) => Math.max(n, Number(it.id.slice(1)) || 0), 0) + 1}`;
}

// 項目の形を確かめる（足りなければ throw）
export function checkItem({ page, as, steps, expect, widths }) {
  const bad = [];
  if (!page || !page.startsWith("/")) bad.push("--page=/<パス>");
  if (!AS.includes(as)) bad.push(`--as=${AS.join("|")}`);
  if (!steps || !steps.length) bad.push("--step=<手順>（1 つ以上）");
  if (!expect) bad.push("--expect=<期待すること>");
  if (widths && !/^\d+(,\d+)*$/.test(widths)) bad.push("--widths=375,1280 の形");
  if (bad.length) throw new Error(`項目に要るもの: ${bad.join(" ")}`);
}

// 項目を足す（シートが無ければ作る）。同じ page・as・expect の項目は 1 つにまとめ、source: を足す。戻り値 { id, merged }
export function addItem(path, { page, as, steps, expect, needs = "-", widths = DEFAULT_WIDTHS, source = "-" }, { now, title, base } = {}) {
  checkItem({ page, as, steps, expect, widths });
  const sheet = existsSync(path) ? readSheet(path) : newSheet({ now, title, base });
  if (title && sheet.head.title === "-") sheet.head.title = title;
  sheet.head.updated = now;
  const same = sheet.items.find((it) => it.page === page && it.as === as && it.expect === expect);
  if (same) {
    if (source !== "-" && !same.source.includes(source)) same.source = [...same.source.filter((s) => s !== "-"), source];
    writeSheet(path, sheet);
    return { id: same.id, merged: true };
  }
  const id = nextId(sheet.items);
  sheet.items.push({ id, source: [source], page, as, needs: needs || "-", steps, expect, widths: widths || DEFAULT_WIDTHS, result: "-", evidence: "-", ran_at: "-" });
  writeSheet(path, sheet);
  return { id, merged: false };
}

// 1 回の確認の始まり: runs を 1 つ増やし last_run を今に
export function startRun(path, { now }) {
  const sheet = readSheet(path);
  sheet.head.runs += 1;
  sheet.head.lastRun = now;
  sheet.head.updated = now;
  writeSheet(path, sheet);
  return sheet.head.runs;
}

// 項目の結果を書き戻す。ng / skip は evidence が要る
export function setResult(path, id, { result, evidence, now }) {
  if (!RESULTS.includes(result)) throw new Error(`結果は ${RESULTS.join(" | ")} のどれか（${result || "なし"}）`);
  if (result !== "ok" && !evidence) throw new Error(`${result} は --evidence=<見たもの・理由> が要ります`);
  const sheet = readSheet(path);
  const it = sheet.items.find((x) => x.id === id);
  if (!it) throw new Error(`項目がありません: ${id}（${sheet.items.map((x) => x.id).join(" ") || "項目なし"}）`);
  it.result = result;
  it.evidence = evidence || "-";
  it.ran_at = now;
  sheet.head.updated = now;
  writeSheet(path, sheet);
}

export function summarize(sheet) {
  const n = { total: sheet.items.length, ok: 0, ng: 0, skip: 0, pending: 0 };
  for (const it of sheet.items) n[RESULTS.includes(it.result) ? it.result : "pending"] += 1;
  return n;
}

// 写しのシート: only（項目 id の一覧）があればその項目だけを C1.. に振り直し、結果を消して was: に前の結果を残す（直しの指令に付ける回し直し用）
export function copySheet(src, { only, now, order, repo, title }) {
  let items = src.items.map((it) => ({ ...it, source: [...it.source], steps: [...it.steps] }));
  if (only && only.length) {
    const missing = only.filter((id) => !items.some((it) => it.id === id));
    if (missing.length) throw new Error(`写す項目がありません: ${missing.join(" ")}`);
    items = only.map((id, i) => {
      const it = items.find((x) => x.id === id);
      return { ...it, id: `C${i + 1}`, was: `${id} ${it.result} — ${it.evidence}`, result: "-", evidence: "-", ran_at: "-" };
    });
  }
  const head = { ...src.head, order, repo, title: title || src.head.title, created: now, updated: now, lastRun: "-", runs: 0 };
  return { head, items };
}
