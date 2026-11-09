// src/featureGate/checks/integrity.mjs
// 機能とドメインの組み合わせの検査(D24・D27・D34 K5・設定 D56)。純関数: 呼び手が一覧と地区・外部キーの事実を渡す。
// 実物の検査は scripts/structure/proxies/featureGate.test.mjs(落とす / warn)、共有のドメインの表示は node/describe.ts(pnpm ops features list)。
// - 外部キー(checkForeignKeys): 表 T → U で U のドメインが閉じうるのに T のドメインが開のまま残る組み合わせ(db:push が外す表を残す表が参照して止まる)。
//   規則の中の外部キー(T のドメインを持つ機能がどれも U のドメインも持つ)は一緒に閉じるので対象外。
//   覆う = T のドメインの requires に U のドメインがあり、かつ T のドメインを持つ機能がどれも U のドメインを持つ機能のどれかに(推移的に)依存する。
//   T が基盤(どの機能にも載らない、常に開)なら覆えない
// - 基盤の requires の穴(checkBaseRequires): どの機能にも載らないドメインの requires の先が閉じうるドメイン
// - required/ の実効の閉(checkRequiredClosed): 必須の機能が規則の値(自分の値か依存先)で閉
// - 共有のドメイン(sharedDomainsOpen): 2 つ以上の機能が持つドメインで、持つ機能の一部が閉なのに別の機能で開いたまま(落とさない、list と warn)

/**
 * @typedef {{ name: string, domains?: readonly string[], dependsOn?: readonly string[] }} GateRule
 * 開閉は呼び手が isOpen(name) で渡す(門番の中で規則の enabled を直に呼ぶのは ruleList.ts だけ)
 * @typedef {{ folder: string, name: string, requires: readonly string[], tables: readonly string[] }} DomainFact
 */

const holdersOf = (list, folder) => list.filter((rule) => (rule.domains ?? []).includes(folder));

/** 推移的な依存先(自分を含む) */
function reachOf(list, name) {
  const byName = new Map(list.map((rule) => [rule.name, rule]));
  const seen = new Set();
  const queue = [name];
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(byName.get(current)?.dependsOn ?? []));
  }
  return seen;
}

/**
 * @param {{ list: GateRule[], domains: DomainFact[], foreignKeys: { from: string, to: string }[], exceptions?: Record<string, string> }} input
 *   foreignKeys = 表名 → 参照先の表名、exceptions = "<from>→<to>" → 理由(当たらない行も失敗。両方の表が地区に無い行は数えない)
 * @returns {string[]}
 */
export function checkForeignKeys({ list, domains, foreignKeys, exceptions = {} }) {
  const problems = [];
  const domainOfTable = new Map(domains.flatMap((d) => d.tables.map((table) => [table, d])));
  const folderOfName = new Map(domains.map((d) => [d.name, d.folder]));
  const used = new Set();
  for (const { from, to } of foreignKeys) {
    const d = domainOfTable.get(from);
    const e = domainOfTable.get(to);
    if (!d || !e || d.folder === e.folder) continue;
    const eHolders = holdersOf(list, e.folder);
    if (eHolders.length === 0) continue; // 参照先は基盤(常に開)
    const dHolders = holdersOf(list, d.folder);
    // 規則の中の外部キー(T のドメインを持つ機能がどれも U のドメインも持つ = 一緒に閉じる)は対象外
    if (dHolders.length > 0 && dHolders.every((h) => (h.domains ?? []).includes(e.folder))) continue;
    const key = `${from}→${to}`;
    const reasons = [];
    if (!d.requires.some((name) => (folderOfName.get(name) ?? name) === e.folder)) reasons.push(`${d.folder} の requires に ${e.name} が無い`);
    if (dHolders.length === 0) reasons.push(`${d.folder} はどの機能にも載らない基盤(常に開)`);
    for (const holder of dHolders) {
      const reach = reachOf(list, holder.name);
      if (!eHolders.some((h) => reach.has(h.name))) reasons.push(`機能 ${holder.name} が ${eHolders.map((h) => h.name).join("・")} に dependsOn していない`);
    }
    if (reasons.length === 0) continue;
    if (key in exceptions) {
      used.add(key);
      continue;
    }
    problems.push(`外部キー ${key}(${d.folder} → ${e.folder}): ${reasons.join("、")}。${e.folder} だけが閉じると db:push が止まる(requires と dependsOn の両方で覆う)`);
  }
  for (const key of Object.keys(exceptions)) {
    const [from, to] = key.split("→");
    if (!used.has(key) && domainOfTable.has(from) && domainOfTable.has(to)) problems.push(`外部キーの例外 ${key} はもう当たらない(行を消す)`);
  }
  return problems;
}

/**
 * @param {{ list: GateRule[], domains: DomainFact[] }} input
 * @returns {string[]}
 */
export function checkBaseRequires({ list, domains }) {
  const folderOfName = new Map(domains.map((d) => [d.name, d.folder]));
  const problems = [];
  for (const d of domains) {
    if (holdersOf(list, d.folder).length > 0) continue;
    for (const name of d.requires) {
      const target = folderOfName.get(name) ?? name;
      const holders = holdersOf(list, target);
      if (holders.length === 0) continue;
      problems.push(`${d.folder} はどの機能にも載らない基盤(常に開)なのに、閉じうる ${name}(${target}、機能 ${holders.map((h) => h.name).join("・")})を requires する。${d.folder} をその機能の features に入れる(か requires を見直す)`);
    }
  }
  return problems;
}

/**
 * @param {{ list: GateRule[], required: Record<string, string>, isOpen: (name: string) => boolean }} input isOpen = 規則の値の開閉(configEnabled)
 * @returns {string[]}
 */
export function checkRequiredClosed({ list, required, isOpen }) {
  const problems = [];
  for (const name of Object.keys(required)) {
    const rule = list.find((r) => r.name === name);
    if (!rule || isOpen(name)) continue;
    const closedDeps = [...reachOf(list, name)].filter((n) => n !== name && !isOpen(n));
    problems.push(`必須の機能 ${name}(src/featureGate/required/${name}.ts)が規則の値で閉${closedDeps.length > 0 ? `(閉じた依存先: ${closedDeps.join("・")})` : ""}。必須なら値を開にする(依存先も)`);
  }
  return problems;
}

/**
 * @param {GateRule[]} list
 * @param {readonly string[]} folders 見るドメイン(生成一覧の domains の folder)
 * @param {(name: string) => boolean} isOpen
 * @returns {{ folder: string, closed: string[], open: string[] }[]}
 */
export function sharedDomainsOpen(list, folders, isOpen) {
  const out = [];
  for (const folder of folders) {
    const holders = holdersOf(list, folder);
    if (holders.length < 2) continue;
    const closed = holders.filter((r) => !isOpen(r.name)).map((r) => r.name);
    const open = holders.filter((r) => isOpen(r.name)).map((r) => r.name);
    if (closed.length > 0 && open.length > 0) out.push({ folder, closed, open });
  }
  return out;
}
