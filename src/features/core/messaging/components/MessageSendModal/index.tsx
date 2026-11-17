// src/features/core/messaging/components/MessageSendModal/index.tsx
// セクションコンテナ(管理: 送るモーダル。D87)。ボタンとモーダルを描き、hook useMessageSendModal を呼んで部品を並べるだけ。
// 開き方 mode: new(回の一覧「新しく送る」)/ sameAs(回の詳細「同じ内容で送る」)/ bulk(管理一覧の一括操作、bulkMessageAction)。
// new / sameAs の口を門 messagingBroadcast で出し分けるのは置き場の入れ物(AdminDispatchList / AdminDispatchDetail)。bulk は門の外。
// fork は自分の画面(例 発送リクエストの一覧)にもこの入れ物をそのまま置ける(公開の部品と hook)。
// 並び(D110 D115): 種別 → カテゴリー(2 つ以上の時だけ)と送信方法 → 宛先(種別が許す物)→ テンプレート(その種別の物、読み込まない = 白紙)
// → 内容 → 送る時刻。内容(D118 D119 D120): テンプレートを読み込んだ直後は文を固定して見せ、専用の埋め込み情報の入力だけ。
// 『文面を直す』でひな形の欄の入力(LayoutFields)と埋め込み情報のタグ、『テンプレートを更新』(Dialog で確かめる、送るとは別)。
// プレビュー = ひな形の実際の描き方(LayoutPreview、経路のタブ、未入力は仮の文)。「あなた宛ての表示例」のボタン = 送る口で描いた表示例(埋め込み情報を差し込む)
// 手で直した書きかけの上に読み込む時は Dialog で確かめる。書きかけのまま閉じる = Modal の confirmOnClose。ページの移動は hook の中の @/lib/unsavedGuard

"use client";

import { useState, type ReactNode } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import Dialog from "@/components/Overlays/Dialog";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { CreateButton } from "@/lib/crud/components";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { SoftBadge } from "@/components/Badge";
import { EmbeddedInfoTags } from "@/features/core/messaging/components/common/EmbeddedInfoTags";
import { LayoutFields } from "@/features/core/messaging/components/common/LayoutFields";
import { LayoutPreview } from "@/features/core/messaging/components/common/LayoutPreview";
import { MessagePreview } from "@/features/core/messaging/components/common/MessagePreview";
import { SendTargetPicker } from "@/features/core/messaging/components/common/SendTargetPicker";
import { SendCategoryChannels, SendKindPicker } from "@/features/core/messaging/components/common/SendCategoryChannels";
import { SendConfirmView, SendResultView } from "@/features/core/messaging/components/common/SendConfirmView";
import { SendLegalNotice } from "@/features/core/messaging/components/common/SendLegalNotice";
import { SendSchedule } from "@/features/core/messaging/components/common/SendSchedule";
import { SendEmbeddedInputs, SendTemplatePicker } from "@/features/core/messaging/components/common/SendTemplatePicker";
import { useEmbeddedInfoTags } from "@/features/core/messaging/hooks/useEmbeddedInfoTags";
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

const DEFAULT_LABEL: Record<MessageSendMode["type"], string> = { new: "新規送信", sameAs: "同じ内容で送る", bulk: "一括送信" };

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
  const tags = useEmbeddedInfoTags({ catalog: m.embeddedCatalog });
  const bulk = mode.type === "bulk" ? mode : null;
  const text = m.text;
  /** 『テンプレートを更新』の確かめを出しているか */
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);

  const { execute: preview } = useAsyncAction(async () => {
    try {
      await m.runPreview();
    } catch (e) {
      showToast(err(e, "プレビューを表示できませんでした"), "error");
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
      showToast(err(e, "宛先数を確認できませんでした"), "error");
    }
  });
  const updateTemplate = async () => {
    try {
      const updated = await m.updateTemplate();
      showToast(updated.unchanged ? "変更はありません" : `テンプレートを更新しました(v${updated.version})`, updated.unchanged ? "info" : "success");
    } catch (e) {
      showToast(err(e, "テンプレートを更新できませんでした"), "error");
    }
  };
  const { execute: send } = useAsyncAction(async () => {
    try {
      const sent = await m.confirmSend();
      showToast(sent.kind === "send" && sent.result.status === "scheduled" ? "予約しました" : "送信を受け付けました", "success");
    } catch (e) {
      showToast(err(e, "送信できませんでした"), "error");
    }
  });

  const categoryLabel = m.categories.find((option) => option.key === m.category)?.label ?? m.category;
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
          templateVersion={m.loadedTemplate?.version ?? null}
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
        <Block title="種別">
          <SendKindPicker kinds={m.kinds} value={m.kind} onChange={m.setKind} />
        </Block>
        <Block title={m.categories.length > 1 ? "カテゴリーと送信方法" : "送信方法"}>
          <SendCategoryChannels
            categories={m.categories}
            category={m.category}
            onCategoryChange={m.setCategory}
            channels={m.channels}
            onToggleChannel={m.toggleChannel}
          />
          <SendLegalNotice emailOn={onChannels.some((channel) => channel.key === "email")} />
        </Block>
        <Block title="宛先">
          {bulk ? (
            <SendTargetPicker kind="bulk" recordCount={bulk.recordIds.length} recordNoun={bulk.recordNoun} />
          ) : (
            <SendTargetPicker
              kind="select"
              value={m.target}
              onChange={m.setTarget}
              roles={m.roles}
              groups={m.groups}
              groupsEnabled={m.groupsEnabled}
              note={m.targetNote}
              allowedTypes={m.allowedTargetTypes}
            />
          )}
        </Block>
        <Block title="テンプレート">
          <SendTemplatePicker
            templates={m.templatesAvailable ? m.templates : []}
            blank={m.blank}
            loaded={m.loadedTemplate ? { ...m.loadedTemplate, edited: text.edited } : null}
            onLoad={m.loadTemplate}
            onUnload={m.unloadTemplate}
          />
        </Block>
        <Block title="内容">
          {text.state && text.layout ? (
            <Stack space={4} data-slot="send-content">
              {m.loadedTemplate ? (
                <Stack space={2}>
                  <SecTitle as="h4" size="sm">
                    専用の埋め込み情報
                  </SecTitle>
                  <SendEmbeddedInputs
                    declarations={text.state.embeddedDeclarations}
                    values={text.state.embedded}
                    onChange={text.setEmbedded}
                    missing={text.missingEmbedded.map((item) => item.key)}
                  />
                </Stack>
              ) : null}
              {text.locked ? (
                <Flex align="center" gap="xs" wrap="wrap" data-slot="send-text-locked">
                  <SoftBadge variant="secondary" size="sm">
                    文面はテンプレートのまま
                  </SoftBadge>
                  <Button type="button" size="sm" variant="outline" onClick={text.unlock}>
                    文面を直す
                  </Button>
                </Flex>
              ) : (
                <EmbeddedInfoTags common={tags.common} own={tags.own} onCopy={(alias) => void tags.copy(alias)} />
              )}
              <Stack space={2} data-slot="send-layout-preview">
                <SecTitle as="h4" size="sm">
                  プレビュー
                </SecTitle>
                <LayoutPreview
                  layout={m.layoutPreview.layout}
                  channels={m.layoutPreview.channels}
                  channel={m.layoutPreview.channel}
                  onChannelChange={m.layoutPreview.setChannel}
                  content={m.layoutPreview.content}
                  loading={m.layoutPreview.loading}
                  error={m.layoutPreview.error}
                />
              </Stack>
              {text.locked ? null : <LayoutFields control={text.control} fields={text.fields} channels={m.sendChannels} />}
              {m.text.canUpdateTemplate ? (
                <Flex justify="end" gap="xs" align="center">
                  <Span size="xs" tone="muted">
                    直した文面は、この送信だけに使われます。テンプレートにも反映する時は更新してください
                  </Span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!text.edited || text.isUpdatingTemplate}
                    onClick={() => setConfirmingUpdate(true)}
                  >
                    {text.isUpdatingTemplate ? <Spinner className="size-4" /> : null}
                    テンプレートを更新
                  </Button>
                </Flex>
              ) : null}
            </Stack>
          ) : (
            <Para size="sm" tone="muted" className="my-0">
              {m.contentError ?? "内容を読み込めません"}
            </Para>
          )}
        </Block>
        {m.showSchedule ? (
          <Block title="送信日時">
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
        {m.contentError || m.targetError ? (
          <Para size="sm" tone="muted" className="my-0">
            {m.targetError ?? m.contentError}
          </Para>
        ) : null}
        {m.preview ? (
          <Block title="あなた宛ての表示例">
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
          <Button type="button" size="sm" variant="primary" disabled={m.isSending || m.estimateOverLimit} onClick={() => void send()}>
            {m.isSending ? <Spinner className="size-4" /> : null}
            {m.showSchedule && m.scheduleMode === "at" ? "予約する" : "送信する"}
          </Button>
        </Flex>
      );
    }
    return (
      <Flex justify="end" gap="xs" wrap="wrap">
        <Button type="button" size="sm" variant="outline" disabled={Boolean(m.contentError) || m.isPreviewing} onClick={() => void preview()}>
          {m.isPreviewing ? <Spinner className="size-4" /> : null}
          あなた宛ての表示例
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={Boolean(m.contentError) || m.isTesting} onClick={() => void sendTest()}>
          {m.isTesting ? <Spinner className="size-4" /> : null}
          自分にテスト送信
        </Button>
        <Button type="button" size="sm" variant="primary" disabled={!m.canSend || isEstimating} onClick={() => void toConfirm()}>
          {isEstimating ? <Spinner className="size-4" /> : null}
          確認に進む
        </Button>
      </Flex>
    );
  };

  const title = label ?? DEFAULT_LABEL[mode.type];
  return (
    <>
      {mode.type === "new" ? (
        // 一覧の上の「新規送信」は管理一覧の「新規作成」と同じ形(CreateButton。アイコンは送る印)
        <CreateButton icon={Send} label={title} variant={triggerVariant} disabled={disabled} onClick={() => m.setOpen(true)} />
      ) : (
        <Button type="button" size="sm" variant={triggerVariant} disabled={disabled} onClick={() => m.setOpen(true)}>
          {icon}
          {title}
        </Button>
      )}
      <Modal
        open={m.open}
        onOpenChange={m.setOpen}
        title={m.step === "confirm" ? `${title}(確認)` : title}
        maxWidth={960}
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
        description="入力中の内容は、テンプレートの内容に置き換わります。"
        confirmLabel="置き換える"
        cancelLabel="キャンセル"
        onConfirm={m.confirmLoad}
      />
      <Dialog
        open={confirmingUpdate}
        onOpenChange={setConfirmingUpdate}
        title="テンプレートを更新しますか"
        description="直した文面をテンプレートの新しい版として公開します(送信はまだ行いません)。"
        confirmLabel="更新する"
        cancelLabel="キャンセル"
        onConfirm={updateTemplate}
      />
    </>
  );
}
