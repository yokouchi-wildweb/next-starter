// scripts/runner/seed/gate.ts
//
// seed と機能の門(純関数。run.ts と gate.test.ts が使う)。
// - 項目の feature?(規則名 = FeatureName、1 つか配列)が 1 つでも閉じていれば飛ばす(partitionSeeds)
// - feature の無い項目は走る。表が無い(PG 42P01)で失敗したときの見分け(isUndefinedTableError)
// - 検査: 項目の fn が import する seed のファイルが閉じられるフォルダ(規則の features)を値で import するなら、
//   その規則が項目の feature に要る(seedFilesByKey + missingSeedFeatures、pnpm test:db-seed)
//
// 詳細: scripts/runner/seed/README.md「閉じた機能と seed」

/** 項目の feature を配列にそろえる */
export function featuresOf<F extends string>(seed: { feature?: F | readonly F[] }): F[] {
  if (seed.feature === undefined) return [];
  return typeof seed.feature === "string" ? [seed.feature] : [...(seed.feature as readonly F[])];
}

type FeatureField = { feature?: string | readonly string[] };

/** 項目の feature の要素の型(SeedConfig なら FeatureName) */
export type FeatureOf<T extends FeatureField> = NonNullable<T["feature"]> extends infer X
  ? X extends readonly (infer E)[]
    ? E & string
    : X & string
  : never;

export type SkippedSeed<T extends FeatureField> = { seed: T; closed: FeatureOf<T>[] };

/** 走らせる項目と、閉じた機能のため飛ばす項目(閉じた規則名付き)に分ける。順は入力のまま */
export function partitionSeeds<T extends FeatureField>(
  seeds: readonly T[],
  isOpen: (feature: FeatureOf<T>) => boolean,
): { run: T[]; skipped: SkippedSeed<T>[] } {
  const run: T[] = [];
  const skipped: SkippedSeed<T>[] = [];
  for (const seed of seeds) {
    const closed = (featuresOf(seed) as FeatureOf<T>[]).filter((feature) => !isOpen(feature));
    if (closed.length > 0) skipped.push({ seed, closed });
    else run.push(seed);
  }
  return { run, skipped };
}

/** 表が無い(PostgreSQL 42P01 undefined_table)エラーか。drizzle が包んだ cause もたどる */
export function isUndefinedTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === "42P01") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * registry.ts の本文から、項目のキー → fn が import する seed のファイル(`import("./x")` の字面、相対)を読む。
 * 項目の区切り = `key: "<k>"` の出現。区切りの間で最初の `import("./…")` をその項目のファイルとする
 */
export function seedFilesByKey(registryText: string): Map<string, string> {
  const body = registryText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");
  const keys = [...body.matchAll(/\bkey\s*:\s*["']([^"']+)["']/g)];
  const result = new Map<string, string>();
  keys.forEach((match, index) => {
    const end = index + 1 < keys.length ? keys[index + 1].index : body.length;
    const segment = body.slice(match.index, end);
    const file = /\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/.exec(segment)?.[1];
    if (file) result.set(match[1], file);
  });
  return result;
}

export type MissingSeedFeature = { key: string; file: string; folder: string; rule: string };

/**
 * 閉じられるフォルダを import する seed の項目で、その規則が feature に無い物を返す(上流は 0 件であること)。
 * @param importedPathsOf seed のファイル(registry からの相対)→ そのファイルが値で import する先のパス(repo 相対、解決済み)
 */
export function missingSeedFeatures(input: {
  seeds: readonly { key: string; feature?: string | readonly string[] }[];
  filesByKey: ReadonlyMap<string, string>;
  rules: readonly { name: string; features?: readonly string[] }[];
  importedPathsOf: (file: string) => readonly string[];
}): MissingSeedFeature[] {
  const folders = input.rules.flatMap((rule) => (rule.features ?? []).map((folder) => ({ folder, rule: rule.name })));
  const missing: MissingSeedFeature[] = [];
  for (const seed of input.seeds) {
    const file = input.filesByKey.get(seed.key);
    if (!file) continue;
    const declared = new Set<string>(featuresOf(seed));
    const paths = input.importedPathsOf(file);
    for (const { folder, rule } of folders) {
      const base = `src/features/${folder}`;
      const hit = paths.some((path) => path === base || path.startsWith(`${base}/`));
      if (hit && !declared.has(rule)) missing.push({ key: seed.key, file, folder, rule });
    }
  }
  return missing;
}
