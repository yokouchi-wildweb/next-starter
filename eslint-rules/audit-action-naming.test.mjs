// eslint-rules/audit-action-naming.test.mjs
// 監査の action 名の検査(audit/action-naming)の契約テスト。実行: pnpm test eslint-rules/audit-action-naming.test.mjs (node:test)
// 注入の経路(deps.recordAudit 等、auditLogger を直に呼ばない)の型は messaging の bulkSent / testSent の事故(送れた後に 500)と
// userGroup の audit(group, action) の形を写している
import { test } from "node:test";
import { createRequire } from "node:module";
import { RuleTester } from "eslint";

import plugin from "./audit-action-naming.mjs";

const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" },
});

const invalid = [{ messageId: "actionInvalid" }];

test("audit/action-naming: auditLogger 直の呼び出しと actionPrefix(既存の契約)", () => {
  ruleTester.run("action-naming", plugin.rules["action-naming"], {
    valid: [
      { code: `auditLogger.record({ targetType: "user", targetId: id, action: "user.email.changed" });` },
      { code: `auditLogger.recordDiff({ targetType: "post", targetId: id, action: "post.status.changed", before, after });` },
      { code: `createCrudService(table, { audit: { actionPrefix: "wallet.coin" } });` },
    ],
    invalid: [
      { code: `auditLogger.record({ targetType: "user", targetId: id, action: "user.emailChanged" });`, errors: invalid },
      { code: `auditLogger.record({ targetType: "user", targetId: id, action: name });`, errors: [{ messageId: "actionNotLiteral" }] },
      { code: `createCrudService(table, { audit: { actionPrefix: "Wallet" } });`, errors: [{ messageId: "prefixInvalid" }] },
      { code: `createCrudService(table, { audit: { actionPrefix: prefix } });`, errors: [{ messageId: "prefixNotLiteral" }] },
    ],
  });
});

test("audit/action-naming: 注入された記録関数に渡す監査の入力も照合する", () => {
  ruleTester.run("action-naming", plugin.rules["action-naming"], {
    valid: [
      // messaging の直した後の形
      { code: `await deps.recordAudit({ targetType: "message_dispatch", targetId: id, action: "messaging.dispatch.bulk_sent" });` },
      { code: `await deps.recordAudit({ targetType: "message_dispatch", targetId: id, action: at ? "messaging.dispatch.scheduled" : "messaging.dispatch.sent" });` },
      { code: "recordAudit({ targetType: \"x\", targetId: id, action: `coupon.code.redeemed` });" },
      // 値が分からない動的な action は報告しない(注入の経路の受け渡しは正当。runtime が最後に投げる)
      { code: `deps.recordAudit({ targetType: "x", targetId: id, action: input.action });` },
      { code: `const action = pick(); deps.recordAudit({ targetType: "x", targetId: id, action });` },
      // 監査の入力の形でない(targetType が無い)オブジェクトは見ない
      { code: `dispatch({ type: "x", action: "openModal" });` },
      // 引数をそのまま渡す関数: 呼び出しの実引数が規則どおり
      {
        code: `function audit(group, action, metadata = {}) { return deps.recordAudit({ targetType: "user_group", targetId: group.id, action, metadata }); }
audit(g, "user_group.group.created"); audit(g, frozen ? "user_group.group.frozen" : "user_group.group.unfrozen");`,
      },
      // recordMany の配列の要素
      { code: `auditLogger.recordMany([{ targetType: "user", targetId: a, action: "user.status.changed" }]);` },
    ],
    invalid: [
      // messaging の事故の形(直す前): 注入された recordAudit 経由の camelCase
      { code: `await deps.recordAudit({ targetType: "message_dispatch", targetId: id, action: "messaging.dispatch.bulkSent" });`, errors: invalid },
      { code: `await deps.recordAudit({ targetType: "message_dispatch", targetId: id, action: "messaging.dispatch.testSent" });`, errors: invalid },
      // 三項の片側だけ違反
      { code: `deps.recordAudit({ targetType: "x", targetId: id, action: at ? "messaging.dispatch.scheduled" : "messaging.dispatch.Sent" });`, errors: invalid },
      { code: "recorder.record({ targetType: \"x\", targetId: id, action: `coupon.codeRedeemed` });", errors: invalid },
      // 段が 1 つしかない
      { code: `deps.recordAudit({ targetType: "x", targetId: id, action: "redeemed" });`, errors: invalid },
      // 変数に置いた入力・recordMany の配列の要素
      { code: `const entry = { targetType: "user", targetId: id, action: "user.Status.changed" }; await deps.recordAudit(entry);`, errors: invalid },
      { code: `auditLogger.recordMany([{ targetType: "user", targetId: a, action: "user.statusChanged" }]);`, errors: invalid },
      // userGroup の形: 引数をそのまま渡す関数の呼び出しの実引数
      {
        code: `async function audit(group, action) { await deps.recordAudit({ targetType: "user_group", targetId: group.id, action }); }
await audit(g, "user_group.group.created"); await audit(g, "user_group.group.memberAdded");`,
        errors: invalid,
      },
      {
        code: `const audit = (group, action) => deps.recordAudit({ targetType: "user_group", targetId: group.id, action: action });
audit(g, flag ? "user_group.group.Frozen" : "user_group.group.unfrozen");`,
        errors: invalid,
      },
    ],
  });
});
