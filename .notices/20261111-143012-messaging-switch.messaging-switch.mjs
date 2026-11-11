// .notices/20261111-143012-messaging-switch.messaging-switch.mjs
// 連絡の基盤の区切り messaging-switch(旧 notification・notificationTemplate・古い送る口・core/mail・BulkSendEmail の撤去、連絡の議会 l2)の fork の移行。
// fork のリポのルートで、上流を取り込んだ後・取り込みのコミットの前(HEAD = 取り込み前の fork)に走らせる。何度走らせても同じ結果になる。
//
//   node .notices/20261111-143012-messaging-switch.messaging-switch.mjs            # dry-run(既定、書かない)
//   node .notices/20261111-143012-messaging-switch.messaging-switch.mjs --apply    # 書く(消すファイルも消す)
//   --from <rev>(取り込み前の fork の版。既定 HEAD。notification.config.ts の値を読む)| --json(機械向けの出力)
//
// 機械で直す物(形が同じ名前だけ):
// 1. 受け取り箱の client の関数 getUnreadCount / markAsRead / markAllAsRead(notification/services/client/userNotificationClient)
//    → getInboxUnreadCount / markInboxRead / markAllInboxRead(@/features/core/messaging/services/client/inboxClient)
// 2. 未読のモーダル UnreadNotificationModal(default import)→ { InboxUnreadModal }(@/features/core/messaging/components/InboxUnreadModal)
// 3. messagingService.findExistingIdempotencyKeys → messagingService.existingIdempotencyKeys
// 4. MAIL_THEME_COLORS の import 先 @/features/(core/)mail/constants/colors → @/lib/mail
// 5. src/config/features/notification.config.ts の showUnreadModal / unreadModalPaths(取り込み前の版のリテラル)
//    → src/config/features/messaging.config.ts の inbox: { showUnreadModal, unreadModalPaths }、notification.config.ts は消す
// 6. UserLayout の notificationModal={null} を外す(未読のモーダルは slot でなくなり、既定は config で切)
// 7. 管理メニューの上書き src/features/core/admin/menu/items/{notifications,notificationTemplates}.override.ts を消す(項目が無くなった)
// 8. src/config/featureGate/switches.config.ts の消えた機能の鍵(notification・notificationBroadcast・notificationTemplate・
//    adminNotificationTemplates)を外す。値が true だった物は手直しにも出す(開ける先を選ぶ)
//
// 手で直す物(形が違うので書き換えず、file:line と対応を一覧に出す): 旧 notification の hook・型・service、notificationTemplate、
// 古い送る口 messagingService.send / bulkSend と消えた定数、createMailTemplate と core/mail、BulkSendEmail、古い表の直読み、
// /api/notification の住所、notificationModal に要素を渡す所、wallet の config の文面の鍵、監査の表示名 messaging.*
//
// 手順: 上流を取り込む(衝突は上流の版を採る。消えたファイルは消す)→ dry-run → 止めた物を確かめる → --apply →
// pnpm generate extensions・pnpm generate registry → pnpm typecheck → 手で直す物を直す → 取り込みのコミット。
// 手で直す物が残れば exit 2。この区切りのほかの codemod は無い

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";

export const NOTIFICATION_CONFIG = "src/config/features/notification.config.ts";
export const MESSAGING_CONFIG = "src/config/features/messaging.config.ts";
export const SWITCHES_FILE = "src/config/featureGate/switches.config.ts";
export const MENU_OVERRIDES = [
  "src/features/core/admin/menu/items/notifications.override.ts",
  "src/features/core/admin/menu/items/notificationTemplates.override.ts",
];
export const OLD_COLORS_FILE = "src/features/core/mail/constants/colors.ts";
/** 消えた門の機能(switches.config.ts の鍵) */
export const REMOVED_FEATURES = ["notification", "notificationBroadcast", "notificationTemplate", "adminNotificationTemplates"];

const SCAN_DIRS = ["src", "scripts"];
/**
 * 上流のファイルで古い名前を正しく持つ所(古い表の定義・写しの task・古い監査の表示名・住所の検査)。手直しの一覧に出さない。
 * 上流の木で走らせて手直しが 0 になることをテストが確かめる(増えたらここに足す)
 */
export const UPSTREAM_LEGIT = [
  "src/features/core/messaging/legacy/",
  "src/features/core/messaging/scripts/migrations/",
  "src/featureGate/checks/addressCheck.test.ts",
  "src/features/core/auditLog/presenters.ts",
];
const SCAN_EXT = /\.(ts|tsx|mts|cts|mjs|js|jsx)$/;

const NOTIF = String.raw`@/features/(?:core/)?notification`;
const NOTIF_TEMPLATE = String.raw`@/features/(?:core/)?notificationTemplate`;
const MAIL = String.raw`@/features/(?:core/)?mail`;
const INBOX_CLIENT = "@/features/core/messaging/services/client/inboxClient";
const INBOX_MODAL = "@/features/core/messaging/components/InboxUnreadModal";

/** 1 の対応(形が同じ) */
export const CLIENT_RENAMES = {
  getUnreadCount: "getInboxUnreadCount",
  markAsRead: "markInboxRead",
  markAllAsRead: "markAllInboxRead",
};

/** 旧 notification の公開の名前 → 新しい名前と違い(手直しの案内) */
export const NOTIFICATION_NAME_MAP = {
  useMyNotifications: "useInboxItems({ unreadOnly?, limit? })(@/features/core/messaging/hooks。useInfiniteScrollQuery のカーソルのモード: items・hasMore・loadMore・sentinelRef。notifications → items、mutate → revalidate)",
  useMyNotificationsPage: "useInboxItems(カーソルのモード。SWRInfinite の pages / setSize → items と loadMore、InfiniteScrollList に渡す)",
  useMyNotificationsCount: "代わりは無い(総数は数えない)。未読の数は useInboxUnreadCount",
  useUnreadNotificationCount: "useInboxUnreadCount()(返り値 { count, isLoading, error, revalidate })",
  useMarkNotificationAsRead: "useMarkInboxItemRead()(返り値 { markRead(id), isMarking, error }。一覧の印は useInboxItems の updateItems で read: true に)",
  useMarkAllNotificationsAsRead: "useMarkAllInboxRead()(返り値 { markAllRead(), isMarking, error })",
  MyNotification: "InboxItemDto(@/features/core/messaging/services/client/inboxClient。{ id, title, body, link, image, metadata, publishedAt, read }。readAt → read(真偽)、senderType は無い、link が増えた)",
  MyNotificationsPage: "InboxPage({ items, nextCursor })",
  getMyNotifications: "listInbox({ cursor?, limit?, unreadOnly? }) → { items, nextCursor }",
  getMyNotificationsPage: "listInbox({ cursor?, limit?, unreadOnly? }) → { items, nextCursor }",
  getMyNotificationsCount: "代わりは無い(未読の数は getInboxUnreadCount)",
  sendNotification: "連絡の定義 messages/<名前>.ts + サーバーの sendMessage / sendMessageToMany(管理の一斉送信は AdminBulkSend)",
  notificationService: "送る: 連絡の定義 messages/<名前>.ts(defineMessage、inApp の title / body / image)+ messagingService.sendMessage / sendMessageToMany。読む: messagingService.listInbox / inboxUnreadCount / markInboxRead / markAllInboxRead",
  resolveNotificationImage: "画像は連絡の定義の inApp.image(保存値)か送る時の内容に渡す(storage の台帳に結ぶのは送る口)",
  notificationConfig: "messagingConfig.inbox(@/features/core/messaging/config。showUnreadModal・unreadModalPaths)",
  UnreadNotificationModal: "InboxUnreadModal(@/features/core/messaging/components/InboxUnreadModal)",
  NotificationDetailModal: "InboxItemDetail(@/features/core/messaging/components/common/InboxItemDetail)を Modal に入れる",
};

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// ---- import の字面 ----

const IMPORT_RE = /import\s+(type\s+)?([\s\S]*?)\s+from\s+(["'])([^"']+)\3\s*;?/g;

/** ファイルの import(位置つき) */
export function readImports(text) {
  const out = [];
  const code = stripComments(text);
  for (const m of code.matchAll(IMPORT_RE)) {
    const clause = m[2].trim();
    const named = /\{([\s\S]*)\}/.exec(clause)?.[1] ?? "";
    const defaultName = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause)?.[1] ?? null;
    const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause)?.[1] ?? null;
    const specifiers = named
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const t = /^(type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(s);
        return t ? { imported: t[2], local: t[3] ?? t[2], type: Boolean(t[1]) } : { imported: s, local: s, type: false };
      });
    out.push({ start: m.index, end: m.index + m[0].length, text: text.slice(m.index, m.index + m[0].length), typeOnly: Boolean(m[1]), defaultName, namespace, specifiers, source: m[4] });
  }
  return out;
}

/** 名前の識別子を置き換える(プロパティのアクセス `.name` と import の行は除く) */
function renameIdentifier(text, from, to, skipRanges = []) {
  const re = new RegExp(`(?<![\\w$.])${from}(?![\\w$])`, "g");
  return text.replace(re, (m, offset) => (skipRanges.some(([s, e]) => offset >= s && offset < e) ? m : to));
}

// ---- 1 + 2 + 4: import の付け替え ----

/**
 * 1 ファイルの機械の書き換え(純関数)
 * @returns {{ text: string, notes: string[] }}
 */
export function rewriteSource(text, file = "") {
  let next = text;
  const notes = [];
  // 1. client の関数
  for (const imp of readImports(next).reverse()) {
    if (!new RegExp(`^${NOTIF}/services/client/userNotificationClient$`).test(imp.source)) continue;
    if (imp.defaultName || imp.namespace || imp.specifiers.length === 0) continue;
    if (!imp.specifiers.every((s) => s.imported in CLIENT_RENAMES)) continue; // 混ざる時は手直し
    const specs = imp.specifiers.map((s) => {
      const to = CLIENT_RENAMES[s.imported];
      return s.local === s.imported ? `${s.type ? "type " : ""}${to}` : `${s.type ? "type " : ""}${to} as ${s.local}`;
    });
    const replacement = `import ${imp.typeOnly ? "type " : ""}{ ${specs.join(", ")} } from "${INBOX_CLIENT}";`;
    next = next.slice(0, imp.start) + replacement + next.slice(imp.end);
    const importRange = [[imp.start, imp.start + replacement.length]];
    for (const s of imp.specifiers.filter((x) => x.local === x.imported)) next = renameIdentifier(next, s.imported, CLIENT_RENAMES[s.imported], importRange);
    notes.push(`${file}: ${imp.specifiers.map((s) => `${s.imported} → ${CLIENT_RENAMES[s.imported]}`).join("・")}(inboxClient)`);
  }
  // 2. 未読のモーダル
  for (const imp of readImports(next).reverse()) {
    if (!new RegExp(`^${NOTIF}/components/common/UnreadNotificationModal$`).test(imp.source)) continue;
    if (!imp.defaultName || imp.specifiers.length > 0 || imp.namespace) continue;
    const local = imp.defaultName;
    const replacement = local === "UnreadNotificationModal" ? `import { InboxUnreadModal } from "${INBOX_MODAL}";` : `import { InboxUnreadModal as ${local} } from "${INBOX_MODAL}";`;
    next = next.slice(0, imp.start) + replacement + next.slice(imp.end);
    if (local === "UnreadNotificationModal") next = renameIdentifier(next, "UnreadNotificationModal", "InboxUnreadModal", [[imp.start, imp.start + replacement.length]]);
    notes.push(`${file}: UnreadNotificationModal → InboxUnreadModal(出すかは messagingConfig.inbox.showUnreadModal)`);
  }
  // 3. 二重送信の鍵の照会の名前
  if (/\.findExistingIdempotencyKeys\b/.test(next)) {
    next = next.replace(/\.findExistingIdempotencyKeys\b/g, ".existingIdempotencyKeys");
    notes.push(`${file}: messagingService.findExistingIdempotencyKeys → existingIdempotencyKeys`);
  }
  // 4. メールの色
  for (const imp of readImports(next).reverse()) {
    if (!new RegExp(`^${MAIL}/constants/colors$`).test(imp.source)) continue;
    if (imp.defaultName || imp.namespace || !imp.specifiers.every((s) => s.imported === "MAIL_THEME_COLORS")) continue;
    next = `${next.slice(0, imp.start)}${imp.text.replace(imp.source, "@/lib/mail")}${next.slice(imp.end)}`;
    notes.push(`${file}: MAIL_THEME_COLORS の import 先 → @/lib/mail`);
  }
  // 6. notificationModal={null}
  if (/\s+notificationModal=\{\s*null\s*\}/.test(next)) {
    next = next.replace(/\s+notificationModal=\{\s*null\s*\}/g, "");
    notes.push(`${file}: notificationModal={null} を外した(未読のモーダルは messagingConfig.inbox.showUnreadModal、既定 切)`);
  }
  return { text: next, notes };
}

// ---- 手直しの一覧 ----

/** 字面の手直しの規則(行ごと)。ファイルの絞り込み files は省略 = 全部 */
export const HAND_RULES = [
  { re: /\bnotificationService\b/, msg: () => `notificationService は消えた → ${NOTIFICATION_NAME_MAP.notificationService}` },
  { re: /\bmessagingService\.(send|bulkSend)\s*\(/, msg: (m) => `messagingService.${m[1]} は消えた → 連絡の定義 messages/<名前>.ts + messagingService.${m[1] === "send" ? "sendMessage" : "sendMessageToMany"}(呼び方は ${m[1] === "send" ? "sendMessage(message, { recipient: { userId }, vars, idempotencyKey? })" : "sendMessageToMany(message, { recipients | audience, vars, idempotencyKey? })"}、message = messages/<名前>.ts の定義。src/features/core/messaging/README.md)` },
  { re: /\b(MessagingChannel|MESSAGING_CHANNELS|ALL_MESSAGING_CHANNELS|MESSAGING_AUDIT_ACTIONS|MessagingAuditAction|MESSAGE_BODY_MAX_LENGTH|MESSAGE_EMAIL_SUBJECT_MAX_LENGTH|MESSAGE_NOTIFICATION_TITLE_MAX_LENGTH|DEFAULT_BULK_CHUNK_SIZE)\b/, msg: (m) => `${m[1]} は消えた(古い送る口の定数)→ 経路は連絡の定義の defaultChannels / 送る時の channels、監査は回の記録 message_dispatches`, skipImportOnly: false },
  { re: /\bcreateMailTemplate\b/, msg: () => "createMailTemplate は消えた → 連絡の定義 messages/<名前>.ts(email の subject / paragraphs)+ 描き方 messages/views/<名前>.tsx" },
  { re: /@\/components\/BulkSendEmail\b|\bBulkSendEmailButton\b/, msg: () => "src/components/BulkSendEmail は消えた → 管理の一斉送信 AdminBulkSend(@/features/core/messaging/components/AdminBulkSend)+ 送る相手の受け口の項目 src/features/core/messaging/bulkSendTargets/<名前>.ts の export const bulkSendTarget: MessageBulkSendTarget(例 bankTransferReview.ts。置いたら pnpm generate extensions)" },
  { re: /\b(NotificationTable|NotificationReadTable|NotificationReadStateTable|NotificationTemplateTable)\b|\bnotification_(reads|read_states|templates)\b/, msg: (m) => `古い表 ${m[0]} の直読み → 受け取り箱は messagingService.listInbox / inboxUnreadCount、利用者ごとの送った記録は messagingService.listUserMessageHistory(userId, { cursor?, limit? })、回の中身は findDispatch / listDeliveries。一度だけ送る確かめは表を読まず sendMessage に idempotencyKey を渡す(同じ鍵の 2 回目は 409 = 送り済み)` },
  { re: /["'`]messaging\.message\.(sent|failed)["'`]/, msg: (m) => `監査の action ${m[0]} はもう書かれない → 利用者ごとの送った記録は messagingService.listUserMessageHistory(userId, { cursor?, limit? })、回は listDispatches / findDispatch / listDeliveries。監査の設定の表示名の行は消す` },
  { re: /["'`]\/api\/notification(Template)?\b/, msg: (m) => (m[1] ? "/api/notificationTemplate は消えた(代わりは無い。テンプレートは連絡の定義と上書き)" : "/api/notification/** は消えた → 本人の受け取り箱 /api/me/messaging/inbox(GET 一覧・/unread-count・/[id]/read・/read-all)。client は inboxClient") },
  { re: /\bnotificationModal\b/, msg: () => "UserLayout の notificationModal は消えた → 既定の未読のモーダルは messagingConfig.inbox.showUnreadModal で出す / 切る。自前のモーダルは config で切って UserLayout.replace に置く" },
  { re: /\b(WalletExpirationNoticeCopy|WALLET_PRE_EXPIRY_NOTICE_COPY|WALLET_EXPIRED_NOTICE_COPY|preExpiryNoticeCopy|expiredNoticeCopy)\b/, msg: (m) => `wallet の文面の設定 ${m[1]} は消えた → ${WALLET_COPY_MAPPING}` },
  { re: /(?:^|[{,\s])(copy|titleSuffix|bodyLabels)\s*:/, files: /src\/config\/features\/wallet\.config\.ts$/, msg: (m) => `wallet の config の ${m[1]} は消えた → ${WALLET_COPY_MAPPING}` },
  { re: /\benableNotificationTemplates\b/, msg: () => "enableNotificationTemplates は消えた(テンプレートの管理画面は無い。消す)" },
  { re: /\bnotificationConfig\b/, msg: () => `notificationConfig は消えた → ${NOTIFICATION_NAME_MAP.notificationConfig}` },
  { re: /\bresolveNotificationImage\b/, msg: () => `resolveNotificationImage は消えた → ${NOTIFICATION_NAME_MAP.resolveNotificationImage}` },
  { re: /\bfindExistingIdempotencyKeys\b/, msg: () => "findExistingIdempotencyKeys は消えた → messagingService.existingIdempotencyKeys(keys) → Set(回の表と鍵の移し先の表の両方を見る)" },
];

/** wallet の文面の鍵の対応 */
export const WALLET_COPY_MAPPING =
  "連絡の定義の上書き src/features/core/wallet/messages/<名前>.override.ts(export const messageOverride: MessageOverride)。" +
  "予告の段の copy・preExpiryNoticeCopy → expiringNotice.override.ts、本通知 expired.copy・expiredNoticeCopy → expiredNotice.override.ts、" +
  "adjustmentNotification.titleSuffix / bodyLabels → adjustmentNotice.override.ts。" +
  "鍵: emailSubject → content.email.subject、emailBody → content.email.paragraphs[2](本文の段落。[0] 札・[1] 宛名は残す)、notificationTitle → content.inApp.title、notificationBody → content.inApp.body。" +
  "{{名前}} の差し込みはそのまま使える。段ごと・通貨ごとの文面は無い(段は {{daysBefore}} で書き分ける)";

/** 1 ファイルの手直しの一覧(純関数。text は機械の書き換えの後) */
export function handFixes(text, file) {
  const out = [];
  const code = stripComments(text);
  const lines = code.split("\n");
  // import の一つずつ(旧 notification・notificationTemplate・core/mail)
  for (const imp of readImports(text)) {
    const at = `${file}:${lineOf(text, imp.start)}`;
    if (new RegExp(`^${NOTIF_TEMPLATE}(/|$)`).test(imp.source)) {
      out.push(`${at}: ${imp.source} は消えた(notificationTemplate。代わりは連絡の定義 messages/<名前>.ts と上書き、管理の一覧は無い)`);
      continue;
    }
    if (new RegExp(`^${NOTIF}(/|$)`).test(imp.source)) {
      const names = [imp.defaultName, imp.namespace, ...imp.specifiers.map((s) => s.imported)].filter(Boolean);
      for (const name of names.length > 0 ? names : [imp.source]) {
        const to = NOTIFICATION_NAME_MAP[name] ?? (CLIENT_RENAMES[name] ? `${CLIENT_RENAMES[name]}(inboxClient。同じ import の中に形の違う名前があるので機械では直さなかった)` : "代わりは無い(管理の CRUD・送信の hook と部品は消えた。管理の一斉送信は AdminBulkSend、回の一覧は管理の連絡の画面)");
        out.push(`${at}: ${name}(${imp.source})→ ${to}`);
      }
      continue;
    }
    if (new RegExp(`^${MAIL}(/|$)`).test(imp.source)) {
      out.push(`${at}: ${imp.source} は消えた(core/mail)→ 色は @/lib/mail の MAIL_THEME_COLORS(pnpm generate が src/styles から作る)、テンプレートは連絡の定義 + messages/views`);
    }
  }
  const importLines = new Set(readImports(text).flatMap((imp) => {
    const a = lineOf(text, imp.start);
    const b = lineOf(text, imp.end);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }));
  lines.forEach((line, i) => {
    for (const rule of HAND_RULES) {
      if (rule.files && !rule.files.test(file)) continue;
      const m = rule.re.exec(line);
      if (!m) continue;
      // import の行は上の import ごとの案内に任せる(@/components/BulkSendEmail など import そのものが要点の物は残す)
      if (importLines.has(i + 1) && !/BulkSendEmail|createMailTemplate/.test(m[0])) continue;
      out.push(`${file}:${i + 1}: ${rule.msg(m)}`);
    }
  });
  return [...new Set(out)];
}

// ---- 5: notification.config.ts → messaging.config.ts ----

const unwrap = (node) => {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node;
};

/** default export のオブジェクトの値(真偽・文字列の配列のリテラルだけ。ほか = { problem }) */
export function readNotificationConfig(text) {
  const source = ts.createSourceFile("x.ts", text, ts.ScriptTarget.Latest, true);
  const st = source.statements.find((s) => ts.isExportAssignment(s));
  const obj = st ? unwrap(st.expression) : null;
  if (!obj || !ts.isObjectLiteralExpression(obj)) return { problem: "default export がオブジェクトのリテラルでない" };
  const out = {};
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) return { problem: `${prop.getText(source)} が読めない` };
    const key = prop.name.getText(source).replace(/["']/g, "");
    const value = unwrap(prop.initializer);
    if (key === "showUnreadModal") {
      if (value.kind === ts.SyntaxKind.TrueKeyword) out.showUnreadModal = true;
      else if (value.kind === ts.SyntaxKind.FalseKeyword) out.showUnreadModal = false;
      else return { problem: "showUnreadModal が真偽のリテラルでない" };
    } else if (key === "unreadModalPaths") {
      if (!ts.isArrayLiteralExpression(value) || !value.elements.every((e) => ts.isStringLiteralLike(e))) return { problem: "unreadModalPaths が文字列のリテラルの配列でない" };
      out.unreadModalPaths = value.elements.map((e) => e.text);
    } else return { problem: `鍵 ${key} の行き先が無い` };
  }
  return out;
}

/** messaging.config.ts の default export に inbox を書く(既にあれば同じ本文 = 何もしない。書けなければ null) */
export function writeInbox(text, inbox) {
  const head = /^[ \t]*export\s+default\s*\{/m.exec(text);
  if (!head) return null;
  const open = head.index + head[0].length - 1;
  // 対の閉じ括弧
  let depth = 0;
  let close = -1;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close < 0) return null;
  const inner = text.slice(open + 1, close);
  if (/(^|[\s{,])inbox\s*:/.test(inner)) return text;
  const paths = (inbox.unreadModalPaths ?? ["/"]).map((p) => JSON.stringify(p)).join(", ");
  const item = `inbox: { showUnreadModal: ${inbox.showUnreadModal ?? false}, unreadModalPaths: [${paths}] }`;
  const body = inner.trim().replace(/,\s*$/, "");
  return `${text.slice(0, open)}{ ${body === "" ? item : `${body}, ${item}`} }${text.slice(close + 1)}`;
}

// ---- 8: switches.config.ts ----

/** 消えた機能の鍵を外す(行の頭の export default のオブジェクトだけ。値は真偽のリテラル)。{ text, removed: [{ name, value }] } */
export function removeSwitches(text, names = REMOVED_FEATURES) {
  const head = /^[ \t]*export\s+default\s*\{/m.exec(text);
  if (!head) return { text, removed: [] };
  const open = head.index + head[0].length - 1;
  const close = text.indexOf("}", open);
  const items = text
    .slice(open + 1, close)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const removed = [];
  const kept = items.filter((item) => {
    const m = /^["']?([A-Za-z_$][\w$]*)["']?\s*:\s*(true|false)$/.exec(item);
    if (!m || !names.includes(m[1])) return true;
    removed.push({ name: m[1], value: m[2] === "true" });
    return false;
  });
  if (removed.length === 0) return { text, removed };
  const body = kept.length === 0 ? "{}" : `{ ${kept.join(", ")} }`;
  return { text: `${text.slice(0, open)}${body}${text.slice(close + 1)}`, removed };
}

// ---- 走らせる ----

function walk(root, rel, acc = []) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return acc;
  for (const name of readdirSync(abs)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const child = `${rel}/${name}`;
    if (statSync(join(root, child)).isDirectory()) walk(root, child, acc);
    else acc.push(child);
  }
  return acc;
}

function gitShow(root, rev, path) {
  try {
    return execFileSync("git", ["show", `${rev}:${path}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

/** 計画を立てる(書かない)。writes の値 null = 消す */
export function plan(root, { from = "HEAD", readOld = (p) => gitShow(root, from, p) } = {}) {
  const out = { writes: new Map(), notes: [], stopped: [] };
  const read = (p) => (out.writes.has(p) ? out.writes.get(p) : existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);
  const write = (p, text) => {
    if (text !== read(p)) out.writes.set(p, text);
  };
  // 7 管理メニューの上書き
  for (const file of MENU_OVERRIDES) {
    if (read(file) !== null) {
      write(file, null);
      out.notes.push(`${file} を消した(上流の項目が無くなった)`);
    }
  }
  // 5 未読のモーダルの値
  const oldConfig = readOld(NOTIFICATION_CONFIG) ?? read(NOTIFICATION_CONFIG);
  if (oldConfig !== null) {
    const values = readNotificationConfig(oldConfig);
    if ("problem" in values) out.stopped.push(`${NOTIFICATION_CONFIG}: ${values.problem}(${MESSAGING_CONFIG} の inbox: { showUnreadModal, unreadModalPaths } に手で移す)`);
    else if (Object.keys(values).length > 0) {
      const current = read(MESSAGING_CONFIG);
      const next = current === null ? null : writeInbox(current, values);
      if (next === null) out.stopped.push(`${MESSAGING_CONFIG}: default export が読めない(inbox: ${JSON.stringify(values)} を手で書く)`);
      else if (next !== current) {
        write(MESSAGING_CONFIG, next);
        out.notes.push(`${MESSAGING_CONFIG}: inbox ← ${NOTIFICATION_CONFIG} の ${Object.keys(values).join("・")}`);
      }
    }
    if (read(NOTIFICATION_CONFIG) !== null) {
      write(NOTIFICATION_CONFIG, null);
      out.notes.push(`${NOTIFICATION_CONFIG} を消した(持ち主の notification が無くなった)`);
    }
  }
  // 8 門の値
  const switches = read(SWITCHES_FILE);
  if (switches !== null) {
    const { text, removed } = removeSwitches(switches);
    if (removed.length > 0) {
      write(SWITCHES_FILE, text);
      out.notes.push(`${SWITCHES_FILE}: ${removed.map((r) => `${r.name}: ${r.value}`).join("・")} を外した(機能が無くなった)`);
      for (const r of removed.filter((x) => x.value)) {
        out.stopped.push(`${SWITCHES_FILE}: ${r.name} を開けていた → 開ける先を選ぶ: お知らせの一覧のページ messagingInbox(既定 閉)・未読のモーダル messagingConfig.inbox.showUnreadModal・管理の回の一覧 messagingDispatches(既定 開)。受け取り箱の API は常に開`);
      }
    }
  }
  // 古い色のファイル(fork が書き換えた生成物)
  if (read(OLD_COLORS_FILE) !== null) out.stopped.push(`${OLD_COLORS_FILE}: core/mail は消えた。色は lib/mail/generated/themeColors.ts(pnpm generate が src/styles の palette から作る)。値を確かめて消す`);
  // 1-4・6 と手直し
  for (const dir of SCAN_DIRS) {
    for (const file of walk(root, dir).filter((f) => SCAN_EXT.test(f))) {
      const text = read(file);
      if (text === null) continue;
      const { text: next, notes } = rewriteSource(text, file);
      if (next !== text) {
        write(file, next);
        out.notes.push(...notes);
      }
      if (!UPSTREAM_LEGIT.some((p) => file === p || (p.endsWith("/") && file.startsWith(p)))) out.stopped.push(...handFixes(next, file));
    }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fromIndex = args.indexOf("--from");
  const from = fromIndex >= 0 ? args[fromIndex + 1] : "HEAD";
  const root = process.cwd();
  const result = plan(root, { from });
  if (args.includes("--json")) {
    console.log(JSON.stringify({ writes: [...result.writes.entries()].map(([file, text]) => ({ file, delete: text === null })), notes: result.notes, stopped: result.stopped }, null, 2));
  } else {
    console.log(`書く物 ${result.writes.size}${apply ? "" : "(dry-run、--apply で書く)"}:`);
    for (const [file, text] of result.writes) console.log(`  ${text === null ? "消す " : ""}${file}`);
    for (const note of result.notes) console.log(`  - ${note}`);
    if (result.stopped.length > 0) {
      console.log(`\n手で直す物 ${result.stopped.length}:`);
      for (const s of result.stopped) console.log(`  - ${s}`);
    }
  }
  if (apply) {
    for (const [file, text] of result.writes) {
      if (text === null) rmSync(join(root, file), { force: true });
      else writeFileSync(join(root, file), text);
    }
  }
  if (result.stopped.length > 0) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
