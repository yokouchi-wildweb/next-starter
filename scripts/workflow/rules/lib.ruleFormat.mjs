// scripts/workflow/rules/lib.ruleFormat.mjs
// 書式の検査の部品(純粋な関数、ファイルは読まない): 札・README・対応表 existing_parts。
// 書式の正本: 札 = .claude/rules/core/design.md の cards の節、README = .claude/rules/core/readme-format.md、
// existing_parts = .claude/rules/core/components.md の鍵。ここはそれを検査の形にした物。

export const CARD_PARTS = ["what", "use", "change", "rules", "read"];
export const CARD_MAX_CHARS = 10000;
export const README_H2 = ["Overview", "Usage", "API", "Extension", "Internals", "Verification", "Related"];
export const README_MAX_CHARS = 40000;

/** 札のパス(.claude/rules/items/<category>/<name>.md)から category と name。形が違えば null */
export function cardId(path) {
  const m = path.match(/^\.claude\/rules\/items\/([^/]+)\/([^/]+)\.md$/);
  return m ? { category: m[1], name: m[2] } : null;
}

/** 札の frontmatter: { keys, paths } | null */
function cardFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const keys = m[1]
    .split("\n")
    .filter((l) => /^[A-Za-z_][\w-]*:/.test(l))
    .map((l) => l.split(":")[0]);
  const paths = [...m[1].matchAll(/^\s+-\s+"([^"]+)"\s*$/gm)].map((x) => x[1]);
  return { keys, paths, end: m[0].length };
}

/** README の h2(コードの囲みの中は数えない) */
export function h2Of(text) {
  const out = [];
  let fence = false;
  for (const line of text.split("\n")) {
    if (/^(```|~~~)/.test(line)) fence = !fence;
    else if (!fence) {
      const m = line.match(/^## (.+?)\s*$/);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

/**
 * 札の書式の問題(空 = 適合)
 * @param {{ path: string, text: string, itemFolder: string | null, readmeH2: (file: string) => string[] | null }} input
 *   itemFolder = 札の品目のフォルダ(実在しなければ null)、readmeH2 = README の h2 を返す(無ければ null)
 */
export function cardProblems({ path, text, itemFolder, readmeH2 }) {
  const id = cardId(path);
  if (!id) return [`置き場が .claude/rules/items/<lib|domains|components>/<name>.md でない`];
  const problems = [];
  if (!["lib", "domains", "components"].includes(id.category)) problems.push(`category ${id.category} は lib・domains・components のどれでもない`);
  if (text.length > CARD_MAX_CHARS) problems.push(`${text.length} 字(1 枚 ${CARD_MAX_CHARS} 字まで)`);
  if (!itemFolder) problems.push(`品目のフォルダが無い(${id.category}/${id.name})`);

  const fm = cardFrontmatter(text);
  if (!fm) return [...problems, "frontmatter が無い"];
  if (fm.keys.join(",") !== "paths" || fm.paths.length === 0) problems.push("frontmatter は paths だけ(1 つ以上)");
  if (itemFolder) {
    const configName = `${id.name}.config.ts`;
    for (const p of fm.paths) {
      const inFolder = p === itemFolder || p.startsWith(`${itemFolder}/`);
      const isConfig = p.startsWith("src/config/") && p.endsWith(`/${configName}`);
      const isOverride = p.startsWith("src/config/") && p.endsWith(`/${id.name}.override.ts`);
      if (!inFolder && !isConfig && !isOverride) problems.push(`paths ${p} が品目のフォルダ・その設定の外`);
    }
  }

  const body = text.slice(fm.end).split("\n");
  const title = body.find((l) => l.trim());
  if (title !== `# ${id.category}/${id.name}`) problems.push(`題は # ${id.category}/${id.name}`);

  const partLines = body.map((l, i) => ({ l, i })).filter(({ l }) => /^(what|use|change|rules|read):/.test(l));
  const order = partLines.map(({ l }) => l.split(":")[0]);
  if (order.join(",") !== CARD_PARTS.join(",")) problems.push(`欄は ${CARD_PARTS.join(" → ")} の順に 1 つずつ(今: ${order.join(" → ") || "無し"})`);

  const rulesAt = partLines.find(({ l }) => l.startsWith("rules:"))?.i;
  const readAt = partLines.find(({ l }) => l.startsWith("read:"))?.i;
  if (rulesAt !== undefined && readAt !== undefined && readAt > rulesAt) {
    const block = body.slice(rulesAt, readAt);
    if (!block.some((l) => /^\s*(using|editing):/.test(l) || /^rules:\s*(using|editing):/.test(l))) problems.push("rules は using: と editing: に分ける");
    const keys = block.map((l) => l.match(/^\s*-\s+([\w.-]+):/)?.[1]).filter(Boolean);
    const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dup.length) problems.push(`rules の鍵が重なる: ${[...new Set(dup)].join(", ")}`);
  }

  if (readAt !== undefined) {
    // read の各案内: `→ <h2>`(品目の README)か `→ <path>.md <h2>`
    const readBlock = body.slice(readAt).join("\n");
    for (const m of readBlock.matchAll(/→\s*(?:(\S+\.md)\s+)?([A-Za-z]+)/g)) {
      const file = m[1] ?? (itemFolder ? `${itemFolder}/README.md` : null);
      if (!file) continue;
      const h2s = readmeH2(file);
      if (!h2s) problems.push(`read の ${file} が無い`);
      else if (!h2s.includes(m[2])) problems.push(`read の ${file} に h2 ${m[2]} が無い`);
    }
  }
  return problems;
}

/** README の書式の問題(空 = 適合) */
export function readmeProblems(text) {
  const problems = [];
  if (text.length > README_MAX_CHARS) problems.push(`${text.length} 字(${README_MAX_CHARS} 字まで。分けるなら下のフォルダか h2 の名の文書へ)`);
  const h2 = h2Of(text);
  const unknown = h2.filter((h) => !README_H2.includes(h));
  if (unknown.length) problems.push(`決まった語でない h2: ${unknown.join(", ")}`);
  if (!h2.includes("Overview")) problems.push("Overview が無い");
  const known = h2.filter((h) => README_H2.includes(h));
  const sorted = [...known].sort((a, b) => README_H2.indexOf(a) - README_H2.indexOf(b));
  if (known.join(",") !== sorted.join(",") || new Set(known).size !== known.length) problems.push(`h2 の順は ${README_H2.join(" → ")}(1 つずつ)`);
  return problems;
}

/**
 * 対応表 existing_parts の → の先のうち場所の分かる物: 部品(Category/Name…)と @/lib/<name>
 * @param {string} text components.md の全文
 * @returns {{ line: number, kind: "component" | "lib", ref: string }[]}
 */
export function existingPartRefs(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^existing_parts\b/.test(l));
  if (start < 0) return [];
  const refs = [];
  for (let i = start + 1; i < lines.length && /^\s*-\s/.test(lines[i]); i++) {
    for (const seg of lines[i].split("→").slice(1)) {
      const head = seg.split("|")[0];
      for (const m of head.matchAll(/(?<![\w@/])([A-Z][A-Za-z]+(?:\/[A-Z][A-Za-z]+)+)/g)) refs.push({ line: i + 1, kind: "component", ref: m[1] });
      for (const m of head.matchAll(/@\/lib\/([\w-]+)/g)) refs.push({ line: i + 1, kind: "lib", ref: m[1] });
    }
  }
  return refs;
}

/** Tier1 の品目 → 札の実在と上流の README の書式の数の 1 行: Tier1 は止める、fork は知らせ(fork は上流の物を直せない) */
export function countLineTarget(isTier1) {
  return isTier1 ? "fail" : "notify";
}
