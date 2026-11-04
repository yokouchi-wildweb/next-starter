// src/featureGate/checks/importSources.mjs
// ファイルの本文から値の import の指定子を字面で読む(型だけの import は除く。動的 import・副作用 import は数える)。
// 到達の検査(reachability.test.mjs)と依存の検査(dependencies.mjs)が共有する

const stripComments = (text) => text.replace(/^[ \t]*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** 値の import の指定子(型だけの import は除く) */
export function valueImportSources(text) {
  const body = stripComments(text);
  const sources = [];
  for (const m of body.matchAll(/^\s*(import|export)\s+(type\s+)?([^;]*?)\s*from\s*["']([^"']+)["']/gm)) {
    const [, , typeKeyword, clause, source] = m;
    if (typeKeyword) continue;
    const named = /^\{([\s\S]*)\}$/.exec(clause.trim());
    if (named) {
      const parts = named[1].split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0 && parts.every((p) => p.startsWith("type "))) continue;
    }
    sources.push(source);
  }
  for (const m of body.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) sources.push(m[1]);
  for (const m of body.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) sources.push(m[1]);
  return sources;
}

