// eslint-rules/hidden-columns.mjs
//
// 秘匿カラム（defineHiddenColumns で宣言したパスワードハッシュ・トークンハッシュ等）を
// 生 drizzle の select / returning で取り出すコードを検出するローカル ESLint プラグイン。
//
// 背景:
//   hiddenColumns は createCrudService の戻り値とリレーション展開からは自動で null 置換されるが、
//   生 drizzle（db.select / insert().returning() 等）はサービスを経由しないため素通りする。
//   生クエリの行を HTTP レスポンスや Client Component の props に載せると秘匿値が漏れる
//   （例: 管理画面の一覧 loader が localPassword を select して RSC payload に乗せていた）。
//
// 検出ロジック（error）:
//   ① select / selectDistinct / selectDistinctOn / returning の引数オブジェクトに
//      <Table>.<秘匿カラム> を書いている（明示的な取り出し）
//      ...getTableColumns(<Table>) の展開も同じ扱い
//   ② 秘匿カラムを持つテーブルの行を丸ごと取る
//      - db.select().from(<Table>) / selectDistinct().from(<Table>)（引数なし select）
//      - insert(<Table>) / update(<Table>) / delete(<Table>) に続く引数なしの .returning()
//   where / orderBy など条件側での参照（eq(Table.tokenHash, hash) 等）は対象外（正当な用途）。
//
// 直し方:
//   行を丸ごと取りたい → getPublicColumns(<Table>)（@/lib/crud/drizzle/hiddenColumns）を
//   select / returning に渡す。秘匿カラムは DB から null として返る。
//   秘匿値そのものをサーバー内部で読む必要がある → services/server/finders/ の専用ファインダー
//   （このディレクトリは eslint.config.mjs で対象外）。それ以外の正当な例外は理由付き eslint-disable。
//
// 対象テーブル:
//   eslint.config.mjs が collectHiddenColumns() で src/**/entities/drizzle.ts の
//   defineHiddenColumns(<Table>, [...]) を集めてオプションに渡す（手書きの一覧を持たない）。
//
// 限界:
//   テーブルは識別子名で照合する（import 別名・変数経由は追わない）。
//   relational query（db.query.<x>.findMany）は対象外。

import fs from "node:fs";
import path from "node:path";

const SELECT_METHODS = new Set(["select", "selectDistinct", "selectDistinctOn"]);
const WRITE_METHODS = new Set(["insert", "update", "delete"]);
const DECLARATION_PATTERN = /defineHiddenColumns\(\s*([A-Za-z_$][\w$]*)\s*,\s*\[([^\]]*)\]/g;

/**
 * ソース文字列から defineHiddenColumns(<Table>, ["a", "b"]) の宣言を読み取る。
 * 戻り値: { <Table>: ["a", "b"] }
 */
export function parseHiddenColumnDeclarations(source) {
  const result = {};
  for (const match of source.matchAll(DECLARATION_PATTERN)) {
    const props = [...match[2].matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
    result[match[1]] = [...new Set([...(result[match[1]] ?? []), ...props])];
  }
  return result;
}

/**
 * rootDir 配下の entities/drizzle.ts を走査し、秘匿カラム宣言を集める。
 * node_modules / .next / 隠しディレクトリは辿らない。
 */
export function collectHiddenColumns(rootDir) {
  const result = {};
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "drizzle.ts" && path.basename(dir) === "entities") {
        const parsed = parseHiddenColumnDeclarations(fs.readFileSync(full, "utf8"));
        for (const [table, props] of Object.entries(parsed)) {
          result[table] = [...new Set([...(result[table] ?? []), ...props])];
        }
      }
    }
  };
  walk(rootDir);
  return result;
}

function methodName(callExpression) {
  const callee = callExpression.callee;
  if (callee.type !== "MemberExpression" || callee.computed) return null;
  return callee.property.type === "Identifier" ? callee.property.name : null;
}

function identifierName(node) {
  return node && node.type === "Identifier" ? node.name : null;
}

/** チェーン（a.b().c().d()）を内側へ辿り、各 CallExpression を返す */
function* chainCalls(node) {
  let current = node;
  while (current) {
    if (current.type === "CallExpression") {
      yield current;
      current = current.callee.type === "MemberExpression" ? current.callee.object : null;
    } else if (current.type === "MemberExpression") {
      current = current.object;
    } else if (current.type === "AwaitExpression" || current.type === "ChainExpression") {
      current = current.argument ?? current.expression;
    } else {
      return;
    }
  }
}

const noRawSelectRule = {
  meta: {
    type: "problem",
    docs: {
      description: "生 drizzle の select / returning で秘匿カラム（defineHiddenColumns）を取り出さない",
    },
    schema: [
      {
        type: "object",
        properties: {
          hiddenColumns: {
            type: "object",
            additionalProperties: { type: "array", items: { type: "string" } },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      explicitColumn:
        "秘匿カラム {{table}}.{{column}} を select / returning で取り出しています。生 SQL では hiddenColumns の自動除去が効かず、行を HTTP や Client Component に渡すと漏れます。不要なら外し、内部で値が要るなら services/server/finders/ の専用ファインダーへ。",
      spreadColumns:
        "getTableColumns({{table}}) は秘匿カラム（{{columns}}）を含みます。getPublicColumns({{table}})（@/lib/crud/drizzle/hiddenColumns）を使ってください。",
      fullRow:
        "{{table}} の行を丸ごと取得しています（秘匿カラム: {{columns}}）。生 SQL では hiddenColumns の自動除去が効かないため、{{method}}(getPublicColumns({{table}})) で取得してください。",
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const hidden = new Map(
      Object.entries(options.hiddenColumns ?? {}).map(([table, props]) => [table, new Set(props)]),
    );
    if (hidden.size === 0) return {};

    const columnsOf = (table) => [...hidden.get(table)].join(", ");

    /** select / returning の引数オブジェクト内（入れ子含む）の秘匿カラム参照を報告する */
    const checkFieldsObject = (objectNode) => {
      for (const prop of objectNode.properties) {
        if (prop.type === "SpreadElement") {
          const arg = prop.argument;
          if (
            arg.type === "CallExpression" &&
            identifierName(arg.callee) === "getTableColumns" &&
            hidden.has(identifierName(arg.arguments[0]))
          ) {
            const table = identifierName(arg.arguments[0]);
            context.report({ node: prop, messageId: "spreadColumns", data: { table, columns: columnsOf(table) } });
          }
          continue;
        }
        const value = prop.value;
        if (value.type === "ObjectExpression") {
          checkFieldsObject(value);
        } else if (value.type === "MemberExpression" && !value.computed) {
          const table = identifierName(value.object);
          const column = value.property.type === "Identifier" ? value.property.name : null;
          if (table && column && hidden.get(table)?.has(column)) {
            context.report({ node: value, messageId: "explicitColumn", data: { table, column } });
          }
        }
      }
    };

    return {
      CallExpression(node) {
        const method = methodName(node);
        if (!method) return;

        // ① 明示的な取り出し / getTableColumns 展開
        if (SELECT_METHODS.has(method) || method === "returning") {
          for (const arg of node.arguments) {
            if (arg.type === "ObjectExpression") checkFieldsObject(arg);
            if (
              arg.type === "CallExpression" &&
              identifierName(arg.callee) === "getTableColumns" &&
              hidden.has(identifierName(arg.arguments[0]))
            ) {
              const table = identifierName(arg.arguments[0]);
              context.report({ node: arg, messageId: "spreadColumns", data: { table, columns: columnsOf(table) } });
            }
          }
        }

        // ② 引数なし select().from(<Table>)
        if (method === "from") {
          const table = identifierName(node.arguments[0]);
          const inner = node.callee.object;
          if (
            table &&
            hidden.has(table) &&
            inner.type === "CallExpression" &&
            SELECT_METHODS.has(methodName(inner)) &&
            inner.arguments.length === 0
          ) {
            context.report({
              node: inner,
              messageId: "fullRow",
              data: { table, columns: columnsOf(table), method: methodName(inner) },
            });
          }
        }

        // ② insert/update/delete(<Table>)…returning()
        if (method === "returning" && node.arguments.length === 0) {
          for (const call of chainCalls(node.callee.object)) {
            const name = methodName(call);
            if (!WRITE_METHODS.has(name)) continue;
            const table = identifierName(call.arguments[0]);
            if (table && hidden.has(table)) {
              context.report({
                node: node.callee.property,
                messageId: "fullRow",
                data: { table, columns: columnsOf(table), method: "returning" },
              });
            }
            break;
          }
        }
      },
    };
  },
};

/**
 * Flat config 用プラグインオブジェクト。
 * eslint.config.mjs から `plugins: { "hidden-columns": <this> }` で登録する。
 */
const plugin = {
  meta: {
    name: "eslint-plugin-local-hidden-columns",
    version: "1.0.0",
  },
  rules: {
    "no-raw-select": noRawSelectRule,
  },
};

export default plugin;
