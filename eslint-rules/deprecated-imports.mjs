// eslint-rules/deprecated-imports.mjs
//
// 改名・移動した module の旧パス import を警告する汎用ルール。
// upstream が改名するとき、旧パスには再 export の shim を 1 checkpoint 残し、このルールで下流に使用箇所を列挙させる。
// 次の checkpoint で shim を消すと tsc が止めるので、lint は warn で十分(fork の lint を即座に落とさない)。
//
// 設定(eslint.config.mjs):
//   "deprecated-imports/no-deprecated-path": ["warn", { paths: [{ from, to, until }] }]
//   from  = 旧パス(`@/domains/core/wallet/components/WalletBalancePage`。これに一致、または `from + "/"` 配下の import を検出)
//   to    = 新パス(メッセージに出す。配下の import は同じ相対部分を to に付け替えた候補を出す)
//   until = 削除予定(checkpoint 名など。メッセージに出す)
//   exact = true なら from そのもの(と from + "/index")だけを検出し、配下は検出しない
//           (消した入口 `@/components/Layout` のように、配下の部品のファイルはそのまま使える旧パス向け)
//   collapse = true なら配下の import も検出し、候補は配下の道を付けずに to そのもの
//           (閉じた lib の入口 1 本へ移した旧フォルダ `@/components/Form` → `@/lib/formSuite` のように、配下の道が行き先に無いとき)
//
// `@/domains/<core ドメイン>/...`(core を省略した推奨形)も `@/domains/core/<ドメイン>/...` と同一視する。
// 相対パス import(`../WalletBalancePage`)は解決しない(shim 削除後に tsc が検出する)。

/**
 * import 元を正規化する。`@/domains/<x>/` で x が core でなければ `@/domains/core/<x>/` に揃える
 * (tsconfig paths の `@/domains/<coreDomain>/*` → `core/<coreDomain>/*` と同じ扱い。business ドメインは
 * core 配下に実体が無いので from 側と一致せず、誤検出にはならない)
 */
export function normalizeImportSource(source) {
  const m = /^@\/domains\/([^/]+)(\/.*)?$/.exec(source);
  if (!m || m[1] === "core") return source;
  return `@/domains/core/${m[1]}${m[2] ?? ""}`;
}

/**
 * 旧パス一覧に照らして、該当する設定項目と置き換え候補を返す。該当しなければ null
 * @param {string} source import 元
 * @param {{ from: string, to: string, until?: string, exact?: boolean, collapse?: boolean }[]} paths
 */
export function matchDeprecated(source, paths) {
  const normalized = normalizeImportSource(source);
  for (const entry of paths) {
    const from = normalizeImportSource(entry.from);
    if (normalized === from) return { entry, replacement: entry.to };
    if (entry.exact) {
      if (normalized === `${from}/index`) return { entry, replacement: entry.to };
      continue;
    }
    if (normalized.startsWith(`${from}/`)) {
      if (entry.collapse) return { entry, replacement: entry.to };
      return { entry, replacement: `${entry.to}${normalized.slice(from.length)}` };
    }
  }
  return null;
}

const noDeprecatedPathRule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "改名・移動済み module の旧パス import を警告する(旧パスは次の checkpoint で削除される)",
    },
    messages: {
      deprecated:
        '"{{source}}" は旧パスです({{until}} で削除)。"{{replacement}}" に直してください',
    },
    schema: [
      {
        type: "object",
        properties: {
          paths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                until: { type: "string" },
                exact: { type: "boolean" },
                collapse: { type: "boolean" },
              },
              required: ["from", "to"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const paths = context.options[0]?.paths ?? [];
    if (paths.length === 0) return {};
    const check = (node, sourceNode) => {
      if (!sourceNode || typeof sourceNode.value !== "string") return;
      const hit = matchDeprecated(sourceNode.value, paths);
      if (!hit) return;
      context.report({
        node: sourceNode,
        messageId: "deprecated",
        data: {
          source: sourceNode.value,
          replacement: hit.replacement,
          until: hit.entry.until ?? "次の checkpoint",
        },
      });
    };
    return {
      ImportDeclaration(node) {
        check(node, node.source);
      },
      ExportNamedDeclaration(node) {
        check(node, node.source);
      },
      ExportAllDeclaration(node) {
        check(node, node.source);
      },
      ImportExpression(node) {
        if (node.source.type === "Literal") check(node, node.source);
      },
    };
  },
};

/**
 * Flat config 用プラグインオブジェクト。
 * eslint.config.mjs から `plugins: { "deprecated-imports": <this> }` で登録する。
 */
const plugin = {
  meta: {
    name: "eslint-plugin-local-deprecated-imports",
    version: "1.0.0",
  },
  rules: {
    "no-deprecated-path": noDeprecatedPathRule,
  },
};

export default plugin;
