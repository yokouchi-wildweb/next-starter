// eslint-rules/raw-sql-date.mjs
//
// drizzle の生の sql`` テンプレートに JS の Date を埋め込まない(CLAUDE.md CRUD_SERVICE・.claude/rules/core/crud-service.md raw_sql)。
// sql`` の値は Date.toString() 相当("Sun Mar 01 2026 … GMT+0900 (…)")で渡り、::timestamptz を付けても Postgres が読めず
// クエリの時に落ちる('Failed query … WHERE created_at < $1')。→ .toISOString() で渡す。Drizzle の演算子(eq / gt / lt / between …)は
// Date をそのまま受けるので変換は要らない。詳細: src/lib/crud/README.md「落とし穴: sql テンプレートに Date を直接渡さない」
//
// 止めるもの(型情報なしで分かる範囲): タグが `sql`(sql`` / sql.raw 以外の識別子 sql)のテンプレートの ${…} に
// - new Date(…)
// - Date になる識別子: `new Date(…)` で初期化した変数・型注記が Date(Date | null 等の合併も)の変数と引数・`as Date` の変数
// - 上のどれかを含む条件式(a ? b : c)・論理式(a ?? b)・as / ! の注記
// 通すもの: d.toISOString()・d.getTime()・Date.now()・列・他の値。メンバー(opts.before 等)は型が要るので見ない(テストで押さえる)
// 正当な例外(Date を受ける独自の sql 関数等)は理由付きの eslint-disable で外す。
// 強さ: 全 Tier error(クエリが落ちるのを止める守り。required-rules.mjs に載る)。

const TS_WRAPPERS = new Set(["TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression", "TSTypeAssertion"]);

/** 型の注記が Date(合併・括弧の中も)か */
const isDateType = (type) => {
  if (!type) return false;
  if (type.type === "TSTypeAnnotation") return isDateType(type.typeAnnotation);
  if (type.type === "TSTypeReference") return type.typeName.type === "Identifier" && type.typeName.name === "Date";
  if (type.type === "TSUnionType") return type.types.some(isDateType);
  if (type.type === "TSParenthesizedType") return isDateType(type.typeAnnotation);
  return false;
};

/** タグが sql か(識別子 sql だけ。sql.raw は文字列を取るので対象外) */
const isSqlTag = (tag) => tag.type === "Identifier" && tag.name === "sql";

const rule = {
  meta: {
    type: "problem",
    docs: { description: "生の sql`` に JS の Date を埋め込まない(.toISOString() か Drizzle の演算子)" },
    messages: {
      date:
        "生の sql`` に JS の Date を埋め込まない: Postgres が読めずクエリの時に落ちます。.toISOString() で渡すか、Drizzle の演算子(eq / gt / lt / between …)を使います。詳細: src/lib/crud/README.md「落とし穴」・eslint-rules/raw-sql-date.mjs",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /** 変数の宣言から Date と分かるか */
    const isDateVariable = (variable, seen) => {
      if (!variable || seen.has(variable)) return false;
      seen.add(variable);
      return variable.defs.some((def) => {
        if (def.type === "Variable" && def.node.type === "VariableDeclarator" && def.node.id.type === "Identifier") {
          if (isDateType(def.node.id.typeAnnotation)) return true;
          // const は初期化の値で決まる。let / var は後で入れ替わるので型注記だけを信じる
          return def.parent?.kind === "const" && def.node.init != null && producesDate(def.node.init, seen);
        }
        if (def.type === "Parameter") {
          // 引数 d: Date / d: Date = new Date()
          const name = def.name;
          if (isDateType(name.typeAnnotation)) return true;
          const holder = name.parent;
          return holder?.type === "AssignmentPattern" && holder.left === name && (isDateType(holder.left.typeAnnotation) || producesDate(holder.right, seen));
        }
        return false;
      });
    };

    /** 式が Date の値か(型情報なしで分かる範囲) */
    function producesDate(node, seen = new Set()) {
      if (!node) return false;
      if (TS_WRAPPERS.has(node.type)) {
        if ((node.type === "TSAsExpression" || node.type === "TSTypeAssertion") && isDateType(node.typeAnnotation)) return true;
        return producesDate(node.expression, seen);
      }
      switch (node.type) {
        case "NewExpression":
          return node.callee.type === "Identifier" && node.callee.name === "Date";
        case "ConditionalExpression":
          return producesDate(node.consequent, seen) || producesDate(node.alternate, seen);
        case "LogicalExpression":
          return producesDate(node.left, seen) || producesDate(node.right, seen);
        case "Identifier": {
          let scope = sourceCode.getScope(node);
          while (scope) {
            const variable = scope.set.get(node.name);
            if (variable) return isDateVariable(variable, seen);
            scope = scope.upper;
          }
          return false;
        }
        default:
          return false;
      }
    }

    return {
      TaggedTemplateExpression(node) {
        if (!isSqlTag(node.tag)) return;
        for (const expression of node.quasi.expressions) {
          if (producesDate(expression)) context.report({ node: expression, messageId: "date" });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-raw-sql-date", version: "1.0.0" },
  rules: { "no-date-param": rule },
};

export default plugin;
