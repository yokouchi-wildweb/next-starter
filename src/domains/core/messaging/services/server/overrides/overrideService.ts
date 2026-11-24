// src/domains/core/messaging/services/server/overrides/overrideService.ts
//
// テキストの編集(D21・D24・D28・D132)の管理の service。/api/admin/messaging/overrides が呼ぶ。
// - 欄の道 = レイアウトの欄の鍵。直せる欄 = レイアウトの欄のうちカテゴリーの送信チャンネルで使う物の全部、adminEditableOnly で絞る(lib adminEditableFields)
// - 一覧: 生成の一覧の連絡(門の開いたドメインの物)のうち、直せる欄がある(か行が残る)連絡。使えない行の数(unusableCount)
// - 1 件: カテゴリーの送信チャンネル(fork のカテゴリーの上書きの後)と、直せる欄の全部(宣言の順)+ 使えない・直せなくなった行。
//   欄ごとに 欄の宣言(型・見出し・仮の文)・使う送信チャンネル・コードの値(定義の values)・管理画面の値・送る時の値・印(直した / コードが変わった / 使えない)
// - 行は保存した時のレイアウトの版を持ち、読む時に改版の対応で今の版の欄へ移す。移せない行・今の検査を通らない行は当てない(unusable、行は消さない)
// - 保存(D132 の 1 回の保存): 直した欄の値と「元の文言に戻す」欄をまとめて 1 つの取引で書く(saveFields。どれかが誤りなら何も書かない)。
//   値は送る口と同じ検査(lib/messaging checkAdminFieldValue)を通った物だけ。誤りは欄ごとに 400 の details.fields { 欄の鍵: 理由 }(code override_fields_invalid)。
//   今のレイアウトの版と直した時のコードの値も残す。同じ欄へ移る前の版の行は消す(1 つの欄に 1 行)。
//   値の画像(storage:// の参照)は保存の台帳で行に結び、外れた物を外す(imageBinding.ts)
// - 既定に戻す = その欄へ移る行を全部消す(使えない行は保存した時の鍵で消す)。まとめての保存の reset と、欄 1 つの resetField(DELETE、管理画面は使わない)。
//   保存と戻すは欄ごとに監査に残す(messaging.override.updated / .reset、値は残さない)
// - プレビュー(D86): 保存した値と未保存の値(values = { 欄の鍵: 値 }、検査を通る物だけ)をコードの値に重ね、文字の欄を印で包んで(previewMarkers.ts)
//   送る口と同じ組み立て(sendMessage/content.ts)で送信チャンネル 1 つを描く。送信チャンネルに preview が無ければ html は null。
//   レイアウトの鍵・その送信チャンネルの欄の中身(印なし)・要約も返す(お知らせは client のレイアウトの描き方 layoutInApps が描く)
// - 1 件は埋め込み情報の一覧(vars: 共通 + enrichers と enricher と同じ鍵の vars の別名 + 残りの vars)も返す(部品 VarTags)
// - service でも管理者を確かめる(D42)

import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import {
  adminEditableFields,
  adminFieldAllowedKeys,
  adminFieldCodeValue,
  applyAdminFieldValues,
  checkAdminFieldValue,
  fieldBelongsTo,
  layoutVersionOf,
  listSecretVarKeys,
  readAdminFieldValue,
  type AdminFieldCheckOptions,
  type MessageVarEntry,
  type MessageLayout,
} from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { stopContextOf } from "../sendMessage/sender";
import { honoursPreferences } from "../sendMessage/stops";
import { assertAdminActor, type AdminCheckDeps } from "../admin/assertAdmin";
import { layoutChannelView } from "../admin/layoutChannelView";
import { bindOverrideImages, releaseOverrideImages, type OverrideImageLedger } from "./imageBinding";
import { applyPreviewMarkers, stripPreviewMarkers, wrapPreviewValues } from "./previewMarkers";
import type {
  AdminOverrideChannel,
  AdminOverrideField,
  AdminOverrideFieldSpec,
  AdminOverrideMessageDetail,
  AdminOverrideMessageSummary,
  MessageOverridePreview,
} from "./dto";
import type { MessageOverrideRecord, MessageOverrideStore } from "./types";

export type OverrideServiceDeps = AdminCheckDeps & {
  store: MessageOverrideStore;
  /** 生成の一覧の連絡の鍵 */
  messageKeys: () => string[];
  /** 連絡定義(fork の override を重ねた後、管理画面の値は重ねない)・レイアウト・検査の束。無い・読めない連絡は null */
  loadDefinition: (
    messageKey: string,
  ) => Promise<{ resolved: AnyResolvedMessageDefinition; layout: MessageLayout; check: AdminFieldCheckOptions } | null>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
  /** カテゴリーの表示名(受け口の label。無ければ null) */
  categoryLabel: (category: string) => string | null;
  /** 送信チャンネルの受け口の項目の表示(無い送信チャンネルは null) */
  channelInfo: (channel: string) => { label: string } | null;
  /** 画像を行に結ぶ台帳(無ければ結ばない = テスト) */
  images?: OverrideImageLedger<unknown>;
  /** 送る口と同じ組み立ての送信チャンネル 1 つの中身(差し込みはしない = {{鍵}} のまま) */
  channelContent: (resolved: AnyResolvedMessageDefinition, channel: string) => Promise<Record<string, unknown>>;
  /** その連絡の埋め込み情報の一覧(共通 + 当たる enrichers、日本語の別名つき。無ければ空 = テスト) */
  varCatalog?: (resolved: AnyResolvedMessageDefinition) => MessageVarEntry[];
  /** 送信チャンネルのプレビュー(送信チャンネルの受け口の preview。無い送信チャンネルは null) */
  channelPreview?: (
    channel: string,
    input: { messageKey: string; content: unknown; category?: string },
  ) => Promise<{ html?: string; text?: string }> | null;
};

export const PreviewMessageOverrideInputSchema = z
  .object({ channel: z.string().min(1).max(100), values: z.record(z.string().max(200), z.unknown()).default({}) })
  .strict();

/** まとめての保存の 1 欄: 値を入れる { fieldPath, value } か、元の文言に戻す { fieldPath, reset: true } */
const saveFieldChangeSchema = z.union([
  z.object({ fieldPath: z.string().min(1).max(200), value: z.unknown() }).strict(),
  z.object({ fieldPath: z.string().min(1).max(200), reset: z.literal(true) }).strict(),
]);

/** まとめての保存の入力(欄の鍵は重ならない) */
export const SaveMessageOverrideInputSchema = z
  .object({ fields: z.array(saveFieldChangeSchema).min(1).max(200) })
  .strict()
  .superRefine((value, ctx) => {
    const paths = value.fields.map((field) => field.fieldPath);
    if (new Set(paths).size !== paths.length) ctx.addIssue({ code: "custom", message: "同じ項目が 2 回あります" });
  });

/** まとめての保存で誤りのある欄の 400 の code(details.fields = { 欄の鍵: 理由 }) */
export const OVERRIDE_FIELDS_INVALID = "override_fields_invalid";

type Loaded = { resolved: AnyResolvedMessageDefinition; layout: MessageLayout; check: AdminFieldCheckOptions };

function channelsOf(resolved: AnyResolvedMessageDefinition, deps: Pick<OverrideServiceDeps, "channelInfo">): AdminOverrideChannel[] {
  return resolved.channels.flatMap((key) => {
    const info = deps.channelInfo(key);
    return info ? [{ key, label: info.label }] : [];
  });
}

/**
 * 埋め込み情報の一覧(テンプレートの画面と同じ分け): 共通 = 共通の埋め込み情報 + 当たる enrichers + enricher と同じ鍵の vars(例 wallet の displayName = 表示名)、
 * 専用 = 残りの vars(定義の varNames の別名と説明、D133)。秘密の vars は出さない。共通と同じ鍵の vars(例 serviceNameShort)は共通にだけ出す
 */
function varsOf(resolved: AnyResolvedMessageDefinition, deps: Pick<OverrideServiceDeps, "varCatalog">): MessageVarEntry[] {
  const secret = new Set(listSecretVarKeys(resolved.vars));
  return (deps.varCatalog?.(resolved) ?? []).filter((entry) => entry.source !== "own" || !secret.has(entry.key));
}

function specOf(layout: MessageLayout, key: string): AdminOverrideFieldSpec | null {
  const spec = layout.fields[key];
  if (!spec) return null;
  const { channels: _channels, ...rest } = spec;
  return rest as AdminOverrideFieldSpec;
}

/** 行を今の版の欄で読む(欄の道 → 行。移せない行は unusable に) */
function readRows(loaded: Loaded, rows: readonly MessageOverrideRecord[]) {
  return rows.map((row) => ({ row, reading: readAdminFieldValue(loaded.resolved, loaded.layout, row, loaded.check) }));
}

function buildFields(loaded: Loaded, rows: readonly MessageOverrideRecord[]): AdminOverrideField[] {
  const { resolved, layout } = loaded;
  const editable = adminEditableFields(resolved, layout);
  const readings = readRows(loaded, rows);
  const channels = resolved.channels as readonly string[];
  const fieldOf = (path: string, reading: (typeof readings)[number] | undefined): AdminOverrideField => {
    const spec = layout.fields[path];
    const codeValue = adminFieldCodeValue(resolved, path) ?? null;
    const row = reading?.row;
    const problem = reading?.reading.problem ?? null;
    return {
      path,
      spec: specOf(layout, path),
      channels: spec ? channels.filter((channel) => fieldBelongsTo(spec, channel)) : [],
      editable: editable.includes(path),
      codeValue,
      value: row ? row.value : null,
      effective: row && !problem ? row.value : codeValue,
      edited: Boolean(row),
      codeChanged: Boolean(row) && !isDeepStrictEqual(row!.codeValue ?? null, codeValue),
      unusable: Boolean(problem),
      problem: problem?.message ?? null,
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  };
  const fields = editable.map((path) => fieldOf(path, readings.find((item) => item.reading.fieldPath === path)));
  // 直せる欄に当たらない行(移せない・直せなくなった欄)は保存した時の鍵で後ろに並べる(既定に戻すだけできる)
  for (const item of readings) {
    if (item.reading.fieldPath && editable.includes(item.reading.fieldPath)) continue;
    const field = fieldOf(item.reading.fieldPath ?? item.row.fieldPath, item);
    fields.push({
      ...field,
      path: item.row.fieldPath,
      editable: false,
      unusable: true,
      problem: item.reading.problem?.message ?? `${item.row.fieldPath} は今は直せない欄です`,
      effective: field.codeValue,
    });
  }
  return fields;
}

export function createOverrideService(deps: OverrideServiceDeps) {
  async function requireDefinition(messageKey: string): Promise<Loaded> {
    const loaded = await deps.loadDefinition(messageKey);
    if (!loaded) throw new DomainError(`連絡 ${messageKey} はありません`, { status: 404 });
    return loaded;
  }

  async function detail(messageKey: string): Promise<AdminOverrideMessageDetail> {
    const loaded = await requireDefinition(messageKey);
    const { resolved, layout, check } = loaded;
    const rows = await deps.store.listByMessage(messageKey);
    if (adminEditableFields(resolved, layout).length === 0 && rows.length === 0) {
      throw new DomainError(`連絡 ${messageKey} は管理画面で直せません`, { status: 404 });
    }
    return {
      key: resolved.key,
      label: resolved.label,
      kind: resolved.kind,
      category: resolved.category ?? null,
      categoryLabel: resolved.category ? deps.categoryLabel(resolved.category) : null,
      allowedKeys: adminFieldAllowedKeys(resolved, check.variableKeys),
      vars: varsOf(resolved, deps),
      channels: channelsOf(resolved, deps),
      fields: buildFields(loaded, rows),
    };
  }

  /** その欄の行(今の版でその欄へ移る行と、保存した時の鍵がその欄の行) */
  function rowsOfField(loaded: Loaded, rows: readonly MessageOverrideRecord[], fieldPath: string): MessageOverrideRecord[] {
    return readRows(loaded, rows)
      .filter((item) => item.reading.fieldPath === fieldPath || item.row.fieldPath === fieldPath)
      .map((item) => item.row);
  }

  async function removeRows(messageKey: string, paths: readonly string[]): Promise<boolean> {
    const images = deps.images;
    const cleanupIds: string[] = [];
    let removed = false;
    for (const path of paths) {
      const done = await deps.store.remove(
        messageKey,
        path,
        images ? async (tx, row) => void cleanupIds.push(...(await releaseOverrideImages(images, tx, row))) : undefined,
      );
      removed = removed || done;
    }
    if (images && cleanupIds.length > 0) await images.cleanup(cleanupIds);
    return removed;
  }

  return {
    /**
     * 送信チャンネル 1 つのプレビュー(保存した値と未保存の値 values = { 欄の鍵: 値 } をコードの値に重ねる。検査を通らない値は重ねない)。
     * @throws DomainError(400) 入力の誤り・連絡に無い送信チャンネル / (403) 管理者でない / (404) 連絡が無い
     */
    async previewMessage(messageKey: string, input: unknown): Promise<MessageOverridePreview> {
      await assertAdminActor(deps);
      const parsed = PreviewMessageOverrideInputSchema.safeParse(input);
      if (!parsed.success) throw new DomainError("プレビューの入力が正しくありません", { status: 400 });
      const { channel, values: drafts } = parsed.data;
      const loaded = await requireDefinition(messageKey);
      const { layout, check } = loaded;
      if (!loaded.resolved.channels.includes(channel)) throw new DomainError("この通知に無い送信方法です", { status: 400 });
      const rows = await deps.store.listByMessage(messageKey);
      const saved = applyAdminFieldValues(loaded.resolved, layout, rows, check).resolved;
      const values: Record<string, unknown> = { ...((saved.values as Record<string, unknown> | undefined) ?? {}) };
      for (const [path, value] of Object.entries(drafts)) {
        if (!checkAdminFieldValue(saved, layout, path, value, check)) values[path] = value;
      }
      const marked = { ...saved, values: wrapPreviewValues(layout, values) } as AnyResolvedMessageDefinition;
      const content = await deps.channelContent(marked, channel);
      const rendered = await deps.channelPreview?.(channel, {
        messageKey,
        content,
        // 停止のリンクの見本は送る時と同じ判定(好みに従う連絡 = honoursPreferences)の時だけ
        ...(saved.category && honoursPreferences(stopContextOf(saved)) ? { category: saved.category } : {}),
      });
      return {
        channel,
        html: rendered?.html ? applyPreviewMarkers(rendered.html) : null,
        text: rendered?.text ? stripPreviewMarkers(rendered.text) : null,
        // お知らせはレイアウトの描き方(client)で描く材料(印なしの値と要約)
        ...layoutChannelView(layout, values, channel),
      };
    },

    /** 編集できる連絡の一覧 */
    async listMessages(): Promise<AdminOverrideMessageSummary[]> {
      await assertAdminActor(deps);
      const rows = await deps.store.listAll();
      const summaries: AdminOverrideMessageSummary[] = [];
      for (const key of deps.messageKeys()) {
        const loaded = await deps.loadDefinition(key);
        if (!loaded) continue;
        const own = rows.filter((row) => row.messageKey === key);
        if (adminEditableFields(loaded.resolved, loaded.layout).length === 0 && own.length === 0) continue;
        const fields = buildFields(loaded, own);
        summaries.push({
          key,
          label: loaded.resolved.label,
          kind: loaded.resolved.kind,
          category: loaded.resolved.category ?? null,
          categoryLabel: loaded.resolved.category ? deps.categoryLabel(loaded.resolved.category) : null,
          channels: channelsOf(loaded.resolved, deps),
          editableCount: fields.filter((field) => field.editable).length,
          editedCount: fields.filter((field) => field.edited).length,
          unusableCount: fields.filter((field) => field.unusable).length,
          codeChangedCount: fields.filter((field) => field.codeChanged).length,
        });
      }
      return summaries;
    },

    /** 1 連絡の全欄 */
    async getMessage(messageKey: string): Promise<AdminOverrideMessageDetail> {
      await assertAdminActor(deps);
      return detail(messageKey);
    },

    /**
     * 直した欄をまとめて保存する(D132 の 1 回の保存)。値の欄は入れ・差し替え、reset の欄は行を消す。1 つの取引で、どれかが誤りなら何も書かない。
     * @throws DomainError(400) 入力の誤り・欄の検査の誤り(code override_fields_invalid、details.fields { 欄の鍵: 理由 })/ (403) 管理者でない / (404) 連絡が無い
     */
    async saveFields(messageKey: string, input: unknown): Promise<AdminOverrideMessageDetail> {
      await assertAdminActor(deps);
      const parsed = SaveMessageOverrideInputSchema.safeParse(input);
      if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "文言の入力が正しくありません", { status: 400 });
      const loaded = await requireDefinition(messageKey);
      const { resolved, layout, check } = loaded;
      const rows = await deps.store.listByMessage(messageKey);
      const problems: Record<string, string> = {};
      const removals = new Set<string>();
      const upserts: { fieldPath: string; layoutVersion: number; value: unknown; codeValue: unknown; updatedBy: string | null }[] = [];
      const resets: string[] = [];
      const actorId = deps.context()?.actorId ?? null;
      for (const change of parsed.data.fields) {
        const { fieldPath } = change;
        const ownRows = rowsOfField(loaded, rows, fieldPath).map((row) => row.fieldPath);
        if ("reset" in change) {
          // 行の無い欄を戻すのは何もしない(画面が下書きだけを捨てた欄)
          if (ownRows.length > 0) {
            for (const path of ownRows) removals.add(path);
            resets.push(fieldPath);
          }
          continue;
        }
        const problem = checkAdminFieldValue(resolved, layout, fieldPath, change.value, check);
        if (problem) {
          problems[fieldPath] = problem.message;
          continue;
        }
        // 同じ欄へ移る前の版の行(保存した時の鍵が違う)は消す: 1 つの欄に 1 行
        for (const path of ownRows) if (path !== fieldPath) removals.add(path);
        upserts.push({
          fieldPath,
          layoutVersion: layoutVersionOf(layout),
          value: change.value,
          codeValue: adminFieldCodeValue(resolved, fieldPath) ?? null,
          updatedBy: actorId,
        });
      }
      if (Object.keys(problems).length > 0) {
        throw new DomainError(`保存できない項目があります(${Object.keys(problems).length} 件)`, {
          status: 400,
          code: OVERRIDE_FIELDS_INVALID,
          details: { fields: problems },
        });
      }
      if (removals.size === 0 && upserts.length === 0) return detail(messageKey);
      const images = deps.images;
      const cleanupIds: string[] = [];
      await deps.store.apply(
        messageKey,
        { removals: [...removals], upserts },
        images
          ? {
              bind: async (tx, row) => {
                const bound = await bindOverrideImages(images, tx, {
                  rowId: row.rowId,
                  fieldPath: row.fieldPath,
                  actorUserId: actorId,
                  value: row.value,
                  previousValue: row.previousValue,
                });
                cleanupIds.push(...bound.cleanupIds);
                return bound.value;
              },
              release: async (tx, row) => void cleanupIds.push(...(await releaseOverrideImages(images, tx, row))),
            }
          : {},
      );
      if (images && cleanupIds.length > 0) await images.cleanup(cleanupIds);
      for (const { fieldPath } of upserts) {
        await deps.recordAudit({
          targetType: "message_override",
          targetId: `${messageKey}:${fieldPath}`,
          action: "messaging.override.updated",
          metadata: { messageKey, fieldPath },
        });
      }
      for (const fieldPath of resets) {
        await deps.recordAudit({
          targetType: "message_override",
          targetId: `${messageKey}:${fieldPath}`,
          action: "messaging.override.reset",
          metadata: { messageKey, fieldPath },
        });
      }
      return detail(messageKey);
    },

    /**
     * 欄 1 つを既定(コードの値)に戻す = その欄の行を消す(今の版の欄の鍵か、使えない行の保存した時の鍵)。
     * @throws DomainError(403) 管理者でない / (404) 連絡か行が無い
     */
    async resetField(messageKey: string, fieldPath: string): Promise<AdminOverrideMessageDetail> {
      await assertAdminActor(deps);
      const loaded = await requireDefinition(messageKey);
      const paths = [...new Set(rowsOfField(loaded, await deps.store.listByMessage(messageKey), fieldPath).map((row) => row.fieldPath))];
      const removed = paths.length > 0 && (await removeRows(messageKey, paths));
      if (!removed) throw new DomainError(`${messageKey} ${fieldPath} は直していません`, { status: 404 });
      await deps.recordAudit({
        targetType: "message_override",
        targetId: `${messageKey}:${fieldPath}`,
        action: "messaging.override.reset",
        metadata: { messageKey, fieldPath },
      });
      return detail(messageKey);
    },
  };
}

export type OverrideService = ReturnType<typeof createOverrideService>;
