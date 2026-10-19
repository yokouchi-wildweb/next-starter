// eslint-rules/client-service-boundary.mjs
//
// UI(コンポーネント・画面)から ClientService を直接呼ぶ import を検出する。
// 規約(CLAUDE.md ARCHITECTURE / ui_layers): HTTP は Hook → ClientService の経路だけ。
// コンポーネントは hooks/ のフックを呼び、ClientService を import しない。
//
// 検出するもの:
//   1. `services/client` を含むパスからの値 import(絶対 `@/features/x/services/client/...`・相対 `../../services/client/...` の両方)
//   2. ドメインのまとめ import(`@/features/<d>` / `@/features/core/<d>`)から `*Client` という名前の値を取り出すもの
//      (例: `import { auditLogClient } from "@/features/core/auditLog"`)
// 通すもの: 型だけの import(`import type` / `import { type X }`。型は HTTP を呼ばない)
//
// 正当な例外(セッション状態の持ち主である Provider など)は理由付き eslint-disable で明示する。
// 対象範囲と強さは eslint.config.mjs 側で決める(upstream 所有の UI は error、下流の UI は warn)。

const CLIENT_SERVICE_PATH = /(^|\/)services\/client(\/|$)/;
const DOMAIN_BARREL = /^@\/features\/(core\/)?[^/]+$/;
const CLIENT_NAME = /Client$/;

/**
 * import 1 件を判定する。違反なら理由("path" | "barrel")を返し、問題なければ null
 * @param {string} source import 元
 * @param {{ name: string, typeOnly: boolean }[] | null} specifiers 取り出す名前(null = 名前を問わない: 副作用 import / namespace / dynamic import)
 * @param {boolean} declarationTypeOnly `import type ...` 宣言か
 */
export function classifyImport(source, specifiers, declarationTypeOnly = false) {
  if (declarationTypeOnly) return null;
  const valueSpecifiers = specifiers?.filter((s) => !s.typeOnly) ?? null;
  // 名前付き import がすべて型なら通す(`import {} from` も実体を読まないので通す)
  if (valueSpecifiers && valueSpecifiers.length === 0 && specifiers.length > 0) return null;

  if (CLIENT_SERVICE_PATH.test(source)) return "path";
  if (DOMAIN_BARREL.test(source) && valueSpecifiers?.some((s) => CLIENT_NAME.test(s.name))) {
    return "barrel";
  }
  return null;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "UI から ClientService を直接 import しない(hooks/ のフックで包む)",
    },
    messages: {
      path: '"{{source}}" は ClientService です。UI から直接呼ばず、hooks/ のフック経由にしてください(正当な例外は理由付き eslint-disable)',
      barrel:
        '"{{source}}" から ClientService({{names}})を取り出しています。UI から直接呼ばず、hooks/ のフック経由にしてください(正当な例外は理由付き eslint-disable)',
    },
    schema: [],
  },
  create(context) {
    const report = (sourceNode, kind, names) => {
      context.report({
        node: sourceNode,
        messageId: kind,
        data: { source: sourceNode.value, names: names.join(", ") },
      });
    };
    return {
      ImportDeclaration(node) {
        if (typeof node.source.value !== "string") return;
        const named = node.specifiers.filter((s) => s.type === "ImportSpecifier");
        const hasOther = node.specifiers.some((s) => s.type !== "ImportSpecifier");
        const specifiers = hasOther || node.specifiers.length === 0
          ? null
          : named.map((s) => ({
              name: s.imported.type === "Identifier" ? s.imported.name : String(s.imported.value),
              typeOnly: s.importKind === "type",
            }));
        const kind = classifyImport(node.source.value, specifiers, node.importKind === "type");
        if (!kind) return;
        const names = (specifiers ?? []).filter((s) => !s.typeOnly && CLIENT_NAME.test(s.name)).map((s) => s.name);
        report(node.source, kind, names);
      },
      ImportExpression(node) {
        if (node.source.type !== "Literal" || typeof node.source.value !== "string") return;
        const kind = classifyImport(node.source.value, null);
        if (kind === "path") report(node.source, kind, []);
      },
    };
  },
};

/**
 * Flat config 用プラグインオブジェクト。
 * eslint.config.mjs から `plugins: { "client-service-boundary": <this> }` で登録する。
 */
const plugin = {
  meta: {
    name: "eslint-plugin-local-client-service-boundary",
    version: "1.0.0",
  },
  rules: {
    "no-direct-import": rule,
  },
};

export default plugin;
