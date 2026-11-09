// scripts/structure/extensions/derive/gateDependsOn.mjs
// 機能を閉じる規則の dependsOn: [機能の名前](機能どうしの依存、全部 AND。D24・D34)と anyOf: [機能の名前](どれか 1 つ、OR。D36)を字面で読み、
// 生成一覧の項目に写す(derive featureTables の一部)。輪は dependsOn と anyOf を合わせた依存で見る。
// 止める物: 文字列リテラルの配列でない書き方・自分・重複(規則ごと、readDependsOn)/ 未知の名前・輪(推移的、全規則で checkDependsOnGraph)。
// 規則のファイルは import しない(表定義を proxy の束に載せないのと同じく、字面だけ)。評価は src/featureGate/ruleList.ts の 1 か所

const fieldPattern = (field) => new RegExp(`(?:^|[{,\\s])${field}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
const keyPattern = (field) => new RegExp(`(?:^|[{,\\s])${field}\\s*:`);
const NAME_LITERAL = /^["']([A-Za-z][A-Za-z0-9]*)["']$/;

/** コメントを外す(字面の読みがコメントの中の例に当たらないように) */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

/**
 * 規則ファイルの dependsOn: [...] を字面で読む(文字列リテラルの配列だけ)。自分・重複も止める
 * @param {string} text 規則ファイルの本文
 * @param {string} name 規則の名前(ファイル名)
 * @returns {{ dependsOn: string[] } | { problem: string }}
 */
export function readDependsOn(text, name) {
  const read = readNameList(text, name, "dependsOn");
  return "problem" in read ? read : { dependsOn: read.names };
}

/**
 * 規則ファイルの anyOf: [...] を字面で読む(dependsOn と同じ書き方と止め方)。dependsOn と同じ名前を両方に書くのも止める
 * @returns {{ anyOf: string[] } | { problem: string }}
 */
export function readAnyOf(text, name) {
  const read = readNameList(text, name, "anyOf");
  if ("problem" in read) return read;
  const depends = readNameList(text, name, "dependsOn");
  const both = "names" in depends ? read.names.filter((n) => depends.names.includes(n)) : [];
  if (both.length > 0) return { problem: `"${both[0]}" を dependsOn と anyOf の両方に書いている(全部要るなら dependsOn だけ)` };
  return { anyOf: read.names };
}

/** 機能の名前の並びの欄を字面で読む */
function readNameList(text, name, field) {
  const body = stripComments(text);
  const match = fieldPattern(field).exec(body);
  if (!match) return keyPattern(field).test(body) ? { problem: `${field} が文字列リテラルの配列でない(機能の名前を [\"wallet\"] の形で直接書く)` } : { names: [] };
  const names = [];
  for (const part of match[1].split(",").map((p) => p.trim()).filter(Boolean)) {
    const literal = NAME_LITERAL.exec(part);
    if (!literal) return { problem: `${field} の要素 ${part} が機能の名前の文字列リテラルでない(規則のファイル名を "wallet" の形で直接書く)` };
    if (literal[1] === name) return { problem: `${field} に自分 "${name}" を書いている` };
    if (names.includes(literal[1])) return { problem: `${field} の "${literal[1]}" が重複している` };
    names.push(literal[1]);
  }
  return { names };
}

/**
 * 全規則の dependsOn の検査: 未知の名前(規則のファイルが無い)と輪(推移的)。輪は 1 つにつき 1 回、名前の順で最初の規則から辿った形で出す
 * @param {{ path: string, name: string, dependsOn: string[], anyOf?: string[] }[]} items
 * @returns {string[]} problems
 */
export function checkDependsOnGraph(items) {
  const problems = [];
  const byName = new Map(items.map((item) => [item.name, item]));
  for (const item of items) {
    for (const dep of item.dependsOn) {
      if (!byName.has(dep)) problems.push(`${item.path}: dependsOn の "${dep}" は無い機能(src/featureGate/rules/${dep}.ts が無い)`);
    }
    for (const dep of item.anyOf ?? []) {
      if (!byName.has(dep)) problems.push(`${item.path}: anyOf の "${dep}" は無い機能(src/featureGate/rules/${dep}.ts が無い)`);
    }
  }
  const state = new Map(); // name → "visiting" | "done"
  const seenCycles = new Set();
  const visit = (name, trail) => {
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") {
      const cycle = [...trail.slice(trail.indexOf(name)), name];
      const key = [...new Set(cycle)].sort().join(",");
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        problems.push(`${byName.get(name).path}: dependsOn${byName.get(name).anyOf?.length ? "・anyOf" : ""} が輪になっている(${cycle.join(" → ")})`);
      }
      return;
    }
    state.set(name, "visiting");
    for (const dep of [...byName.get(name).dependsOn, ...(byName.get(name).anyOf ?? [])]) if (byName.has(dep)) visit(dep, [...trail, name]);
    state.set(name, "done");
  };
  for (const item of items) visit(item.name, []);
  return problems;
}
