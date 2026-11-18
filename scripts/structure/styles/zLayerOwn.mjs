// scripts/structure/styles/zLayerOwn.mjs — fork が足す自分の層の検証と値の割り付け(当議会 D189・D194・D187)
//
// 入力: 上流の層(src/styles/core/z-layer.css の :root の名と値)・ページの層の名・自分の層の宣言 { name, above }[]・
//       fork の CSS(src/styles/ の core/ の外)の中身。
// 決まり:
// - name は kebab-case、上流の名と重ならない、重複しない
// - above はページの層(background … forefront)か、この並びで先に書いた自分の層だけ(floating・toast・cover・知らない名・
//   後に書く自分の層は失敗。fork の層は浮く物より上に置けない)
// - 値 = above の値より上、上流の次の層の値より下の帯の中で、書いた順に +10 ずつ上へ積む(帯に入りきらなければ失敗。
//   数で上流の層をずらして入れることはしない)
// - fork の CSS が上流の --z-layer-<上流の名> を定義していたら失敗(上流の層の値は書き換えない、D187)

export const STEP = 10;
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** z-layer.css の :root の --z-layer-<名>: <値>; を読む → [{ name, value }](書いた順) */
export function parseUpstreamLayers(css) {
  const root = css.slice(css.indexOf(":root"), css.indexOf("@layer utilities"));
  return [...root.matchAll(/--z-layer-([a-z-]+):\s*(\d+);/g)].map((m) => ({ name: m[1], value: Number(m[2]) }));
}

/**
 * 検証と割り付け。
 * @param {{ upstream: { name: string, value: number }[], pageNames: string[], decls: { name: string, above: string }[], forkCss?: { file: string, css: string }[] }} input
 * @returns {{ ok: true, layers: { name: string, above: string, value: number }[] } | { ok: false, errors: string[] }}
 */
export function assignOwnLayers({ upstream, pageNames, decls, forkCss = [] }) {
  const errors = [];
  const upstreamNames = new Set(upstream.map((l) => l.name));
  const valueOf = new Map(upstream.map((l) => [l.name, l.value]));
  const page = new Set(pageNames);
  const seen = new Set();
  const assigned = [];
  for (const [i, decl] of decls.entries()) {
    const at = `layers[${i}] ${JSON.stringify(decl?.name ?? "")}`;
    const name = decl?.name;
    const above = decl?.above;
    if (typeof name !== "string" || !KEBAB.test(name)) {
      errors.push(`${at}: name は kebab-case(例 game-effect)`);
      continue;
    }
    if (upstreamNames.has(name)) {
      errors.push(`${at}: 上流の層の名と同じ(別の名にする)`);
      continue;
    }
    if (seen.has(name)) {
      errors.push(`${at}: 同じ名が 2 度ある`);
      continue;
    }
    seen.add(name);
    if (!page.has(above) && !assigned.some((l) => l.name === above)) {
      const why = upstreamNames.has(above)
        ? `${above} はページの層でない(floating・toast・cover より上・その上には置けない)`
        : decls.slice(i + 1).some((d) => d?.name === above)
          ? `${above} は後に書いた自分の層(上に積む元は先に書く)`
          : `${above} という層は無い`;
      errors.push(`${at}: above が ${why}。above はページの層(${pageNames.join("・")})か先に書いた自分の層`);
      continue;
    }
    const base = valueOf.get(above);
    const ceiling = Math.min(...upstream.map((l) => l.value).filter((v) => v > base));
    const inBand = assigned.map((l) => l.value).filter((v) => v > base && v < ceiling);
    const value = Math.max(base, ...inBand) + STEP;
    if (value >= ceiling) {
      errors.push(`${at}: ${above}(${base})の上の帯(${ceiling} の手前まで)に入りきらない。別の above を選ぶ`);
      continue;
    }
    assigned.push({ name, above, value });
    valueOf.set(name, value);
  }
  for (const { file, css } of forkCss) {
    for (const m of css.matchAll(/--z-layer-([a-z-]+)\s*:/g)) {
      if (upstreamNames.has(m[1])) errors.push(`${file}: 上流の層の値 --z-layer-${m[1]} を定義している(上流の層の値は書き換えない。自分の層を above で足す)`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, layers: assigned.sort((a, b) => a.value - b.value) };
}

/** src/styles/z-layer.css の中身 */
export function renderOwnLayerCss(layers) {
  const head = [
    "/*",
    " * src/styles/z-layer.css",
    " * 【自動生成ファイル】直接編集しないでください。このリポが足した重なりの層(fork 所有。global.css が読む)。",
    " * 生成元: src/config/lib/zLayer.config.ts の layers / 生成コマンド: pnpm generate styles",
    " */",
    "",
  ];
  if (layers.length === 0) return [...head, "/* 自分の層は無い */", ""].join("\n");
  return [
    ...head,
    ":root {",
    ...layers.map((l) => `  --z-layer-${l.name}: ${l.value}; /* above ${l.above} */`),
    "}",
    "",
    "@layer utilities {",
    ...layers.flatMap((l) => [`  .${l.name}-layer {`, `    z-index: var(--z-layer-${l.name});`, "  }"]),
    "}",
    "",
  ].join("\n");
}

/** src/lib/zLayer/generated/ownLayers.ts の中身 */
export function renderOwnLayersTs(layers) {
  const items = layers.map((l) => `  { name: ${JSON.stringify(l.name)}, above: ${JSON.stringify(l.above)} },`);
  return [
    "// src/lib/zLayer/generated/ownLayers.ts",
    "// このファイルは自動生成されます。直接編集しないでください。",
    "// 生成元: src/config/lib/zLayer.config.ts(自分の層 { name, above })",
    "// 生成コマンド: pnpm generate styles",
    "",
    "/** このリポが足した層(下から上の順)。値と class は src/styles/z-layer.css */",
    items.length ? `export const OWN_LAYERS = [\n${items.join("\n")}\n] as const satisfies readonly { name: string; above: string }[];` : "export const OWN_LAYERS = [] as const satisfies readonly { name: string; above: string }[];",
    "",
  ].join("\n");
}
