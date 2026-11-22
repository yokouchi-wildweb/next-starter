#!/usr/bin/env node
// .notices/20261122-134000-messaging-records.codemod.mjs
// 区切り messaging-records(管理者の送信の作り直し: 定義連絡 / 自由連絡・システムテンプレートの廃止・recordTargets・埋め込み情報の
// コードの名前 vars、連絡の議会 r14 D179〜D206)の語の対応表と、それを読む fork の移行の道具。
// fork のリポのルートで、上流を取り込んだ後・取り込みのコミットの前に走らせる。何度走らせても同じ結果になる。
//
//   node .notices/20261122-134000-messaging-records.codemod.mjs              # dry-run(既定、書かない)
//   node .notices/20261122-134000-messaging-records.codemod.mjs --apply      # 書く(ファイルの移しも)
//   --json(機械向けの出力)| --owner <名前>=<ドメイン>(繰り返し可。一覧の対象の項目 bulkSendTargets/<名前>.ts の移し先のドメイン)
//   --upstream <rev>(取り込んだ上流の版。既定 MERGE_HEAD。上流と同じ中身のファイルは見ない)
//
// 語の対応表 VOCAB(1 つの配列。後の指令はここに行を足す。notice の旧 → 新もここから作る、D203):
// - kind code-name: コードの名前。as export = 上流のモジュール(from の下)から import する名前 / as member = 上流の型の
//   プロパティ / as declaration = 受け口の項目のファイル(in の下)が export する名前。new null = 消えた(手で直す)
// - kind path: ファイル・フォルダ。new の {owner} は --owner で決める。new null = 消えた(手で直す)
// - kind word: 開発の語(注釈・README)。書き換えず、fork のファイルの注釈に出る所を一覧に出すだけ(手で直す)
// - order: その改名を上流で行う指令(S1〜S8)、note: 説明・手直しの案内、hand: true = 書き換えた所も handStep として止まる一覧に出す
//
// 機械で直す物(名前だけでは書き換えない。TypeScript の検査器の symbol と型で確かめる):
// 1. path: fork のファイルを新しい置き場へ移し(git の追跡下なら git mv)、その置き場を指す import の指定子を直す
// 2. export: 上流のモジュールから import した古い名前を新しい名前へ。別名の無い import はファイルの中の参照(同じ symbol)も
// 3. declaration: 受け口の項目のファイルが export する古い名前(例 export const bulkSendTarget)を新しい名前へ
// 4. member: 受け手の型(か文脈の型)が上流で新しい名前を宣言し古い名前を持たない時だけ、x.old / x["old"] / { old: … } /
//    { old } = x / <C old={…}> を書き換える(1〜3 を当てた後の木で型を求める)
//
// 止まる一覧(書き換えず file:line と理由を出す): namespace(import * as / export * from 上流)・reexport(export { 古い名前 } from
// 上流: fork の公開の名前が変わる)・nameTaken(新しい名前がファイルに既にある)・dynamic(上流の import() / require)・
// untyped(受け手の型が分からない。上流を読むファイルだけ)・removed(消えた名前・置き場。note に代わり)・handStep(書き換えたが
// 形も変わった物。note の手直し)・ownerUnknown(--owner が無い)・targetExists(移し先に既にある)・word(開発の語)
//
// fork の手順: 上流を取り込む(衝突は上流の版を採る)→ dry-run → 止まる一覧を確かめる → --apply(--owner を付けて)→
// pnpm generate extensions・pnpm generate registry → pnpm typecheck → 止まる一覧を手で直す → 取り込みのコミット
// exit 0(止まる物があっても)/ 2 = 引数の誤り

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export const NOTICE_ID = "20261122-134000-messaging-records";

/** 上流の連絡のモジュール(export の行の既定の from、member の行の型の置き場) */
export const UPSTREAM_DIRS = ["src/lib/messaging", "src/features/core/messaging"];

const LIB = ["src/lib/messaging"];
const DOMAIN = ["src/features/core/messaging"];
const BOTH = UPSTREAM_DIRS;
const M = "src/features/core/messaging";

const ex = (old, next, order, note = "", from = BOTH) => ({ kind: "code-name", as: "export", old, new: next, order, note, from });
const mem = (old, next, order, note = "") => ({ kind: "code-name", as: "member", old, new: next, order, note });
const dir = (old, next, order, note = "") => ({ kind: "path", old, new: next, order, note });
const word = (old, next, order, match, note = "") => ({ kind: "word", old, new: next, order, match, note });

const S2_DISPATCH = "送信の記録の embedded_values は vars の列に 1 つ(D202・AMENDMENT 1)。DB は pnpm task messaging:merge-dispatch-vars を db:push の前に";
const S2_SYSTEM = "システムテンプレートの廃止(D171・D201): 自由連絡はレイアウトを直に選んで送る。テンプレートは DB の物だけ。手で直す";
const S3_TARGET = "一覧の対象の受け口 bulkSendTargets → 記録の宛先 recordTargets(D182 (5)・D190・D195)。受け口ではなく、項目は持ち主のドメインの recordTargets/<名前>.ts";

/** 語の対応表(旧 → 新)。1 つの場所: 後の指令はここに行を足す */
export const VOCAB = [
  // ── S1 埋め込み情報のコードの名前 embedded → vars(D205、議会の答え D1: 共通・enricher を含む全体も vars。enrichers の受け口の名前はそのまま)
  ex("MESSAGE_COMMON_EMBEDDED", "MESSAGE_COMMON_VARS", "S1", "", LIB),
  ex("MessageCommonEmbedded", "MessageCommonVar", "S1", "", LIB),
  ex("MessageEmbeddedName", "MessageNamedVar", "S1", "MessageVarName は定義の varNames の型として既にある", LIB),
  ex("MESSAGE_EMBEDDED_TYPES", "MESSAGE_VAR_TYPES", "S1", "", LIB),
  ex("MESSAGE_EMBEDDED_TYPE_LABELS", "MESSAGE_VAR_TYPE_LABELS", "S1", "", LIB),
  ex("EMBEDDED_TYPE_SUFFIX", "VAR_TYPE_SUFFIX", "S1", "", LIB),
  ex("displayEmbeddedValues", "displayVarValues", "S1", "", LIB),
  ex("embeddedDisplayText", "varDisplayText", "S1", "", LIB),
  ex("embeddedTextOf", "varTextOf", "S1", "", LIB),
  ex("embeddedTypeShape", "varTypeShape", "S1", "", LIB),
  ex("embeddedValueSchema", "varValueSchema", "S1", "", LIB),
  ex("embeddedValuesSchema", "varValuesSchema", "S1", "", LIB),
  ex("messageEmbeddedDeclarationSchema", "messageVarDeclarationSchema", "S1", "", LIB),
  ex("MessageEmbeddedDeclaration", "MessageVarDeclaration", "S1", "", LIB),
  ex("MessageEmbeddedType", "MessageVarType", "S1", "", LIB),
  ex("checkEmbeddedCatalog", "checkVarCatalog", "S1", "", LIB),
  ex("embeddedCatalog", "varCatalog", "S1", "", LIB),
  ex("resolveEmbeddedName", "resolveVarName", "S1", "", LIB),
  ex("MessageEmbeddedCatalog", "MessageVarCatalog", "S1", "", LIB),
  ex("MessageEmbeddedEntry", "MessageVarEntry", "S1", "", LIB),
  ex("MessageEmbeddedProblem", "MessageVarProblem", "S1", "", LIB),
  ex("MessageEmbeddedProblemCode", "MessageVarProblemCode", "S1", "", LIB),
  ex("MessageEmbeddedSource", "MessageVarSource", "S1", "", LIB),
  ex("embeddedVariableMap", "varMap", "S1", "", LIB),
  ex("findEmbedded", "findVar", "S1", "", LIB),
  ex("EMBEDDED_KEY_PATTERN", "VAR_KEY_PATTERN", "S1", "", LIB),
  ex("EMBEDDED_ALIAS_PATTERN", "VAR_ALIAS_PATTERN", "S1", "", LIB),
  ex("messageSharedEmbedded", "messageSharedVars", "S1", "", DOMAIN),
  ex("messageEmbeddedCatalog", "messageVarCatalog", "S1", "", DOMAIN),
  ex("templateEmbeddedCatalog", "templateVarCatalog", "S1", "", DOMAIN),
  ex("templateEmbeddedOf", "templateVarsOf", "S1", "", DOMAIN),
  ex("canonicalEmbeddedNames", "canonicalVarNames", "S1", "", DOMAIN),
  ex("AdminEmbeddedEntry", "AdminVarEntry", "S1", "", DOMAIN),
  ex("EmbeddedDeclarationDraft", "VarDeclarationDraft", "S1", "", DOMAIN),
  ex("emptyEmbeddedDraft", "emptyVarDraft", "S1", "", DOMAIN),
  ex("embeddedValuesForInput", "varValuesForInput", "S1", "", DOMAIN),
  ex("embeddedPreviewValues", "varPreviewValues", "S1", "", DOMAIN),
  ex("missingEmbedded", "missingVars", "S1", "", DOMAIN),
  ex("useEmbeddedInfoTags", "useVarTags", "S1", "", DOMAIN),
  ex("UseEmbeddedInfoTagsOptions", "UseVarTagsOptions", "S1", "", DOMAIN),
  ex("EMBEDDED_INFO_USAGE", "VAR_USAGE", "S1", "", DOMAIN),
  ex("EmbeddedInfoTags", "VarTags", "S1", "部品(T3)", DOMAIN),
  ex("EmbeddedInfoTagsProps", "VarTagsProps", "S1", "", DOMAIN),
  ex("EmbeddedInfoPopover", "VarPopover", "S1", "部品(T3)", DOMAIN),
  ex("EmbeddedInfoPopoverProps", "VarPopoverProps", "S1", "", DOMAIN),
  ex("SendEmbeddedInputs", "SendVarInputs", "S1", "部品(T3)", DOMAIN),
  ex("SendEmbeddedInputsProps", "SendVarInputsProps", "S1", "", DOMAIN),
  ex("TemplateEmbeddedInfoModal", "TemplateVarsModal", "S1", "部品(T3)", DOMAIN),
  ex("TemplateEmbeddedInfoModalProps", "TemplateVarsModalProps", "S1", "", DOMAIN),
  ex("TemplateEmbeddedInfoRow", "TemplateVarRow", "S1", "", DOMAIN),
  mem("embedded", "vars", "S1", "テンプレート・テンプレートの版・DTO・送る入力・上書きの詳細・useSendTemplateText の状態。DB の列 message_templates / versions の embedded → vars は [user-run] db:push(T2)"),
  mem("embeddedDeclarations", "varDeclarations", "S1"),
  mem("embeddedEditor", "varsEditor", "S1"),
  mem("embeddedForInput", "varsForInput", "S1"),
  mem("embeddedTags", "varTags", "S1"),
  mem("setEmbedded", "setVars", "S1"),
  mem("embeddedCatalog", "varCatalog", "S1", "送る口・上書きの deps の関数"),
  mem("embeddedNames", "sharedVarNames", "S1", "validateMessageDefinition の options(定義の varNames と取り違えないよう shared を付ける)"),
  dir("src/lib/messaging/embedded", "src/lib/messaging/vars", "S1", "lib の中のフォルダ。fork は入口 @/lib/messaging から読む"),
  dir(`${M}/components/common/EmbeddedInfoPopover`, `${M}/components/common/VarPopover`, "S1"),
  dir(`${M}/components/common/EmbeddedInfoTags`, `${M}/components/common/VarTags`, "S1"),
  dir(`${M}/components/common/TemplateEmbeddedInfoModal`, `${M}/components/common/TemplateVarsModal`, "S1"),
  dir(`${M}/components/common/SendTemplatePicker/SendEmbeddedInputs.tsx`, `${M}/components/common/SendTemplatePicker/SendVarInputs.tsx`, "S1"),
  dir(`${M}/hooks/useEmbeddedInfoTags.ts`, `${M}/hooks/useVarTags.ts`, "S1"),

  // ── S2 送信の記録の embedded_values → vars の側・システムテンプレートの廃止
  { ...mem("embeddedValues", "vars", "S2", `${S2_DISPATCH}。送信の詳細 AdminDispatchDetail は vars に入る。「同じ内容で送る」の写しは新しい sameAs(自由連絡の送信だけ、sameAs.vars)から読む(D193)`), hand: true },
  mem("embedded_values", "vars", "S2", S2_DISPATCH),
  word("system_template", null, "S2", "\\bsystem_template\\b", "送信の列 system_template を外した(D171・D202)。その行はレイアウトと欄の中身を持つので自由連絡として読む。コードで読む所・書く所は pnpm typecheck が止める(手で消す)。この行は注釈の中を挙げる"),
  ex("MessageSystemTemplate", null, "S2", S2_SYSTEM),
  ex("systemTemplates", null, "S2", S2_SYSTEM),
  ex("checkSystemTemplates", null, "S2", S2_SYSTEM),
  ex("enabledSystemTemplates", null, "S2", S2_SYSTEM),
  ex("isSystemTemplateEnabled", null, "S2", S2_SYSTEM),
  ex("isSystemTemplateId", null, "S2", S2_SYSTEM),
  ex("requireSystemTemplate", null, "S2", S2_SYSTEM),
  ex("systemTemplateOfKind", null, "S2", S2_SYSTEM),
  ex("adminSystemTemplateOptions", null, "S2", S2_SYSTEM),
  ex("AdminSystemTemplateOption", null, "S2", S2_SYSTEM),
  ex("upstreamSystemTemplates", null, "S2", S2_SYSTEM),
  ex("bulkSystemTemplates", null, "S2", S2_SYSTEM),
  ex("SYSTEM_TEMPLATE_ID_PREFIX", null, "S2", S2_SYSTEM),
  // 自由連絡の出どころ: template → origin、{ system } は無い(D171)。入口 sendTemplateMessage → sendFreeMessage
  ex("MessageTemplateRef", "MessageFreeOrigin", "S2", "{ layout: string } | { id, version }(旧 { system } は無い)"),
  ex("SendTemplateMessageInput", "SendFreeMessageInput", "S2", "鍵 template → origin"),
  ex("sendTemplateMessage", "sendFreeMessage", "S2", "fork のコードの入口(messagingService.sendFreeMessage)"),
  { ...mem("sendTemplateMessage", "sendFreeMessage", "S2", "形も変わる: messagingService.sendFreeMessage({ origin: { layout } | { id, version }, … })。{ system } は管理画面で選べるレイアウトの鍵へ手で直す"), hand: true },
  { ...mem("template", "origin", "S2", "形も変わる: 自由連絡の出どころ(送る入力・プレビュー・afterSend の引数)。{ system: 鍵 } は { layout: <管理画面で選べるレイアウト> } へ手で直す"), hand: true },
  ex("AdminBulkSendTemplate", "AdminBulkSendOrigin", "S2", "{ layout } | { id, version, edited }"),
  ex("AdminMessageTemplateSchema", "AdminMessageOriginSchema", "S2"),
  { ...ex("blankOfKind", "blankLayoutOf", "S2", "形も変わる: blankLayoutOf(layouts) = 管理画面で選べる最初のレイアウト"), hand: true },
  { ...ex("blankTextState", "layoutTextState", "S2", "形も変わる: layoutTextState({ key, label }, start?)"), hand: true },
  mem("currentSystem", "currentLayout", "S2", "送るモーダルの hook の戻り値(今のレイアウトの表示名)"),
  // 一括送信の決まった文面・カテゴリーの指定は無い(D195 D200)。options の defaults / defaultCategory は手で消す(pnpm typecheck が止める)
  ex("MessageSendDefaults", null, "S2", "一括送信の決まった文面の指定は無い。決まった文面は連絡定義(messages/<名前>.ts)へ(D195 D200)。bulkMessageAction / mode bulk の defaults は消す"),
  ex("AdminBulkSendDefaults", null, "S2", "一括送信の決まった文面の指定は無い。決まった文面は連絡定義(messages/<名前>.ts)へ(D195 D200)。bulkMessageAction の defaults は消す"),
  ex("ADMIN_BULK_SEND_DEFAULT_CATEGORY", null, "S2", "一括送信も新しく送ると同じく種別から選ぶ(既定のカテゴリーは無い、D195)。bulkMessageAction / mode bulk の defaultCategory は消す"),
  dir(`${M}/templates`, null, "S2", `${S2_SYSTEM}(受け口 systemTemplates の項目。fork の項目は DB のテンプレートか連絡定義へ)`),
  dir(`${M}/extensions/systemTemplates.ts`, null, "S2", `${S2_SYSTEM}(生成物。pnpm generate extensions が消す)`),

  // ── S3 一覧の対象の受け口 bulkSendTargets → 記録の宛先 recordTargets(持ち主のドメイン、連絡定義と同じ道)・resolveUserIds → resolveRecipients
  ex("MessageBulkSendTarget", "MessageRecordTarget", "S3", `${S3_TARGET}。型は @/lib/messaging へ移った: import の元(services/server/admin/types)を手で替える。項目に messages(この項目で送れる連絡定義の鍵の並び、空も可。名指す定義の adminTargets に records、D217・D218)を手で足す。上流の項目に連絡を足すのは隣の <名前>.override.ts の recordTargetOverride`),
  ex("bulkSendTargets", null, "S3", `${S3_TARGET}。生成した一覧(extensions/bulkSendTargets.ts)は無くなった: 一覧は src/registry/recordTargetRegistry.ts(pnpm generate registry、絞らない)、読み手は messaging の門番 loadRecordTarget(services/server/domainGate.ts)を通す`),
  ex("bulkSendTargetsList", null, "S3", `${S3_TARGET}。生成した一覧の中の名前(無くなった)`),
  { kind: "code-name", as: "declaration", old: "bulkSendTarget", new: "recordTarget", order: "S3", note: `${S3_TARGET}(項目のファイルの export const)`, in: [`${M}/bulkSendTargets`, "src/features/*/recordTargets"] },
  { ...mem("resolveUserIds", "resolveRecipients", "S3", "形も変わる: (recordIds) → [{ userId, vars, recordIds }](1 人 1 件、D190・D204)。名前は直すので中身を手で直す"), hand: true },
  dir(`${M}/bulkSendTargets`, "src/features/{owner}/recordTargets", "S3", `${S3_TARGET}。--owner <名前>=<ドメイン> で移し先を決める。項目の key は <ドメインのフォルダ名>.<ファイル名> に手で直す(ずれは pnpm generate registry が止める。管理 API の target・adminBulkActions の target も同じ鍵へ)`),
  dir(`${M}/extensions/bulkSendTargets.ts`, null, "S3", "生成物(受け口 bulkSendTargets は無くなり pnpm generate extensions が消す)。記録の宛先の一覧は src/registry/recordTargetRegistry.ts(pnpm generate registry)"),

  // ── 開発の語(D180〜D182。書き換えず一覧に出すだけ)
  word("種類", "カテゴリー", "S1", "種類", "カテゴリー(category)の意味の時だけ(D182 (2))。種別(kind)・ほかの意味の種類はそのまま"),
  word("回", "送信", "S1", "(?<![今前次毎初数何一二三])回(?=[のにをがはでへとごも])", "dispatch の意味の時だけ(D182 (3))。配達(delivery)はそのまま"),
  word("経路", "送信チャンネル", "S1", "経路", "channel の意味(D182 (4))"),
  word("ひな形", "レイアウト", "S1", "ひな形", "layout(D181)。テンプレートは DB の文面だけを指す"),
  word("管理画面での文面の直し", "テキストの編集", "S1", "文面の直し|文言の編集|文言の上書き", "管理画面の DB の上書き(D182 (6))。コードの override(上書き)と分ける"),
  word("専用の埋め込み情報", "埋め込み情報(vars)", "S1", "専用の埋め込み情報", "テンプレートの宣言も連絡定義の vars も 埋め込み情報(D182 (7)・D205)"),
  word("連絡の設定", "連絡定義", "S1", "連絡の設定", "D180。コードは MessageDefinition・defineMessage のまま"),
  word("一括送信の対象", "recordTargets(記録の宛先)", "S3", "一括送信の対象|一覧の対象の受け口", "D182 (5)"),
];

const KINDS = new Set(["code-name", "path", "word"]);
const AS = new Set(["export", "member", "declaration"]);
const ORDER_RE = /^S[1-8]$/;
const NAME_RE = /^[A-Za-z_$][\w$]*$/;

/** 表の形を確かめる(誤りは throw) */
export function validateVocab(rows) {
  if (!Array.isArray(rows)) throw new Error("vocab: 配列でない");
  const seen = new Set();
  rows.forEach((row, i) => {
    const at = `vocab[${i}] (${row?.old})`;
    if (!KINDS.has(row?.kind)) throw new Error(`${at}: kind は code-name / path / word`);
    if (typeof row.old !== "string" || row.old === "") throw new Error(`${at}: old が無い`);
    if (row.new !== null && (typeof row.new !== "string" || row.new === "" || row.new === row.old)) throw new Error(`${at}: new は文字(old と違う)か null`);
    if (!ORDER_RE.test(row.order ?? "")) throw new Error(`${at}: order は S1〜S8`);
    if (typeof row.note !== "string") throw new Error(`${at}: note が無い`);
    if (row.kind === "code-name") {
      if (!AS.has(row.as)) throw new Error(`${at}: as は export / member / declaration`);
      if (!NAME_RE.test(row.old) || (row.new !== null && !NAME_RE.test(row.new))) throw new Error(`${at}: old / new が名前でない`);
      if (row.as === "export" && (!Array.isArray(row.from) || row.from.length === 0)) throw new Error(`${at}: export の行は from が要る`);
      if (row.as === "declaration" && (!Array.isArray(row.in) || row.in.length === 0)) throw new Error(`${at}: declaration の行は in が要る`);
      if (row.as !== "export" && row.new === null) throw new Error(`${at}: 消えた名前は export の行だけ`);
    }
    if (row.hand !== undefined && row.hand !== true) throw new Error(`${at}: hand は true だけ`);
    if (row.kind === "word" && typeof row.match !== "string") throw new Error(`${at}: word の行は match が要る`);
    const id = `${row.kind}:${row.as ?? ""}:${row.old}`;
    if (seen.has(id)) throw new Error(`${at}: 同じ行が 2 つある`);
    seen.add(id);
  });
  return rows;
}

// ───────────────────────── 木を読む

const SCAN_DIRS = ["src", "scripts"];
const SCAN_EXT = /\.(ts|tsx|mts|cts|mjs|js|jsx)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);
const toPosix = (p) => p.split(path.sep).join("/");
const under = (rel, prefix) => rel === prefix || rel.startsWith(`${prefix}/`);
const stripExt = (rel) => rel.replace(SCAN_EXT, "");

function walk(root, rel, found) {
  const full = path.join(root, rel);
  if (!existsSync(full)) return found;
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(root, child, found);
    else if (SCAN_EXT.test(entry.name)) found.push(child);
  }
  return found;
}

/** 上流と同じ中身のファイル(取り込んだ上流の版 rev のブロブと同じ物)。rev が無い・git でない時は空 */
function upstreamIdentical(root, rev, files) {
  if (!rev || files.length === 0) return new Set();
  try {
    const tree = execFileSync("git", ["ls-tree", "-r", rev], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    const blobs = new Map();
    for (const line of tree.split("\n")) {
      const m = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);
      if (m) blobs.set(m[2], m[1]);
    }
    const candidates = files.filter((f) => blobs.has(f));
    if (candidates.length === 0) return new Set();
    const hashes = execFileSync("git", ["hash-object", "--stdin-paths"], { cwd: root, input: candidates.join("\n"), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim().split("\n");
    return new Set(candidates.filter((f, i) => hashes[i] === blobs.get(f)));
  } catch {
    return new Set();
  }
}

function defaultUpstreamRev(root) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", "-q", "MERGE_HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

/** tsconfig の paths の @/features/<名前>/* → src/features/core/<名前>/* と @/* → src/*(文字の写し。消えたファイルにも使える) */
function readAliases(root) {
  const aliases = [];
  const file = path.join(root, "tsconfig.json");
  if (existsSync(file)) {
    const read = ts.readConfigFile(file, ts.sys.readFile);
    for (const [key, targets] of Object.entries(read.config?.compilerOptions?.paths ?? {})) {
      if (!key.endsWith("/*") || !Array.isArray(targets) || !String(targets[0]).endsWith("/*")) continue;
      aliases.push({ prefix: key.slice(0, -1), target: toPosix(path.normalize(String(targets[0]).slice(0, -1))).replace(/^\.\//, "").replace(/\/$/, "") + "/" });
    }
  }
  if (!aliases.some((a) => a.prefix === "@/")) aliases.push({ prefix: "@/", target: "src/" });
  return aliases.sort((a, b) => b.prefix.length - a.prefix.length);
}

/** 指定子 → repo 相対のパス(拡張子なしのまま)。パッケージは null */
function specToRel(spec, fromRel, aliases) {
  if (spec.startsWith(".")) return toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec)));
  const alias = aliases.find((a) => spec.startsWith(a.prefix));
  return alias ? alias.target + spec.slice(alias.prefix.length) : null;
}

const specOfRel = (rel) => (rel.startsWith("src/") ? `@/${rel.slice(4)}` : null);
const relativeSpec = (fromRel, toRel) => {
  const r = path.posix.relative(path.posix.dirname(fromRel), toRel);
  return r.startsWith(".") ? r : `./${r}`;
};

// ───────────────────────── 1. path

/** 古い置き場 → 新しい置き場(rel は拡張子つきのファイル)。{ to } / { stop } */
function movePlan(rel, rows, owners) {
  for (const row of rows) {
    if (!under(rel, row.old)) continue;
    if (row.new === null) return { row, stop: "removed" };
    let to = row.new + rel.slice(row.old.length);
    if (to.includes("{owner}")) {
      const name = path.posix.basename(rel).replace(SCAN_EXT, "").replace(/^index$/, path.posix.basename(path.posix.dirname(rel)));
      const owner = owners[name];
      if (!owner) return { row, stop: "ownerUnknown", name };
      to = to.replace("{owner}", owner);
    }
    return { row, to };
  }
  return null;
}

/** 指定子の行き先が移った物なら新しい指定子(移していないファイルからも、移したファイルからも)。変わらなければ null */
function rewriteSpec(spec, oldFromRel, newFromRel, moves, pathRows, aliases) {
  const target = specToRel(spec, oldFromRel, aliases);
  if (target === null) return null;
  let next = movedTarget(target, moves) ?? upstreamMovedTarget(target, pathRows);
  if (!next) {
    if (oldFromRel === newFromRel || !spec.startsWith(".")) return null;
    next = target; // 自分が移った: 相対の指定子を新しい置き場から引き直す
  }
  const out = spec.startsWith(".") ? relativeSpec(newFromRel, next) : specOfRel(next);
  return out && out !== spec ? out : null;
}

/** fork のファイルを移した先(拡張子なしの指定子は拡張子なしで、index は フォルダで照らす) */
function movedTarget(target, moves) {
  for (const [from, to] of moves) {
    if (target === from) return to;
    if (target === stripExt(from)) return stripExt(to);
    if (/\/index\.\w+$/.test(from) && target === path.posix.dirname(from)) return path.posix.dirname(to);
  }
  return null;
}

/** 上流が移した置き場(fork のファイルが無くても指定子は直す。{owner} と消えた物は除く) */
function upstreamMovedTarget(target, pathRows) {
  for (const row of pathRows) {
    if (row.new === null || row.new.includes("{owner}")) continue;
    if (target === row.old) return row.new;
    const oldBase = stripExt(row.old);
    if (under(target, oldBase)) return stripExt(row.new) + target.slice(oldBase.length);
  }
  return null;
}

/** ファイルの中の import / export from / import() / require の指定子(start, end は引用符の内側) */
function specifiersOf(text, rel) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKindOf(rel));
  const found = [];
  const add = (lit) => found.push({ spec: lit.text, start: lit.getStart(sf) + 1, end: lit.getEnd() - 1, line: sf.getLineAndCharacterOfPosition(lit.getStart(sf)).line + 1 });
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier);
    else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) add(node.arguments[0]);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) add(node.argument.literal);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = text;
  let last = Infinity;
  for (const e of sorted) {
    if (e.end > last) continue; // 重なりは先の物だけ
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    last = e.start;
  }
  return out;
}

function scriptKindOf(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(mjs|js|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

// ───────────────────────── 2〜4 検査器

function compilerOptions(root) {
  const configFile = path.join(root, "tsconfig.json");
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, root, undefined, configFile);
  return { ...parsed.options, noEmit: true, incremental: false, allowJs: true, skipLibCheck: true, types: [], plugins: undefined };
}

/** 中身を差し替えた木(overlay: 絶対パス → 中身、null = 無い)の program */
function createProgram(root, options, rootFiles, overlay) {
  const host = ts.createCompilerHost(options, true);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (f) => (overlay.has(path.resolve(f)) ? (overlay.get(path.resolve(f)) ?? undefined) : readFile(f));
  host.fileExists = (f) => (overlay.has(path.resolve(f)) ? overlay.get(path.resolve(f)) !== null : fileExists(f));
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (f, lang, onError, create) => {
    const abs = path.resolve(f);
    if (overlay.has(abs)) {
      const text = overlay.get(abs);
      return text === null ? undefined : ts.createSourceFile(f, text, lang, true, scriptKindOf(f));
    }
    return getSourceFile(f, lang, onError, create);
  };
  host.getCurrentDirectory = () => root;
  return ts.createProgram({ rootNames: rootFiles.map((r) => path.join(root, r)), options, host });
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

/** ファイルの中で name と同じ字の識別子があるか(新しい名前の重なり) */
function hasIdentifier(sf, name) {
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (ts.isIdentifier(node) && node.text === name) found = true;
    else ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** symbol と同じ物を指す識別子の書き換え(shorthand の { old } は { old: new } で鍵を残す) */
function referenceEdits(sf, checker, symbol, next, skip) {
  const edits = [];
  const visit = (node) => {
    if (ts.isIdentifier(node) && node !== skip) {
      const parent = node.parent;
      if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
        if (checker.getShorthandAssignmentValueSymbol(parent) === symbol) edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `${node.text}: ${next}` });
      } else if (checker.getSymbolAtLocation(node) === symbol) {
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: next });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return edits;
}

/** 2・3: export / declaration の行 */
function exportEdits(sf, rel, checker, rows, declRows, aliases, report) {
  const edits = [];
  const byOld = new Map(rows.map((r) => [r.old, r]));
  const fromUpstream = (spec, row) => {
    const target = specToRel(spec, rel, aliases);
    return target !== null && (row ? row.from : UPSTREAM_DIRS).some((d) => under(target, d) || target.startsWith(`${d}/`));
  };
  const text = sf.getFullText();
  const mentions = (row) => new RegExp(`\\b${row.old}\\b`).test(text);

  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.importClause) {
      const spec = st.moduleSpecifier.text;
      const bindings = st.importClause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings) && fromUpstream(spec)) {
        const ns = bindings.name.text;
        for (const row of rows) {
          if (fromUpstream(spec, row) && new RegExp(`\\b${ns}\\s*\\.\\s*${row.old}\\b`).test(text)) report.stop(rel, lineOf(sf, st), "namespace", row);
        }
        continue;
      }
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const el of bindings.elements) {
        const row = byOld.get((el.propertyName ?? el.name).text);
        if (!row || !fromUpstream(spec, row)) continue;
        if (row.new === null) {
          report.stop(rel, lineOf(sf, el), "removed", row);
          continue;
        }
        if (el.propertyName) {
          edits.push({ start: el.propertyName.getStart(sf), end: el.propertyName.getEnd(), text: row.new });
          report.rename(rel, lineOf(sf, el), row);
          continue;
        }
        if (hasIdentifier(sf, row.new)) {
          report.stop(rel, lineOf(sf, el), "nameTaken", row);
          continue;
        }
        const symbol = checker.getSymbolAtLocation(el.name);
        edits.push({ start: el.name.getStart(sf), end: el.name.getEnd(), text: row.new });
        if (symbol) edits.push(...referenceEdits(sf, checker, symbol, row.new, el.name));
        report.rename(rel, lineOf(sf, el), row);
      }
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && fromUpstream(st.moduleSpecifier.text)) {
      if (!st.exportClause || ts.isNamespaceExport(st.exportClause)) {
        for (const row of rows) if (fromUpstream(st.moduleSpecifier.text, row) && mentions(row)) report.stop(rel, lineOf(sf, st), "namespace", row);
        continue;
      }
      for (const el of st.exportClause.elements) {
        const row = byOld.get((el.propertyName ?? el.name).text);
        if (row && fromUpstream(st.moduleSpecifier.text, row)) report.stop(rel, lineOf(sf, el), row.new === null ? "removed" : "reexport", row);
      }
    }
  }
  // import() / require of 上流(名前を追えない)
  for (const s of specifiersOf(text, rel)) {
    const line = text.slice(0, s.start).split("\n").length;
    const lineText = text.split("\n")[line - 1] ?? "";
    if (!/\bimport\s*\(|\brequire\s*\(/.test(lineText) || !fromUpstream(s.spec)) continue;
    for (const row of rows) if (fromUpstream(s.spec, row) && mentions(row)) report.stop(rel, line, "dynamic", row);
  }
  // 3. declaration: 受け口の項目のファイルの export const
  for (const row of declRows) {
    if (!row.in.some((p) => globUnder(rel, p))) continue;
    for (const st of sf.statements) {
      if (!ts.isVariableStatement(st) || !st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
      for (const decl of st.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== row.old) continue;
        if (hasIdentifier(sf, row.new)) {
          report.stop(rel, lineOf(sf, decl), "nameTaken", row);
          continue;
        }
        const symbol = checker.getSymbolAtLocation(decl.name);
        edits.push({ start: decl.name.getStart(sf), end: decl.name.getEnd(), text: row.new });
        if (symbol) edits.push(...referenceEdits(sf, checker, symbol, row.new, decl.name));
        report.rename(rel, lineOf(sf, decl), row);
      }
    }
  }
  return edits;
}

/** "src/features/*\/recordTargets" の * は 1 段 */
function globUnder(rel, pattern) {
  if (!pattern.includes("*")) return under(rel, pattern);
  const re = new RegExp(`^${pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+")}(/|$)`);
  return re.test(rel);
}

/** 型が上流で new を宣言し old を持たないか(合併は 1 つでも)。untyped = any / unknown / 誤り */
function judgeType(checker, type, row, root) {
  if (!type) return "no"; // 文脈の型の無い object literal = fork の物
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return "untyped";
  const parts = type.isUnion() ? type.types : [type];
  for (const t of parts) {
    const apparent = checker.getApparentType(t);
    const next = checker.getPropertyOfType(apparent, row.new);
    if (!next || checker.getPropertyOfType(apparent, row.old)) continue;
    const decl = next.declarations?.[0] ?? next.valueDeclaration;
    const file = decl ? toPosix(path.relative(root, decl.getSourceFile().fileName)) : "";
    if (UPSTREAM_DIRS.some((d) => under(file, d))) return "yes";
  }
  return "no";
}

/** 4: member の行 */
function memberEdits(sf, rel, checker, rows, root, importsUpstream, report) {
  const edits = [];
  const byOld = new Map(rows.map((r) => [r.old, r]));
  const decide = (row, node, typeOf) => {
    const verdict = judgeType(checker, typeOf(), row, root);
    if (verdict === "yes") {
      report.rename(rel, lineOf(sf, node), row);
      return true;
    }
    if (verdict === "untyped" && importsUpstream) report.stop(rel, lineOf(sf, node), "untyped", row);
    return false;
  };
  const replace = (node, text) => edits.push({ start: node.getStart(sf), end: node.getEnd(), text });
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && byOld.has(node.name.text)) {
      const row = byOld.get(node.name.text);
      if (decide(row, node.name, () => checker.getTypeAtLocation(node.expression))) replace(node.name, row.new);
    } else if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && byOld.has(node.argumentExpression.text)) {
      const row = byOld.get(node.argumentExpression.text);
      if (decide(row, node.argumentExpression, () => checker.getTypeAtLocation(node.expression))) replace(node.argumentExpression, JSON.stringify(row.new));
    } else if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        const name = prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) ? prop.name.text : null;
        const row = name ? byOld.get(name) : null;
        if (!row) continue;
        if (!(ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop) || ts.isMethodDeclaration(prop))) continue;
        if (!decide(row, prop.name, () => checker.getContextualType(node))) continue;
        if (ts.isShorthandPropertyAssignment(prop)) replace(prop.name, `${row.new}: ${name}`);
        else replace(prop.name, ts.isStringLiteral(prop.name) ? JSON.stringify(row.new) : row.new);
      }
    } else if (ts.isObjectBindingPattern(node)) {
      for (const el of node.elements) {
        const keyNode = el.propertyName ?? el.name;
        const name = ts.isIdentifier(keyNode) || ts.isStringLiteral(keyNode) ? keyNode.text : null;
        const row = name ? byOld.get(name) : null;
        if (!row || el.dotDotDotToken) continue;
        if (!decide(row, keyNode, () => checker.getTypeAtLocation(node))) continue;
        if (el.propertyName) replace(el.propertyName, row.new);
        else replace(el.name, `${row.new}: ${name}`);
      }
    } else if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && byOld.has(node.name.text)) {
      const row = byOld.get(node.name.text);
      if (decide(row, node.name, () => checker.getContextualType(node.parent))) replace(node.name, row.new);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return edits;
}

// ───────────────────────── 語

/** 注釈の中の語(行ごと) */
function wordHits(text, rel, rows) {
  const hits = [];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, scriptKindOf(rel) === ts.ScriptKind.TSX || scriptKindOf(rel) === ts.ScriptKind.JSX ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, text);
  const res = rows.map((r) => ({ row: r, re: new RegExp(r.match) }));
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (kind !== ts.SyntaxKind.SingleLineCommentTrivia && kind !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    const start = scanner.getTokenPos();
    const comment = scanner.getTokenText();
    comment.split("\n").forEach((lineText, i) => {
      for (const { row, re } of res) {
        if (re.test(lineText)) hits.push({ file: rel, line: text.slice(0, start).split("\n").length + i, old: row.old, new: row.new, order: row.order, note: row.note });
      }
    });
  }
  return hits;
}

// ───────────────────────── run

/**
 * fork の木を書き換える(apply false = 何も書かない)
 * @returns {{ moved: {from:string,to:string,order:string}[], renamed: {file:string,line:number,old:string,new:string,as:string,order:string}[], stopped: {file:string,line:number,reason:string,old:string,new:string|null,order:string,note:string}[], words: object[], changed: string[] }}
 */
export function run(root, { apply = false, owners = {}, upstreamRev, vocab = VOCAB } = {}) {
  validateVocab(vocab);
  const pathRows = vocab.filter((r) => r.kind === "path");
  const exportRows = vocab.filter((r) => r.kind === "code-name" && r.as === "export");
  const declRows = vocab.filter((r) => r.kind === "code-name" && r.as === "declaration");
  const memberRows = vocab.filter((r) => r.kind === "code-name" && r.as === "member");
  const wordRows = vocab.filter((r) => r.kind === "word");
  const aliases = readAliases(root);

  const all = SCAN_DIRS.flatMap((d) => walk(root, d, []));
  const rev = upstreamRev === undefined ? defaultUpstreamRev(root) : upstreamRev;
  const same = upstreamIdentical(root, rev, all);
  const own = all.filter((f) => !same.has(f));

  const stopped = [];
  const renamed = [];
  const seenStop = new Set();
  const report = {
    stop: (file, line, reason, row, detail = "") => {
      const key = `${file}:${line}:${reason}:${row.old}`;
      if (seenStop.has(key)) return;
      seenStop.add(key);
      stopped.push({ file, line, reason, old: row.old, new: row.new, order: row.order, note: detail || row.note });
    },
    rename: (file, line, row) => {
      renamed.push({ file, line, old: row.old, new: row.new, as: row.as, order: row.order });
      if (row.hand) report.stop(file, line, "handStep", row);
    },
  };

  // 1. path: 移す物を決め、指定子を直す(中身は overlay に持つ)
  const moves = new Map(); // old rel → new rel
  for (const rel of own) {
    const plan = movePlan(rel, pathRows, owners);
    if (!plan) continue;
    if (plan.stop) report.stop(rel, 1, plan.stop, plan.row, plan.stop === "ownerUnknown" ? `--owner ${plan.name}=<ドメイン> を渡す。${plan.row.note}` : "");
    else if (existsSync(path.join(root, plan.to))) report.stop(rel, 1, "targetExists", plan.row, `移し先 ${plan.to} に既にある`);
    else moves.set(rel, plan.to);
  }
  const texts = new Map(); // 新しい rel → 中身
  const original = new Map(); // 新しい rel → 元の rel
  for (const rel of own) {
    const next = moves.get(rel) ?? rel;
    const text = readFileSync(path.join(root, rel), "utf8");
    const edits = specifiersOf(text, rel)
      .map((s) => ({ ...s, out: rewriteSpec(s.spec, rel, next, moves, pathRows, aliases) }))
      .filter((s) => s.out)
      .map((s) => ({ start: s.start, end: s.end, text: s.out }));
    texts.set(next, edits.length ? applyEdits(text, edits) : text);
    original.set(next, rel);
  }

  const options = compilerOptions(root);
  const overlayOf = () => {
    const overlay = new Map();
    for (const [from] of moves) overlay.set(path.join(root, from), null);
    for (const [rel, text] of texts) overlay.set(path.join(root, rel), text);
    return overlay;
  };
  const oldNames = [...exportRows, ...declRows].map((r) => r.old);
  const memberNames = memberRows.map((r) => r.old);
  const mentionsAny = (text, names) => names.some((n) => text.includes(n));
  const importsUpstreamOf = (rel, text) => specifiersOf(text, rel).some((s) => {
    const t = specToRel(s.spec, rel, aliases);
    return t !== null && UPSTREAM_DIRS.some((d) => under(t, d));
  });

  // 2・3. export / declaration
  const pass2 = [...texts.keys()].filter((rel) => mentionsAny(texts.get(rel), oldNames));
  if (pass2.length) {
    const program = createProgram(root, options, pass2, overlayOf());
    const checker = program.getTypeChecker();
    for (const rel of pass2) {
      const sf = program.getSourceFile(path.join(root, rel));
      if (!sf) continue;
      const edits = exportEdits(sf, rel, checker, exportRows, declRows, aliases, report);
      if (edits.length) texts.set(rel, applyEdits(texts.get(rel), edits));
    }
  }

  // 4. member(2・3 を当てた後の木で型を求める)
  const pass3 = [...texts.keys()].filter((rel) => mentionsAny(texts.get(rel), memberNames));
  if (pass3.length) {
    const program = createProgram(root, options, pass3, overlayOf());
    const checker = program.getTypeChecker();
    for (const rel of pass3) {
      const sf = program.getSourceFile(path.join(root, rel));
      if (!sf) continue;
      const edits = memberEdits(sf, rel, checker, memberRows, root, importsUpstreamOf(rel, texts.get(rel)), report);
      if (edits.length) texts.set(rel, applyEdits(texts.get(rel), edits));
    }
  }

  // 語: 上流の連絡を読むファイルと messages/・受け口の項目の置き場のファイルの注釈
  const words = [];
  for (const [rel, text] of texts) {
    if (!importsUpstreamOf(rel, text) && !/\/(messages|recordTargets|bulkSendTargets)\//.test(rel)) continue;
    for (const hit of wordHits(text, rel, wordRows)) words.push(hit);
  }
  for (const hit of words) stopped.push({ file: hit.file, line: hit.line, reason: "word", old: hit.old, new: hit.new, order: hit.order, note: hit.note });

  // 書く
  const changed = [];
  for (const [rel, text] of texts) {
    const from = original.get(rel);
    const before = readFileSync(path.join(root, from), "utf8");
    if (from === rel && text === before) continue;
    changed.push(rel);
    if (!apply) continue;
    if (from !== rel) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      if (!gitMove(root, from, rel)) renameSync(path.join(root, from), path.join(root, rel));
    }
    if (text !== readFileSync(path.join(root, rel), "utf8")) writeFileSync(path.join(root, rel), text);
  }
  const moved = [...moves].map(([from, to]) => ({ from, to, order: movePlan(from, pathRows, owners).row.order }));
  const sortBy = (a, b) => a.file.localeCompare(b.file) || a.line - b.line;
  return { moved, renamed: renamed.sort(sortBy), stopped: stopped.sort(sortBy), changed: changed.sort() };
}

/** git の追跡下なら git mv(履歴を辿れるように)。できなければ false */
function gitMove(root, from, to) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", from], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["mv", from, to], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────── CLI

/** 引数(誤りは throw) */
export function parseArgs(argv) {
  const out = { apply: false, json: false, owners: {}, upstreamRev: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") out.apply = true;
    else if (arg === "--json") out.json = true;
    else if (arg === "--owner" || arg === "--upstream") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} に値が無い`);
      i += 1;
      if (arg === "--upstream") out.upstreamRev = value;
      else {
        const m = /^([A-Za-z_$][\w$-]*)=([A-Za-z][\w-]*)$/.exec(value);
        if (!m) throw new Error(`--owner は <名前>=<ドメイン>: ${value}`);
        out.owners[m[1]] = m[2];
      }
    } else throw new Error(`知らない引数: ${arg}`);
  }
  return out;
}

const REASONS = {
  namespace: "名前空間の import / export *(名前を追えない)",
  reexport: "上流の名前を出し直している(fork の公開の名前が変わる)",
  nameTaken: "新しい名前がファイルに既にある",
  dynamic: "import() / require(名前を追えない)",
  untyped: "受け手の型が分からない",
  removed: "消えた(代わりは note)",
  handStep: "名前は直した。形の違いを手で直す",
  ownerUnknown: "移し先のドメインが決まらない",
  targetExists: "移し先に既にある",
  word: "開発の語(注釈を手で直す)",
};

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`messaging-records: ${error.message}`);
    console.error("使い方: node .notices/20261122-134000-messaging-records.codemod.mjs [--apply] [--json] [--owner <名前>=<ドメイン>]... [--upstream <rev>]");
    process.exit(2);
  }
  const result = run(process.cwd(), args);
  if (args.json) {
    console.log(JSON.stringify({ notice: NOTICE_ID, apply: args.apply, ...result }, null, 2));
    return;
  }
  const verb = args.apply ? "書き換えた" : "書き換える(dry-run)";
  console.log(`${verb}: ${result.changed.length} ファイル(移す ${result.moved.length}・名前 ${result.renamed.length} 箇所)`);
  for (const m of result.moved) console.log(`  移す [${m.order}] ${m.from} → ${m.to}`);
  for (const r of result.renamed) console.log(`  ${r.file}:${r.line} [${r.order}] ${r.old} → ${r.new}`);
  if (result.stopped.length) {
    console.log(`止まる一覧(手で直す): ${result.stopped.length} 件`);
    for (const s of result.stopped) console.log(`  ${s.file}:${s.line} ${s.reason}(${REASONS[s.reason]}) [${s.order}] ${s.old} → ${s.new ?? "(消えた)"}${s.note ? ` — ${s.note}` : ""}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
