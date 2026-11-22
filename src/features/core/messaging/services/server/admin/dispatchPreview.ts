// src/features/core/messaging/services/server/admin/dispatchPreview.ts
//
// 送信のプレビュー(管理、GET /api/admin/messaging/dispatches/[id]/preview)。送信が送った物を見せる:
// - 描く物は送信だけから(resolvedOfDispatch: レイアウトの鍵と送った版を今の版へ読み替えた欄の中身・カテゴリー・送信チャンネル。定義・テンプレートを引き直さない)
// - 差し込み = 送信に残した vars ∪ embedded_values ∪ 共通の文脈(サービス名・URL)。受信者ごとの値({{受信者名}} など)は字のまま
// - 送信チャンネルごとに 送る口と同じ組み立て(buildContent)→ メールは送信チャンネルの preview で HTML、お知らせは client のレイアウトの描き方の材料(欄の中身・要約)
// - 記録の段で中身を残していない送信(values が無い: record meta・秘密の連絡)・レイアウトが無い・版を読めない送信は cannotRender に理由(送信チャンネルは空)
// - どのレイアウトでも描く(テンプレートの adminSelectable の絞りは使わない)。service でも管理者を確かめる(D42)

import { displayVarValues, varMap, type MessageVarEntry, type MessageLayout } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";
import type { VariableMap } from "@/lib/templateVariables";

import type { MessageDispatch } from "../../../entities/model";
import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import type { DispatchResolveError } from "../sendMessage/dispatchResolved";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import type { AdminDispatchPreview, AdminDispatchPreviewChannel } from "./dispatchDto";
import { layoutChannelView } from "./layoutChannelView";

export type AdminDispatchPreviewDeps = AdminCheckDeps & {
  findDispatch: (id: string) => Promise<MessageDispatch | null>;
  /** 送信から描く定義(sendMessage/dispatchResolved.ts) */
  resolve: (row: MessageDispatch) => Promise<{ resolved: AnyResolvedMessageDefinition } | { error: DispatchResolveError }>;
  layouts: Readonly<Record<string, MessageLayout>>;
  /** 送る口と同じ組み立て(描けない送信チャンネルは DomainError) */
  buildContent: (resolved: AnyResolvedMessageDefinition, channel: string, map: VariableMap) => Promise<{ content: Record<string, unknown> }>;
  /** 欄の値の中の文字列を全部差し込む(sendMessage/context.ts renderValue) */
  renderValue: (value: unknown, map: VariableMap) => unknown;
  /** 差し込みの表(sendMessage/context.ts toVariableMap) */
  toVariableMap: (values: Readonly<Record<string, unknown>>) => VariableMap;
  /** その連絡の埋め込み情報の一覧(別名の差し込み) */
  varCatalog: (resolved: AnyResolvedMessageDefinition) => MessageVarEntry[];
  /** 共通の文脈(サービス名・URL) */
  commonValues: () => Record<string, unknown>;
  /** 停止のリンクを出す送信か(好みに従う連絡 = category を送信チャンネルの preview に渡す) */
  honoursPreferences: (resolved: AnyResolvedMessageDefinition) => boolean;
  /** 送信チャンネルの表示名(無い送信チャンネルは null) */
  channelLabel: (channel: string) => string | null;
  /** 送信チャンネルのプレビュー(送信チャンネルの受け口の preview。無い送信チャンネルは null) */
  channelPreview: (
    channel: string,
    input: { messageKey: string; content: unknown; category?: string },
  ) => Promise<{ html?: string; text?: string }> | null;
};

const RESOLVE_ERRORS: Record<DispatchResolveError, string> = {
  layout_missing: "この送信のひな形は今は登録されていないため、表示できません",
  layout_unreadable: "この送信のひな形の版を今の版へ読み替えられないため、表示できません",
};

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * 送信 1 件のプレビュー。
 * @throws DomainError(404) 送信が無い / (403) 管理者でない
 */
export async function adminDispatchPreview(deps: AdminDispatchPreviewDeps, id: string): Promise<AdminDispatchPreview> {
  await assertAdminActor(deps);
  const row = await deps.findDispatch(id);
  if (!row) throw new DomainError("送信が見つかりません", { status: 404 });
  const empty = (cannotRender: string): AdminDispatchPreview => ({ dispatchId: row.id, layout: row.layout ?? null, cannotRender, channels: [] });
  if (!row.layout) return empty("この送信はひな形を使う前の形のため、ひな形で表示できません");
  if (!row.values) return empty("この送信は本文を保存していないため、表示できません");
  const loaded = await deps.resolve(row);
  if ("error" in loaded) return empty(RESOLVE_ERRORS[loaded.error]);
  const { resolved } = loaded;
  const layout = deps.layouts[resolved.layout];
  if (!layout) return empty(RESOLVE_ERRORS.layout_missing);

  // 専用の日付・日時は人が読む字に(型の印 <鍵>@type、送る口の content.ts と同じ)
  const map = displayVarValues(deps.toVariableMap({ ...deps.commonValues(), ...(row.vars ?? {}), ...(row.embedded_values ?? {}) }));
  const named = varMap(map, deps.varCatalog(resolved));
  const values = deps.renderValue(resolved.values ?? {}, named) as Record<string, unknown>;
  const category = resolved.category && deps.honoursPreferences(resolved) ? resolved.category : undefined;

  const channels: AdminDispatchPreviewChannel[] = [];
  for (const key of resolved.channels as readonly string[]) {
    const label = deps.channelLabel(key) ?? key;
    const view = layoutChannelView(layout, values, key);
    try {
      const { content } = await deps.buildContent(resolved, key, map);
      const drawn = await deps.channelPreview(key, { messageKey: resolved.key, content, ...(category ? { category } : {}) });
      channels.push({ key, label, html: drawn?.html ?? null, text: drawn?.text ?? null, ...view });
    } catch (error) {
      channels.push({ key, label, html: null, text: null, ...view, cannotRender: reasonOf(error) });
    }
  }
  return { dispatchId: row.id, layout: layout.key, cannotRender: null, channels };
}
