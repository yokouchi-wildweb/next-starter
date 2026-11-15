// eslint-rules/audit-action-naming.mjs
//
// 監査ログの action 命名規約を静的に強制するローカル ESLint プラグイン。
//
// 検出対象:
// 1. auditLogger.record({ action: "..." })
//    auditLogger.recordDiff({ action: "..." })
//    → action が文字列リテラルでない、または `<domain>.<entity>.<verb>` パターンに合わない場合に error
//
// 2. createCrudService の audit: { actionPrefix: "..." }
//    → actionPrefix が文字列リテラルでない、または `<domain>(.<entity>)*` パターンに合わない場合に error
//
// 3. 注入された記録関数に渡す監査の入力(AuditRecordInput の形)
//    deps.recordAudit({ targetType, targetId, action: "..." }) のように auditLogger を直に呼ばない経路でも、
//    action と targetType を持つオブジェクトリテラル = 監査の入力とみなし、呼び先の名前によらず action を照合する
//    (recordMany の配列の要素、変数に置いた入力も同じ)。照合するのは値が分かる形だけ:
//    - 文字列リテラル・式のないテンプレート・その三項(a ? "x.y.created" : "x.y.updated")
//    - 囲む関数の引数をそのまま渡す形(function audit(group, action) { recordAudit({ ..., action }) })
//      → 同じファイルの中のその関数の呼び出しの、その位置の実引数を上と同じく照合する
//    それ以外の動的な値は報告しない(注入の経路は値の受け渡しが正当。runtime の validateActionName が最後に投げる)
//
// 動的な action 名（テンプレートリテラル等）は ESLint では検証できないため、
// 文字列リテラル必須 + 静的パターン照合という 2 段で守る。
// runtime には validateActionName() があるので、誤って動的値を渡しても最終的には throw する。

/**
 * action 名の正規表現。
 * `<domain>.<entity>.<verb>` 形式（最低 2 セグメント、すべて小文字 + 数字 + `_`）。
 * src/lib/audit/validation.ts の ACTION_NAME_PATTERN と同期。
 */
const ACTION_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/**
 * actionPrefix の正規表現。
 * `<domain>` または `<domain>.<entity>` のように 1 セグメント以上。
 * 末尾に `.created` 等を付与する用途のため、最低 1 セグメントを許容する。
 */
const PREFIX_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

const PATTERN_HUMAN = '"<domain>.<entity>.<verb>" (lowercase, dot-separated)';
const PREFIX_HUMAN = '"<domain>(.<entity>)*" (lowercase, dot-separated)';

/**
 * Property ノードの key 名を取り出す（Identifier / Literal の両対応）。
 */
function getPropertyKeyName(prop) {
  if (prop.type !== "Property") return null;
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "Literal" && typeof prop.key.value === "string") return prop.key.value;
  return null;
}

/**
 * CallExpression が auditLogger.record / auditLogger.recordDiff の呼び出しかを判定する。
 * ローカルエイリアス (`const r = auditLogger; r.record(...)`) は静的解析対象外。
 * 通常コードは直接呼び出しが大半なので、ESLint としては best-effort。
 */
function isAuditLoggerCall(node) {
  const callee = node.callee;
  if (callee.type !== "MemberExpression") return false;
  if (callee.object.type !== "Identifier" || callee.object.name !== "auditLogger") return false;
  if (callee.property.type !== "Identifier") return false;
  return callee.property.name === "record" || callee.property.name === "recordDiff";
}

const auditActionNamingRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "監査ログ (auditLogger.record / record diff / createCrudService.audit.actionPrefix) の action 命名規約を強制する",
    },
    schema: [],
    messages: {
      actionNotLiteral:
        "auditLogger.{{method}}() の action は文字列リテラルである必要があります（ESLint で命名規約を検証するため）。動的に組み立てる必要がある場合は、@/lib/audit の validateActionName() を呼んだ上でこのルールを eslint-disable してください。",
      actionInvalid:
        'audit action "{{value}}" は {{pattern}} の形式に合致しません。例: "user.email.changed" / "post.status.changed"',
      prefixNotLiteral:
        "createCrudService の audit.actionPrefix は文字列リテラルである必要があります（CRUD ライフサイクル全体に伝搬するため、静的に確定させてください）。",
      prefixInvalid:
        'audit.actionPrefix "{{value}}" は {{pattern}} の形式に合致しません。例: "user" / "post" / "wallet.coin"',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /** 文字列として値が分かる action の候補(リテラル・式のないテンプレート・三項の両側)を集める。分からない枝は無視 */
    function collectStaticStrings(node, out) {
      if (!node) return out;
      if (node.type === "Literal" && typeof node.value === "string") out.push({ node, value: node.value });
      else if (node.type === "TemplateLiteral" && node.expressions.length === 0) out.push({ node, value: node.quasis[0].value.cooked ?? "" });
      else if (node.type === "ConditionalExpression") {
        collectStaticStrings(node.consequent, out);
        collectStaticStrings(node.alternate, out);
      } else if (["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"].includes(node.type)) {
        collectStaticStrings(node.expression, out);
      }
      return out;
    }

    function reportInvalidStrings(node) {
      for (const { node: literal, value } of collectStaticStrings(node, [])) {
        if (!ACTION_PATTERN.test(value)) {
          context.report({ node: literal, messageId: "actionInvalid", data: { value, pattern: PATTERN_HUMAN } });
        }
      }
    }

    /** 識別子の変数(スコープを上へたどる) */
    function resolveVariable(identifier) {
      let scope = sourceCode.getScope(identifier);
      while (scope) {
        const variable = scope.set.get(identifier.name);
        if (variable) return variable;
        scope = scope.upper;
      }
      return null;
    }

    /** 関数ノードの名前の変数(function f / const f = () => / const f = function) */
    function functionNameVariable(fn) {
      if (fn.type === "FunctionDeclaration" && fn.id) return resolveVariable(fn.id);
      const parent = fn.parent;
      if (parent?.type === "VariableDeclarator" && parent.init === fn && parent.id.type === "Identifier") return resolveVariable(parent.id);
      return null;
    }

    /** action の値が囲む関数の引数そのものなら、同じファイルの呼び出しの実引数を照合する */
    function checkPassThroughParam(identifier) {
      const variable = resolveVariable(identifier);
      const def = variable?.defs[0];
      if (!def || def.type !== "Parameter") return;
      const fn = def.node;
      const index = fn.params.indexOf(def.name);
      if (index < 0) return; // 分割代入・既定値付きの引数は追わない
      const fnVariable = functionNameVariable(fn);
      if (!fnVariable) return;
      for (const reference of fnVariable.references) {
        const call = reference.identifier.parent;
        if (call?.type !== "CallExpression" || call.callee !== reference.identifier) continue;
        reportInvalidStrings(call.arguments[index]);
      }
    }

    /** オブジェクトリテラルが監査の入力の形(action と targetType を持つ)か */
    function isAuditInputShape(node) {
      const keys = new Set(node.properties.map(getPropertyKeyName));
      return keys.has("action") && keys.has("targetType");
    }

    function checkAction(prop, methodName) {
      const value = prop.value;
      if (value.type !== "Literal" || typeof value.value !== "string") {
        context.report({
          node: value,
          messageId: "actionNotLiteral",
          data: { method: methodName },
        });
        return;
      }
      if (!ACTION_PATTERN.test(value.value)) {
        context.report({
          node: value,
          messageId: "actionInvalid",
          data: { value: value.value, pattern: PATTERN_HUMAN },
        });
      }
    }

    function checkActionPrefix(prop) {
      const value = prop.value;
      if (value.type !== "Literal" || typeof value.value !== "string") {
        context.report({ node: value, messageId: "prefixNotLiteral" });
        return;
      }
      if (!PREFIX_PATTERN.test(value.value)) {
        context.report({
          node: value,
          messageId: "prefixInvalid",
          data: { value: value.value, pattern: PREFIX_HUMAN },
        });
      }
    }

    return {
      CallExpression(node) {
        if (!isAuditLoggerCall(node)) return;
        const arg = node.arguments[0];
        if (!arg || arg.type !== "ObjectExpression") return;

        const methodName = node.callee.property.name;
        for (const prop of arg.properties) {
          if (getPropertyKeyName(prop) === "action") {
            checkAction(prop, methodName);
          }
        }
      },

      // 注入された記録関数に渡す監査の入力(呼び先の名前によらない)。auditLogger.record の直の引数は上で見る
      ObjectExpression(node) {
        if (!isAuditInputShape(node)) return;
        const parent = node.parent;
        if (parent?.type === "CallExpression" && parent.arguments[0] === node && isAuditLoggerCall(parent)) return;
        for (const prop of node.properties) {
          if (getPropertyKeyName(prop) !== "action") continue;
          if (prop.value.type === "Identifier") checkPassThroughParam(prop.value);
          else reportInvalidStrings(prop.value);
        }
      },

      // audit: { actionPrefix: "..." } の検証。
      // どこかの ObjectExpression のプロパティ "audit" の値の中で
      // actionPrefix が出現したら検査する（createCrudService 引数を想定）。
      Property(node) {
        if (getPropertyKeyName(node) !== "actionPrefix") return;
        const objExpr = node.parent;
        if (!objExpr || objExpr.type !== "ObjectExpression") return;
        const auditProp = objExpr.parent;
        if (!auditProp || auditProp.type !== "Property") return;
        if (getPropertyKeyName(auditProp) !== "audit") return;

        checkActionPrefix(node);
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// audit/subject-required ルール
// ─────────────────────────────────────────────────────────────────────────────
//
// 監査ログにおける "actor (誰が)" と "subject (誰に対して)" の概念分離を促す静的検出。
//
// 検出対象:
// - auditLogger.record({ ... }) / auditLogger.recordDiff({ ... }) の単件呼び出し
//   (recordMany / recordManyDiff の配列要素は動的に組み立てられるため対象外)
//
// 警告対象:
// - targetType が文字列リテラル "user" で subjectUserId フィールド未指定
// - action が REQUIRED_SUBJECT_ACTION_PREFIXES のいずれかで始まる文字列リテラルで
//   subjectUserId フィールド未指定
//
// 除外対象:
// - action 名に `.bulk_` を含む（bulk aggregate は対象ユーザーが単一でないため subject=null が正常）
// - subjectUserId フィールドが存在すれば値は問わない（null 明示も許容、unknown user 等で使う）
//
// 動的に組み立てる必要がある正当なケースは個別 `eslint-disable` で許可する。

/**
 * subjectUserId 設定が期待される action 名のプレフィックス。
 * upstream 同梱ドメインを列挙する。フォーク先で固有ドメインを追加する場合は
 * フォーク側でこのファイルを更新するか、上位プラグインで補強する。
 */
const REQUIRED_SUBJECT_ACTION_PREFIXES = [
  "user.",
  "auth.",
  "wallet.",
  "user_item.",
  "subscription.",
  "purchase_request.",
  "purchase_quota.",
  "bank_transfer_review.",
  "coupon_grant.",
  "messaging.",
];

/**
 * 上記プレフィックスに該当しても、bulk aggregate 用の action 名は subject 無しで正常。
 * "wallet.balance.bulk_adjusted_by_type" 等を除外する。
 */
const BULK_ACTION_PATTERN = /\.bulk_/;

function actionRequiresSubject(actionValue) {
  if (BULK_ACTION_PATTERN.test(actionValue)) return false;
  return REQUIRED_SUBJECT_ACTION_PREFIXES.some((p) => actionValue.startsWith(p));
}

const auditSubjectRequiredRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "ユーザーに紐づく監査ログ呼び出しに subjectUserId フィールドを必須化する（subject 概念分離の構造担保）",
    },
    schema: [],
    messages: {
      missingSubjectUserId:
        'auditLogger.{{method}}() に subjectUserId フィールドが指定されていません。' +
        ' targetType / action から「ユーザーに紐づく操作」と判定されました（target: {{target}}, action: {{action}}）。' +
        ' 対象ユーザー ID を subjectUserId に渡してください。bulk aggregate や対象が特定不能なケースで' +
        ' 意図的に null としたい場合は `subjectUserId: null` を明示するか eslint-disable で抑止してください。',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isAuditLoggerCall(node)) return;
        const methodName = node.callee.property.name;
        // recordMany / recordManyDiff の配列引数は静的に内部を読まない（誤検知を避ける）
        if (methodName !== "record" && methodName !== "recordDiff") return;

        const arg = node.arguments[0];
        if (!arg || arg.type !== "ObjectExpression") return;

        let targetTypeLiteral = null;
        let actionLiteral = null;
        let hasSubjectUserId = false;

        for (const prop of arg.properties) {
          const keyName = getPropertyKeyName(prop);
          if (keyName === "subjectUserId") {
            hasSubjectUserId = true;
            continue;
          }
          if (keyName === "targetType" && prop.value.type === "Literal" && typeof prop.value.value === "string") {
            targetTypeLiteral = prop.value.value;
          }
          if (keyName === "action" && prop.value.type === "Literal" && typeof prop.value.value === "string") {
            actionLiteral = prop.value.value;
          }
        }

        if (hasSubjectUserId) return;

        const targetTypeRequires = targetTypeLiteral === "user";
        const actionRequires = actionLiteral !== null && actionRequiresSubject(actionLiteral);

        if (!targetTypeRequires && !actionRequires) return;

        context.report({
          node: arg,
          messageId: "missingSubjectUserId",
          data: {
            method: methodName,
            target: targetTypeLiteral ?? "(dynamic)",
            action: actionLiteral ?? "(dynamic)",
          },
        });
      },
    };
  },
};

/**
 * Flat config 用のプラグインオブジェクト。
 * eslint.config.mjs から `plugins: { "audit": <this> }` で登録する。
 */
const plugin = {
  meta: {
    name: "eslint-plugin-local-audit",
    version: "1.0.0",
  },
  rules: {
    "action-naming": auditActionNamingRule,
    "subject-required": auditSubjectRequiredRule,
  },
};

export default plugin;
