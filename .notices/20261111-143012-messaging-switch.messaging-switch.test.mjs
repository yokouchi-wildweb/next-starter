// .notices/20261111-143012-messaging-switch.messaging-switch.test.mjs
// codemod messaging-switch の回帰テスト(fixture の fork。取り込み前の版は readOld で渡す)。
// 実行: pnpm test .notices/20261111-143012-messaging-switch.messaging-switch.test.mjs

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MESSAGING_CONFIG,
  NOTIFICATION_CONFIG,
  SWITCHES_FILE,
  handFixes,
  plan,
  readNotificationConfig,
  removeSwitches,
  rewriteSource,
  writeInbox,
} from "./20261111-143012-messaging-switch.messaging-switch.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, "20261111-143012-messaging-switch.messaging-switch.mjs");
const REPO = join(HERE, "..");

function fork(files) {
  const root = mkdtempSync(join(tmpdir(), "messaging-switch-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const noOld = () => null;
/** plan を書き出す(--apply と同じ) */
function applyPlan(root, result) {
  for (const [file, text] of result.writes) {
    if (text === null) spawnSync("rm", ["-f", join(root, file)]);
    else writeFileSync(join(root, file), text);
  }
}

// ---- 機械の書き換え ----

test("1: 受け取り箱の client の関数(形が同じ)を inboxClient の名前へ。呼ぶ所も直す", () => {
  const src = 'import { getUnreadCount, markAsRead } from "@/features/notification/services/client/userNotificationClient";\n\nconst n = await getUnreadCount();\nawait markAsRead(id);\nobj.markAsRead();\n';
  const { text } = rewriteSource(src, "a.ts");
  assert.equal(
    text,
    'import { getInboxUnreadCount, markInboxRead } from "@/features/core/messaging/services/client/inboxClient";\n\nconst n = await getInboxUnreadCount();\nawait markInboxRead(id);\nobj.markAsRead();\n',
  );
});

test("1: 別名の import は import の名前だけ直す(core の住所も読む)", () => {
  const src = 'import { markAllAsRead as readAll } from "@/features/core/notification/services/client/userNotificationClient";\nreadAll();\n';
  assert.equal(rewriteSource(src).text, 'import { markAllInboxRead as readAll } from "@/features/core/messaging/services/client/inboxClient";\nreadAll();\n');
});

test("1: 形の違う名前が混ざる import は書き換えず、手直しに全部出す", () => {
  const src = 'import { getUnreadCount, getMyNotificationsPage } from "@/features/notification/services/client/userNotificationClient";\n';
  assert.equal(rewriteSource(src).text, src);
  const fixes = handFixes(src, "a.ts");
  assert.ok(fixes.some((f) => f.includes("getMyNotificationsPage") && f.includes("listInbox")));
  assert.ok(fixes.some((f) => f.includes("getUnreadCount") && f.includes("getInboxUnreadCount")));
});

test("2: UnreadNotificationModal → InboxUnreadModal(JSX も)。別名は as で残す", () => {
  const src = 'import UnreadNotificationModal from "@/features/notification/components/common/UnreadNotificationModal";\n\nexport const X = () => <UnreadNotificationModal />;\n';
  assert.equal(
    rewriteSource(src).text,
    'import { InboxUnreadModal } from "@/features/core/messaging/components/InboxUnreadModal";\n\nexport const X = () => <InboxUnreadModal />;\n',
  );
  const aliased = 'import Modal from "@/features/core/notification/components/common/UnreadNotificationModal";\n<Modal />;\n';
  assert.equal(rewriteSource(aliased).text, 'import { InboxUnreadModal as Modal } from "@/features/core/messaging/components/InboxUnreadModal";\n<Modal />;\n');
});

test("3: findExistingIdempotencyKeys → existingIdempotencyKeys", () => {
  const src = "const sent = await messagingService.findExistingIdempotencyKeys(keys);\n";
  assert.equal(rewriteSource(src).text, "const sent = await messagingService.existingIdempotencyKeys(keys);\n");
});

test("4: MAIL_THEME_COLORS の import 先 → @/lib/mail(ほかの名前が混ざれば手直し)", () => {
  const src = 'import { MAIL_THEME_COLORS } from "@/features/core/mail/constants/colors";\n';
  assert.equal(rewriteSource(src).text, 'import { MAIL_THEME_COLORS } from "@/lib/mail";\n');
  const mixed = 'import { MAIL_THEME_COLORS, OTHER } from "@/features/mail/constants/colors";\n';
  assert.equal(rewriteSource(mixed).text, mixed);
  assert.ok(handFixes(mixed, "m.tsx").some((f) => f.includes("core/mail")));
});

test("6: notificationModal={null} を外す。要素を渡す所は手直し", () => {
  const src = "<UserLayout header={null} notificationModal={null}>\n  {children}\n</UserLayout>\n";
  assert.equal(rewriteSource(src).text, "<UserLayout header={null}>\n  {children}\n</UserLayout>\n");
  const element = "<UserLayout notificationModal={<MyModal />}>{children}</UserLayout>\n";
  assert.equal(rewriteSource(element).text, element);
  assert.ok(handFixes(element, "L.tsx").some((f) => f.startsWith("L.tsx:1:") && f.includes("messagingConfig.inbox")));
});

test("5: notification.config.ts の値を読む(リテラルだけ)", () => {
  assert.deepEqual(readNotificationConfig('export default { showUnreadModal: true, unreadModalPaths: ["/", "/wallet/*"] } satisfies NotificationOverride;\n'), {
    showUnreadModal: true,
    unreadModalPaths: ["/", "/wallet/*"],
  });
  assert.deepEqual(readNotificationConfig("export default {} satisfies NotificationOverride;\n"), {});
  assert.ok("problem" in readNotificationConfig("export default { showUnreadModal: flag };\n"));
});

test("5: messaging.config.ts の default export に inbox を足す(あれば何もしない)", () => {
  const empty = 'import type { MessagingOverride } from "@/features/messaging/config";\n\nexport default {} satisfies MessagingOverride;\n';
  const once = writeInbox(empty, { showUnreadModal: true, unreadModalPaths: ["/", "/wallet/*"] });
  assert.equal(once, 'import type { MessagingOverride } from "@/features/messaging/config";\n\nexport default { inbox: { showUnreadModal: true, unreadModalPaths: ["/", "/wallet/*"] } } satisfies MessagingOverride;\n');
  assert.equal(writeInbox(once, { showUnreadModal: false }), once);
  const withItems = "export default { smallSendMaxRecipients: 300, channels: { line: { enabled: true } } } satisfies MessagingOverride;\n";
  assert.equal(
    writeInbox(withItems, { showUnreadModal: true }),
    'export default { smallSendMaxRecipients: 300, channels: { line: { enabled: true } }, inbox: { showUnreadModal: true, unreadModalPaths: ["/"] } } satisfies MessagingOverride;\n',
  );
});

test("8: switches.config.ts の消えた機能の鍵を外す(値つきで返す)", () => {
  const header = "// 例: `export default { wallet: false } satisfies FeatureSwitches;`\n";
  const r = removeSwitches(`${header}export default { wallet: false, notification: true, notificationBroadcast: false } satisfies FeatureSwitches;\n`);
  assert.equal(r.text, `${header}export default { wallet: false } satisfies FeatureSwitches;\n`);
  assert.deepEqual(r.removed, [{ name: "notification", value: true }, { name: "notificationBroadcast", value: false }]);
  const first = removeSwitches("export default { notification: false, wallet: true } satisfies FeatureSwitches;\n");
  assert.equal(first.text, "export default { wallet: true } satisfies FeatureSwitches;\n");
  const only = removeSwitches("export default { notification: false } satisfies FeatureSwitches;\n");
  assert.equal(only.text, "export default {} satisfies FeatureSwitches;\n");
});

// ---- 手直しの一覧 ----

test("手直し: 旧 notification の hook と型は対応を添えて file:line で出す(書き換えない)", () => {
  const src = [
    'import { useMyNotificationsPage } from "@/features/notification/hooks/useMyNotificationsPage";',
    'import { useUnreadNotificationCount } from "@/features/core/notification/hooks/useUnreadNotificationCount";',
    'import type { MyNotification } from "@/features/notification/services/client/userNotificationClient";',
    'import { useCreateNotification } from "@/features/notification/hooks/useCreateNotification";',
    'import { NotificationTemplateForm } from "@/features/notificationTemplate/components/common/Form";',
  ].join("\n");
  assert.equal(rewriteSource(src).text, src);
  const fixes = handFixes(src, "N.tsx");
  assert.ok(fixes.some((f) => f.startsWith("N.tsx:1:") && f.includes("useInboxItems")));
  assert.ok(fixes.some((f) => f.startsWith("N.tsx:2:") && f.includes("useInboxUnreadCount")));
  assert.ok(fixes.some((f) => f.startsWith("N.tsx:3:") && f.includes("InboxItemDto")));
  assert.ok(fixes.some((f) => f.startsWith("N.tsx:4:") && f.includes("代わりは無い")));
  assert.ok(fixes.some((f) => f.startsWith("N.tsx:5:") && f.includes("notificationTemplate")));
});

test("手直し: 送る口・定数・テンプレート・BulkSendEmail・古い表・住所・監査・wallet の文面", () => {
  const cases = [
    ["await notificationService.sendToUserSafe(userId, input);", "sendMessage"],
    ["await messagingService.send({ userId });", "messagingService.sendMessage"],
    ["await messagingService.bulkSend({ userIds });", "sendMessageToMany"],
    ["const c: MessagingChannel = \"email\";", "defaultChannels"],
    ["export const RankUpEmail = createMailTemplate({});", "messages/views"],
    ['import { BulkSendEmailButton } from "@/components/BulkSendEmail";', "AdminBulkSend"],
    ["db.select().from(NotificationTable);", "listDispatches"],
    ['const url = "/api/notification/my/page";', "/api/me/messaging/inbox"],
    ['  "messaging.message.sent": "メッセージ送信",', "message_dispatches"],
    ["const copy: WalletExpirationNoticeCopy = x;", "expiringNotice.override.ts"],
    ["const img = resolveNotificationImage(x);", "inApp.image"],
  ];
  for (const [line, expect] of cases) {
    const fixes = handFixes(`${line}\n`, "f.ts");
    assert.ok(fixes.some((f) => f.startsWith("f.ts:1:") && f.includes(expect)), `${line} → ${expect}: ${fixes.join(" | ")}`);
  }
  // wallet の config の copy の鍵は wallet.config.ts の中だけ
  const walletConfig = "export default {\n  expiration: { coin: { notice: { expired: { channels: [\"email\"], copy: { emailSubject: \"x\" } } } } },\n};\n";
  assert.ok(handFixes(walletConfig, "src/config/features/wallet.config.ts").some((f) => f.includes("content.email.subject")));
  assert.deepEqual(handFixes("const copy = 1;\n", "src/other.ts"), []);
});

test("手直し: コメントの中の名前は出さない", () => {
  assert.deepEqual(handFixes("// notificationService を使っていた\n/* createMailTemplate */\n", "c.ts"), []);
});

// ---- 計画(fixture の fork) ----

const FORK = {
  "src/app/(user)/_layout/UserLayout.replace.tsx":
    'import UnreadNotificationModal from "@/features/notification/components/common/UnreadNotificationModal";\nexport const L = ({ children }) => <UserLayout notificationModal={null}>{children}<UnreadNotificationModal /></UserLayout>;\n',
  "src/features/shop/services/server/sendShipped.ts": "export const run = (keys) => messagingService.findExistingIdempotencyKeys(keys);\n",
  "src/features/shop/hooks/useNotices.ts": 'import { useMyNotifications } from "@/features/notification/hooks/useMyNotifications";\nexport const use = () => useMyNotifications();\n',
  "src/features/core/admin/menu/items/notificationTemplates.override.ts": "export const override = { hidden: true };\n",
  [NOTIFICATION_CONFIG]: 'export default { showUnreadModal: true, unreadModalPaths: ["/", "/wallet/*"] } satisfies NotificationOverride;\n',
  [MESSAGING_CONFIG]: "export default {} satisfies MessagingOverride;\n",
  [SWITCHES_FILE]: "export default { wallet: false, notification: true } satisfies FeatureSwitches;\n",
};

test("計画: 機械の書き換え・消す物・手直しを出し、--apply の後にもう一度走らせても何も書かない", () => {
  const root = fork(FORK);
  const result = plan(root, { readOld: noOld });
  const files = [...result.writes.keys()].sort();
  assert.deepEqual(files, [
    NOTIFICATION_CONFIG,
    SWITCHES_FILE,
    MESSAGING_CONFIG,
    "src/app/(user)/_layout/UserLayout.replace.tsx",
    "src/features/core/admin/menu/items/notificationTemplates.override.ts",
    "src/features/shop/services/server/sendShipped.ts",
  ].sort());
  assert.equal(result.writes.get(NOTIFICATION_CONFIG), null, "notification.config.ts は消す");
  assert.equal(result.writes.get("src/features/core/admin/menu/items/notificationTemplates.override.ts"), null);
  assert.match(result.writes.get(MESSAGING_CONFIG), /inbox: \{ showUnreadModal: true, unreadModalPaths: \["\/", "\/wallet\/\*"\] \}/);
  assert.equal(result.writes.get(SWITCHES_FILE), "export default { wallet: false } satisfies FeatureSwitches;\n");
  assert.ok(result.stopped.some((s) => s.includes("notification を開けていた")));
  assert.ok(result.stopped.some((s) => s.startsWith("src/features/shop/hooks/useNotices.ts:1:") && s.includes("useInboxItems")));

  applyPlan(root, result);
  assert.equal(existsSync(join(root, NOTIFICATION_CONFIG)), false);
  assert.match(readFileSync(join(root, "src/app/(user)/_layout/UserLayout.replace.tsx"), "utf8"), /<UserLayout>\{children\}<InboxUnreadModal \/>/);
  const again = plan(root, { readOld: (p) => (p === NOTIFICATION_CONFIG ? FORK[NOTIFICATION_CONFIG] : null) });
  assert.equal(again.writes.size, 0, `二度目に書く物: ${[...again.writes.keys()].join(", ")}`);
});

test("計画: 取り込み前の版(--from)の notification.config.ts を読む(取り込みで消えていても移す)", () => {
  const root = fork({ [MESSAGING_CONFIG]: "export default {} satisfies MessagingOverride;\n" });
  const result = plan(root, { readOld: (p) => (p === NOTIFICATION_CONFIG ? "export default { showUnreadModal: true } satisfies NotificationOverride;\n" : null) });
  assert.match(result.writes.get(MESSAGING_CONFIG), /inbox: \{ showUnreadModal: true, unreadModalPaths: \["\/"\] \}/);
});

test("上流の木で走らせると書く物も手直しも 0(上流の正当な古い名前は除く一覧にある)", () => {
  const result = plan(REPO, { readOld: noOld });
  assert.equal(result.writes.size, 0, [...result.writes.keys()].join(", "));
  assert.deepEqual(result.stopped, []);
});

test("CLI: 手直しが残れば exit 2、--json は機械向け", () => {
  const root = fork({ "src/a.ts": "await notificationService.sendToUserSafe(1);\n" });
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, [TOOL, "--json"], { cwd: root, encoding: "utf8", env });
  assert.equal(run.status, 2, run.stderr);
  const json = JSON.parse(run.stdout);
  assert.deepEqual(json.writes, []);
  assert.equal(json.stopped.length, 1);
  const clean = spawnSync(process.execPath, [TOOL], { cwd: fork({ "src/b.ts": "export const ok = 1;\n" }), encoding: "utf8", env });
  assert.equal(clean.status, 0, clean.stderr);
});
