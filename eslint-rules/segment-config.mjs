// eslint-rules/segment-config.mjs
//
// src/app/**/{page,layout,route}.{ts,tsx} の route segment config のうち、Next の cacheComponents と両立しない 5 つの名
// (dynamic・dynamicParams・fetchCache・revalidate・runtime)の export を止める(cacheComponents の準備)。
// 強さ: 上流 error・fork warn(eslint.config.mjs)。cacheComponents を有効にする区切りで全 Tier error になる。
//
// 止める形: `export const|let|var <名> = …`(分割代入の中の名も)・`export { x as <名> }`・`export { <名> } from …`
// 通す名: metadata・viewport・generateMetadata・preferredRegion・maxDuration(cacheComponents でも使える)ほか 5 つ以外の全部
// 理由: cacheComponents の build は 5 つの名を見ると止まる(「Route segment config "X" is not compatible with
//   `nextConfig.cacheComponents`. Please remove it.」)。force-dynamic は今の上流では要らない(どのページも request を読む)。
// page.tsx の切り替えの形の検査(src/lib/screens/checks.mjs)は 5 つの名を取り除いて形だけを見る。可否はこの規則が判じる。

/** cacheComponents と両立しない route segment config の名 */
export const CC_INCOMPATIBLE_SEGMENT_CONFIG = new Set(["dynamic", "dynamicParams", "fetchCache", "revalidate", "runtime"]);

/** 分割代入の形から名を集める */
function collectNames(pattern, names) {
  if (!pattern) return;
  if (pattern.type === "Identifier") names.push({ name: pattern.name, node: pattern });
  else if (pattern.type === "ObjectPattern") pattern.properties.forEach((p) => collectNames(p.type === "RestElement" ? p.argument : p.value, names));
  else if (pattern.type === "ArrayPattern") pattern.elements.forEach((e) => collectNames(e, names));
  else if (pattern.type === "AssignmentPattern") collectNames(pattern.left, names);
}

const ccIncompatible = {
  meta: {
    type: "problem",
    docs: { description: "page・layout・route で cacheComponents と両立しない segment config(dynamic 等 5 つ)を書かない" },
    messages: {
      incompatible:
        "segment config `{{name}}` は cacheComponents と両立しないので書かない(消す。force-dynamic は不要。書けるのは metadata / viewport / preferredRegion / maxDuration。詳細: src/lib/screens/README.md)",
    },
    schema: [],
  },
  create(context) {
    const report = (node, name) => {
      if (CC_INCOMPATIBLE_SEGMENT_CONFIG.has(name)) context.report({ node, messageId: "incompatible", data: { name } });
    };
    return {
      ExportNamedDeclaration(node) {
        if (node.exportKind === "type") return;
        const decl = node.declaration;
        if (decl?.type === "VariableDeclaration") {
          for (const declarator of decl.declarations) {
            const names = [];
            collectNames(declarator.id, names);
            for (const { name, node: at } of names) report(at, name);
          }
          return;
        }
        if (decl?.type === "FunctionDeclaration" && decl.id) {
          report(decl.id, decl.id.name);
          return;
        }
        for (const spec of node.specifiers ?? []) {
          if (spec.exportKind === "type") continue;
          const exported = spec.exported.type === "Identifier" ? spec.exported.name : String(spec.exported.value);
          report(spec, exported);
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-segment-config", version: "1.0.0" },
  rules: { "cc-incompatible": ccIncompatible },
};

export default plugin;
