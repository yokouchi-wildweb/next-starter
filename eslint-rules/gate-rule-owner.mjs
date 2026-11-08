// eslint-rules/gate-rule-owner.mjs
//
// 門の規則(src/featureGate/rules/<名前>.ts)が値で読むのは 1 つの地区の config.ts だけ(目録 D14)。
// 門の値の持ち主 = その config の地区。決め方の順: (1) features: を持つ規則はその中の 1 つ (2) 設定 D36 の名指し(proxies・user・legal)
// (3) 値が何を判断するかで人が決め、規則の頭に注。fork が core のページを閉じる門は fork 自身の地区。
//
// 止める物: 値の import が 2 本以上 / 地区の config.ts でない値の import(src/config・他の地区の関数や定数・utils・描画用の config.ui.ts)/
// features: を持つ規則が features の外の地区の config を読む。型だけの import は数えない。値の import 0 本(enabled: () => true)は通す。
// 強さ: 今は warn(規則が src/config/app を読む間は鳴る)。値を各地区へ移すクエストの後、締め 1 で error にする。
// 地区は地区の地図(src/lib/districtMap)で引く(eslint のプロセスで 1 回)。

import { readFileSync } from "node:fs";

import { FEATURES_ROOT, readRuleFeatures } from "../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../src/lib/districtMap/node.mjs";
import { moduleVisitors, repoRelative, resolveImport } from "./resolve-import.mjs";

const RULE_FILE = /^src\/featureGate\/rules\/[^/]+\.ts$/;
const TEST_FILE = /\.test\./;
const stripExt = (p) => p.replace(/\.(ts|tsx|mts|mjs|js)$/, "").replace(/\/index$/, "");

const cache = new Map();
/** config.ts のパス(拡張子なし)→ 地区 */
function configOwners(root) {
  if (cache.has(root)) return cache.get(root);
  const owners = new Map();
  for (const d of readDistrictMapAt(root).districts) owners.set(stripExt(d.config.path), d);
  cache.set(root, owners);
  return owners;
}

/** テスト用: 覚えた地図を捨てる */
export function clearGateRuleOwnerCache() {
  cache.clear();
}

const rule = {
  meta: {
    type: "suggestion",
    docs: { description: "門の規則が値で読むのは 1 つの地区の config.ts だけ(目録 D14、src/featureGate/README.md)" },
    schema: [{ type: "object", properties: { root: { type: "string" } }, additionalProperties: false }],
    messages: {
      notConfig:
        '"{{source}}": 門の規則が値で読めるのは 1 つの地区(ドメイン・lib・枠・proxies)の config.ts だけです。値を持ち主の config.ts へ移し、その葉を読みます(目録 D14)',
      tooMany: '"{{source}}": 門の規則が値で読む import は 1 本だけです(持ち主の地区の config.ts。他の値・関数は読まない、目録 D14)',
      outsideFeatures: '"{{source}}": features: を持つ規則の値の持ち主は features の中の地区です({{features}})。{{owner}} は外です(目録 D14)',
    },
  },
  create(context) {
    const root = context.options?.[0]?.root ?? context.cwd;
    const file = repoRelative(context.filename, root);
    if (!RULE_FILE.test(file) || TEST_FILE.test(file)) return {};
    let valueImports = 0;
    let features = null;
    const featuresOf = () => {
      if (features === null) {
        const text = context.sourceCode?.text ?? readFileSync(context.filename, "utf8");
        features = readRuleFeatures(file, text).features.map((f) => `${FEATURES_ROOT}/${f.replace(/\/+$/, "")}`);
      }
      return features;
    };
    return moduleVisitors(({ node, source, typeOnly }) => {
      if (typeOnly) return;
      valueImports += 1;
      if (valueImports > 1) {
        context.report({ node, messageId: "tooMany", data: { source } });
        return;
      }
      const resolved = resolveImport(source, context.filename, root);
      const owner = resolved ? configOwners(root).get(stripExt(resolved)) : undefined;
      if (!owner) {
        context.report({ node, messageId: "notConfig", data: { source } });
        return;
      }
      const list = featuresOf();
      if (list.length > 0 && !list.includes(owner.dir)) {
        context.report({ node, messageId: "outsideFeatures", data: { source, owner: owner.dir, features: list.join("・") } });
      }
    });
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-gate-rule-owner", version: "1.0.0" },
  rules: { "one-district-config": rule },
};

export default plugin;
