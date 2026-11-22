// src/domains/core/messaging/components/ScheduledEditModal/index.tsx
// セクションコンテナ(管理: 予約した送信の送る前の直し、D210・ui.scheduledEdit)。ボタン「予約を編集」とモーダルを描き、hook useScheduledEdit を呼んで部品を並べるだけ。
// 自由連絡・定義連絡の送信を 1 つで受ける。operations.canEdit が閉なら何も描かない。
// 書く段: 宛先(DispatchTargetSummary、見せるだけ)・レイアウト(表示名が分かる時、見せるだけ)・
//   文面(直せる欄だけの LayoutFields。直せる欄が無い送信は箱なし)・送信方法(SendCategoryChannels、固定 on は外せない・off は出さない)・
//   予約の時刻(SendSchedule の時刻だけ)。canEdit.content が閉なら理由の 1 行と時刻だけ
// 確認の段: 変わる物の前と後(時刻・直した欄・送信方法)→ 保存。保存できたらモーダルを閉じ、onSaved(返った送信 1 件)。409・400 の文は書く段の下に出す。
// 流れ・体(変えた欄だけ・送信方法は変えた時だけ全部・宛先は送らない)は hook useScheduledEdit

"use client";

import { CalendarClock } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { DispatchTargetSummary } from "@/domains/core/messaging/components/common/DispatchTargetSummary";
import { LayoutFields } from "@/domains/core/messaging/components/common/LayoutFields";
import { SendCategoryChannels } from "@/domains/core/messaging/components/common/SendCategoryChannels";
import { SendSchedule } from "@/domains/core/messaging/components/common/SendSchedule";
import { messageChannelLabel } from "@/domains/core/messaging/constants/channelLabels";
import { useScheduledEdit, type ScheduledEditDispatch } from "@/domains/core/messaging/hooks/useScheduledEdit";
import type { AdminDispatchDetail } from "@/domains/core/messaging/services/client/adminMessagingClient";

export type ScheduledEditModalProps = {
  dispatch: ScheduledEditDispatch;
  /** ロールの id → 表示名(宛先の行。既定 = id のまま) */
  roleLabelOf?: (role: string) => string;
  /** 保存できた(返った送信 1 件)。一覧の行の置き換えなど */
  onSaved?: (detail: AdminDispatchDetail) => void;
};

const TITLE = "予約を編集";
const noop = () => {};

/** 日時の表示(ja-JP)。無い・読めない値は「-」 */
function formatAt(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
}

export function ScheduledEditModal({ dispatch, roleLabelOf, onSaved }: ScheduledEditModalProps) {
  const m = useScheduledEdit({ dispatch, onSaved });
  const { showToast } = useToast();
  const { execute: save } = useAsyncAction(async () => {
    const saved = await m.save();
    if (saved) showToast("予約を変更しました", "success");
  });
  if (!m.allowed) return null;

  const body =
    m.step === "confirm" ? (
      <Stack gap="xs" data-slot="scheduled-edit-confirm">
        {m.timeChanged ? (
          <Para size="sm" className="my-0" data-slot="scheduled-edit-confirm-time">
            予約日時: {formatAt(m.previousScheduledAt)} → {formatAt(m.scheduledAt)}
          </Para>
        ) : null}
        {m.editedFields.length > 0 ? (
          <Para size="sm" className="my-0" data-slot="scheduled-edit-confirm-fields">
            直した欄: {m.editedFields.map((field) => field.label).join("・")}
          </Para>
        ) : null}
        {m.channelsChanged ? (
          <Para size="sm" className="my-0" data-slot="scheduled-edit-confirm-channels">
            送信方法: {m.previousChannels.map(messageChannelLabel).join(" / ")} → {m.channelsOn.map(messageChannelLabel).join(" / ")}
          </Para>
        ) : null}
        <Para size="sm" tone="muted" className="my-0">
          宛先は変わりません
        </Para>
      </Stack>
    ) : (
      <Stack gap="md" data-slot="scheduled-edit-editor">
        <Stack gap="xs" data-slot="scheduled-edit-fixed">
          <DispatchTargetSummary dispatch={dispatch} roleLabelOf={roleLabelOf} />
          {m.layoutLabel ? (
            <Flex gap="md" wrap="wrap" data-slot="scheduled-edit-layout">
              <Span size="sm" tone="muted" className="min-w-28">
                レイアウト
              </Span>
              <Span size="sm">{m.layoutLabel}</Span>
            </Flex>
          ) : null}
        </Stack>
        {m.contentReason ? (
          <Para size="sm" tone="muted" className="my-0" data-slot="scheduled-edit-time-only">
            {m.contentReason}
          </Para>
        ) : m.materialLoading ? (
          <InlineLoader />
        ) : m.materialError ? (
          <Para size="sm" tone="destructive" className="my-0" data-slot="scheduled-edit-material-error">
            {err(m.materialError, "予約した送信の直しの材料を読めませんでした")}
          </Para>
        ) : m.contentEditable ? (
          <Stack gap="md" data-slot="scheduled-edit-content">
            {m.textFields ? (
              <Stack gap="2xs">
                <Span size="sm" weight="medium">
                  内容
                </Span>
                <LayoutFields control={m.textControl} fields={m.textFields} channels={m.channelsOn} />
              </Stack>
            ) : null}
            <Stack gap="2xs">
              <Span size="sm" weight="medium">
                送信方法
              </Span>
              <SendCategoryChannels
                categories={[]}
                category=""
                onCategoryChange={noop}
                showCategory={false}
                hideChannelLabel
                channels={m.channels}
                onToggleChannel={m.toggleChannel}
              />
              {m.channelsError ? (
                <Para size="sm" tone="destructive" className="my-0">
                  {m.channelsError}
                </Para>
              ) : null}
            </Stack>
          </Stack>
        ) : null}
        <Stack gap="2xs">
          <Span size="sm" weight="medium">
            予約日時
          </Span>
          <SendSchedule
            mode="at"
            showNow={false}
            scheduledAt={m.scheduledAt}
            error={m.timeChanged ? m.timeError : null}
            note={m.scheduleNote}
            onModeChange={noop}
            onScheduledAtChange={m.setScheduledAt}
          />
        </Stack>
        {m.error ? (
          <Para size="sm" tone="destructive" className="my-0" data-slot="scheduled-edit-error">
            {m.error}
          </Para>
        ) : null}
      </Stack>
    );

  const footer =
    m.step === "confirm" ? (
      <Flex justify="end" gap="xs">
        <Button type="button" size="sm" variant="outline" disabled={m.isSaving} onClick={m.backToEdit}>
          戻る
        </Button>
        <Button type="button" size="sm" variant="primary" loading={m.isSaving} onClick={() => void save()}>
          保存する
        </Button>
      </Flex>
    ) : (
      <Flex justify="end" gap="xs">
        <Button type="button" size="sm" variant="primary" disabled={!m.canConfirm} onClick={() => void m.toConfirm()}>
          確認に進む
        </Button>
      </Flex>
    );

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => m.setOpen(true)}>
        <CalendarClock className="size-4" />
        {TITLE}
      </Button>
      <Modal open={m.open} onOpenChange={m.setOpen} title={m.step === "confirm" ? `${TITLE}(確認)` : TITLE} maxWidth={720} footer={footer}>
        {body}
      </Modal>
    </>
  );
}
