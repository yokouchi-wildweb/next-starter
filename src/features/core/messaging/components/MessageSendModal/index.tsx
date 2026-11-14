// src/features/core/messaging/components/MessageSendModal/index.tsx
// セクションコンテナ(管理: 送るモーダル。D87)。ボタンとモーダルを描き、hook useMessageSendModal を呼んで部品を並べるだけ。
// 開き方 mode: new(回の一覧「新しく送る」)/ sameAs(回の詳細「同じ内容で送る」)/ bulk(管理一覧の一括操作、bulkMessageAction)。
// new / sameAs の口を門 messagingBroadcast で出し分けるのは置き場の入れ物(AdminDispatchList / AdminDispatchDetail)。bulk は門の外。
// fork は自分の画面(例 発送リクエストの一覧)にもこの入れ物をそのまま置ける(公開の部品と hook)。
// 並び(D47): 宛先 → テンプレートから読み込む(任意) → カテゴリーと経路 → 文言 → 送る時刻。手で直した書きかけの上に読み込む時は Dialog で確かめる。
// 書きかけのまま閉じる = Modal の confirmOnClose で確かめる。ページの移動は hook の中の @/lib/unsavedGuard

"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import Dialog from "@/components/Overlays/Dialog";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { MessagePreview } from "@/features/core/messaging/components/common/MessagePreview";
import { SendAudiencePicker } from "@/features/core/messaging/components/common/SendAudiencePicker";
import { SendCategoryChannels } from "@/features/core/messaging/components/common/SendCategoryChannels";
import { SendConfirmView, SendResultView } from "@/features/core/messaging/components/common/SendConfirmView";
import { SendContentFields } from "@/features/core/messaging/components/common/SendContentFields";
import { SendLegalNotice } from "@/features/core/messaging/components/common/SendLegalNotice";
import { SendSchedule } from "@/features/core/messaging/components/common/SendSchedule";
import { SendTemplatePicker } from "@/features/core/messaging/components/common/SendTemplatePicker";
import {
  useMessageSendModal,
  type MessageSendMode,
  type MessageSendResult,
} from "@/features/core/messaging/hooks/useMessageSendModal";

export type MessageSendModalProps = {
  mode: MessageSendMode;
  /** 開くボタンの文言(既定: new = 新しく送る、sameAs = 同じ内容で送る、bulk = 一括送信) */
  label?: string;
  /** 開くボタンの見た目 */
  triggerVariant?: "primary" | "outline";
  /** 開くボタンを押せないか */
  disabled?: boolean;
  /** 開くボタンの頭に描く物(アイコンなど) */
  icon?: ReactNode;
  /** 送った後(結果を出した時) */
  onSent?: (result: MessageSendResult) => void;
  /** 回の画面の住所の頭(既定 /admin/messaging) */
  dispatchBasePath?: string;
};

const DEFAULT_LABEL: Record<MessageSendMode["type"], string> = { new: "新しく送る", sameAs: "同じ内容で送る", bulk: "一括送信" };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack space={2} className="rounded-md border border-border p-3">
      <SecTitle as="h3" size="md">
        {title}
      </SecTitle>
      {children}
    </Stack>
  );
}

export function MessageSendModal({
  mode,
  label,
  triggerVariant = "outline",
  disabled = false,
  icon,
  onSent,
  dispatchBasePath = "/admin/messaging",
}: MessageSendModalProps) {
  const { showToast } = useToast();
  const m = useMessageSendModal({ mode, onSent });
  const bulk = mode.type === "bulk" ? mode : null;

  const { execute: preview } = useAsyncAction(async () => {
    try {
      await m.runPreview();
    } catch (e) {
      showToast(err(e, "プレビューを作れませんでした"), "error");
    }
  });
  const { execute: sendTest } = useAsyncAction(async () => {
    try {
      await m.sendTest();
      showToast("自分にテスト送信しました", "success");
    } catch (e) {
      showToast(err(e, "テスト送信できませんでした"), "error");
    }
  });
  const { execute: toConfirm, isExecuting: isEstimating } = useAsyncAction(async () => {
    try {
      await m.requestConfirm();
    } catch (e) {
      showToast(err(e, "宛先の数を見込めませんでした"), "error");
    }
  });
  const { execute: send } = useAsyncAction(async () => {
    try {
      const sent = await m.confirmSend();
      showToast(sent.kind === "send" && sent.result.status === "scheduled" ? "予約しました" : "送信を受け付けました", "success");
    } catch (e) {
      showToast(err(e, "送れませんでした"), "error");
    }
  });

  const categoryLabel = m.allowedCategories.find((option) => option.key === m.category)?.label ?? m.category;
  const onChannels = m.channels.filter((channel) => channel.on);

  const body = () => {
    if (!m.optionsLoaded) {
      if (m.optionsError) return <Para tone="destructive">{err(m.optionsError, "選択肢を取得できませんでした")}</Para>;
      return (
        <Flex justify="center" className="py-8">
          <Spinner className="size-6" />
        </Flex>
      );
    }
    if (m.step === "done" && m.result) {
      const res = m.result.result;
      return (
        <SendResultView
          status={res.status}
          queuedCount={m.result.kind === "send" ? m.result.result.queuedCount : m.result.result.counts.queuedCount}
          dispatchHref={res.dispatchId ? `${dispatchBasePath}/${encodeURIComponent(res.dispatchId)}` : null}
          afterSend={m.result.kind === "bulk" ? m.result.result.afterSend : null}
          recordNoun={bulk?.recordNoun}
        />
      );
    }
    if (m.step === "confirm") {
      return (
        <SendConfirmView
          estimate={m.estimate}
          bulk={bulk ? { recordCount: bulk.recordIds.length, recordNoun: bulk.recordNoun } : null}
          scheduledAt={m.showSchedule && m.scheduleMode === "at" ? m.scheduledAt : null}
          templateVersion={m.draft.template?.version ?? null}
          channels={onChannels.map((channel) => channel.label)}
          categoryLabel={categoryLabel}
        />
      );
    }
    return (
      <Stack space={4}>
        {m.sameAsNote ? (
          <Para size="sm" tone="muted" className="my-0" data-slot="send-same-as-note">
            {m.sameAsNote}
          </Para>
        ) : null}
        <Block title="宛先">
          {bulk ? (
            <SendAudiencePicker kind="bulk" recordCount={bulk.recordIds.length} recordNoun={bulk.recordNoun} />
          ) : (
            <SendAudiencePicker kind="select" value={m.audience} onChange={m.setAudience} roles={m.roles} audiences={m.audiences} />
          )}
        </Block>
        {m.templatesAvailable ? (
          <Stack space={1}>
            <SendTemplatePicker
              templates={m.templates}
              loaded={m.loadedTemplate && m.draft.template ? { id: m.loadedTemplate.id, name: m.loadedTemplate.name, version: m.draft.template.version } : null}
              onLoad={m.loadTemplate}
              onUnload={m.unloadTemplate}
            />
            {m.loadNote ? (
              <Para size="sm" tone="muted" className="my-0" data-slot="send-load-note">
                {m.loadNote}
              </Para>
            ) : null}
          </Stack>
        ) : null}
        <Block title="カテゴリーと経路">
          <SendCategoryChannels
            categories={m.allowedCategories}
            category={m.category}
            onCategoryChange={m.setCategory}
            channels={m.channels}
            onToggleChannel={m.toggleChannel}
          />
          <SendLegalNotice emailOn={onChannels.some((channel) => channel.key === "email")} />
        </Block>
        <Block title="文言">
          <SendContentFields
            // 呼び出し・やめるで中身が入れ替わったら欄を作り直す(fork の経路の JSON の欄は書いている文を自分で持つ)
            key={`${m.draft.source}:${m.draft.template?.id ?? ""}`}
            source={m.draft.source}
            channels={onChannels}
            content={m.draft.content}
            onChange={m.setChannelFields}
            variables={(m.loadedTemplate?.variables ?? []).filter((variable) => variable.source === "dispatch")}
            vars={m.draft.vars}
            onVarChange={m.setVar}
          />
        </Block>
        {m.showSchedule ? (
          <Block title="送る時刻">
            <SendSchedule
              mode={m.scheduleMode}
              scheduledAt={m.scheduledAt}
              error={m.scheduleError}
              note={m.scheduleNote}
              onModeChange={m.setScheduleMode}
              onScheduledAtChange={m.setScheduledAt}
            />
          </Block>
        ) : null}
        {m.contentError || m.audienceError ? (
          <Para size="sm" tone="muted" className="my-0">
            {m.audienceError ?? m.contentError}
          </Para>
        ) : null}
        {m.preview ? (
          <Block title="プレビュー(見本の宛先 = あなた)">
            <MessagePreview channels={m.preview.channels} />
          </Block>
        ) : null}
      </Stack>
    );
  };

  const footer = () => {
    if (!m.optionsLoaded) return null;
    if (m.step === "done") {
      return (
        <Flex justify="end" gap="xs">
          <Button type="button" size="sm" variant="primary" onClick={() => m.setOpen(false)}>
            閉じる
          </Button>
        </Flex>
      );
    }
    if (m.step === "confirm") {
      return (
        <Flex justify="end" gap="xs">
          <Button type="button" size="sm" variant="outline" disabled={m.isSending} onClick={m.backToEdit}>
            戻る
          </Button>
          <Button type="button" size="sm" variant="primary" disabled={m.isSending} onClick={() => void send()}>
            {m.isSending ? <Spinner className="size-4" /> : null}
            {m.showSchedule && m.scheduleMode === "at" ? "予約する" : "送る"}
          </Button>
        </Flex>
      );
    }
    return (
      <Flex justify="end" gap="xs" wrap="wrap">
        <Button type="button" size="sm" variant="outline" disabled={Boolean(m.contentError) || m.isPreviewing} onClick={() => void preview()}>
          {m.isPreviewing ? <Spinner className="size-4" /> : null}
          プレビュー
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={Boolean(m.contentError) || m.isTesting} onClick={() => void sendTest()}>
          {m.isTesting ? <Spinner className="size-4" /> : null}
          自分にテスト送信
        </Button>
        <Button type="button" size="sm" variant="primary" disabled={!m.canSend || isEstimating} onClick={() => void toConfirm()}>
          {isEstimating ? <Spinner className="size-4" /> : null}
          確認へ
        </Button>
      </Flex>
    );
  };

  const title = label ?? DEFAULT_LABEL[mode.type];
  return (
    <>
      <Button type="button" size="sm" variant={triggerVariant} disabled={disabled} onClick={() => m.setOpen(true)}>
        {icon}
        {title}
      </Button>
      <Modal
        open={m.open}
        onOpenChange={m.setOpen}
        title={m.step === "confirm" ? `${title}(確認)` : title}
        maxWidth={720}
        maxHeight="85vh"
        confirmOnClose={m.closeConfirm}
        footer={footer()}
      >
        {body()}
      </Modal>
      <Dialog
        open={m.pendingLoad !== null}
        onOpenChange={(next) => {
          if (!next) m.cancelLoad();
        }}
        title="テンプレートを読み込みますか"
        description="今書いている文言は、テンプレートの文言で置き換わります。"
        confirmLabel="置き換えて読み込む"
        cancelLabel="やめる"
        onConfirm={m.confirmLoad}
      />
    </>
  );
}
