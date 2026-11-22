// src/domains/core/messaging/components/common/DispatchMeta/index.tsx
// 部品(props だけ、D210): 送信のメタデータ = 送信元(表示名がある時だけ)・送信者・出どころ・作成日時・予約日時(ある時だけ)・送信方法。
// 出どころ = 連絡定義「表示名」(定義連絡の送信、表示名が無ければ連絡定義)/ テンプレート(版、消された・文言を直した印)/ レイアウトから作成(レイアウトを直に選んだ自由連絡)、
// 前の送る口の送信は出さない。定義の鍵・送り元の鍵・利用者の id は見せない(D46)

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import { messageChannelLabel } from "@/domains/core/messaging/constants/channelLabels";
import type { AdminDispatchDetail } from "@/domains/core/messaging/services/client/adminMessagingClient";

import { formatAdminDateTime } from "../DispatchRow";

export type DispatchMetaDispatch = Pick<
  AdminDispatchDetail,
  | "sourceLabel"
  | "actor"
  | "actorName"
  | "messageKey"
  | "definitionLabel"
  | "templateVersion"
  | "templateDeleted"
  | "templateEdited"
  | "content"
  | "createdAt"
  | "scheduledAt"
  | "channels"
>;

export type DispatchMetaProps = { dispatch: DispatchMetaDispatch };

/**
 * 送信のテンプレートの表示(テンプレートから送っていない送信は null)。消したテンプレートの送信は「削除されたテンプレート」(D137)。
 * DTO にテンプレートの名前は無いので版の番号で見せる
 */
export function dispatchTemplateLabel(
  dispatch: Pick<AdminDispatchDetail, "templateVersion" | "templateDeleted" | "templateEdited">,
): string | null {
  if (dispatch.templateVersion === null) return null;
  const edited = dispatch.templateEdited ? "・文言を直して送信" : "";
  return dispatch.templateDeleted ? `削除されたテンプレート(v${dispatch.templateVersion}${edited})` : `v${dispatch.templateVersion}${edited ? `(${edited.slice(1)})` : ""}`;
}

/** 出どころの文(連絡定義「表示名」/ テンプレート / レイアウトから作成。前の送る口の送信は null) */
export function dispatchOriginText(
  dispatch: Pick<DispatchMetaDispatch, "messageKey" | "definitionLabel" | "templateVersion" | "templateDeleted" | "templateEdited" | "content">,
): string | null {
  // 定義連絡の送信は連絡定義の表示名(上書きの後。鍵は見せない D46、表示名が引けなければ「連絡定義」だけ)
  if (dispatch.messageKey) return dispatch.definitionLabel ? `連絡定義「${dispatch.definitionLabel}」` : "連絡定義";
  const template = dispatchTemplateLabel(dispatch);
  if (template) return dispatch.templateDeleted ? template : `テンプレート ${template}`;
  if (dispatch.content) return "レイアウトから作成";
  return null;
}

/** 送信者の文(利用者の名前 / 名前の無い利用者 / システム) */
export function dispatchActorText(dispatch: Pick<DispatchMetaDispatch, "actor" | "actorName">): string {
  return dispatch.actorName ?? (dispatch.actor.id ? "(名前未設定のユーザー)" : "システム");
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <Flex gap="md" wrap="wrap">
      <Span size="sm" tone="muted" className="min-w-28">
        {label}
      </Span>
      <Span size="sm">{value}</Span>
    </Flex>
  );
}

export function DispatchMeta({ dispatch }: DispatchMetaProps) {
  const origin = dispatchOriginText(dispatch);
  return (
    <Stack gap="2xs" data-slot="dispatch-meta">
      {dispatch.sourceLabel ? <MetaField label="送信元" value={dispatch.sourceLabel} /> : null}
      <MetaField label="送信者" value={dispatchActorText(dispatch)} />
      {origin ? <MetaField label="出どころ" value={origin} /> : null}
      <MetaField label="作成日時" value={formatAdminDateTime(dispatch.createdAt)} />
      {dispatch.scheduledAt ? <MetaField label="予約日時" value={formatAdminDateTime(dispatch.scheduledAt)} /> : null}
      <MetaField label="送信方法" value={dispatch.channels.map(messageChannelLabel).join(" / ")} />
    </Stack>
  );
}
