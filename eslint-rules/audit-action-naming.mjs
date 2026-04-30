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
  },
};

export default plugin;
