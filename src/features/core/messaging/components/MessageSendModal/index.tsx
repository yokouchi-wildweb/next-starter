// src/features/core/messaging/components/MessageSendModal/index.tsx
// セクションコンテナ(管理: 送るモーダル。D87)。ボタンとモーダルを描き、hook useMessageSendModal を呼んで部品を並べるだけ。
// 開き方 mode: new(送信の一覧「新しく送る」)/ sameAs(送信の詳細「同じ内容で送る」)/ bulk(管理一覧の一括操作、bulkMessageAction)。
// new / sameAs の口を門 messagingBroadcast で出し分けるのは置き場の入れ物(AdminDispatchList / AdminDispatchDetail)。bulk は門の外。
// fork は自分の画面(例 発送リクエストの一覧)にもこの入れ物をそのまま置ける(公開の部品と hook)。
// 画面(D126): 左右 2 つのペイン(左 = プレビュー、右 = 操作。狭い画面は操作が上)。「あなた宛ての表示例」は上に重ねるモーダル(SampleForYouModal、D129)。
// 並び(D110 D115 D118): 種別とカテゴリーの 1 行 → 送信方法 → 宛先(種別が許す物)→ テンプレート(その種別の物、読み込まない = 白紙)
// → 内容 → 送る時刻。内容(D118 D119 D120): テンプレートを読み込んだ直後は文を固定して見せ、専用の埋め込み情報の入力だけ。
// 『文面を直す』でレイアウトの欄の入力(LayoutFields)と埋め込み情報のタグ、『テンプレートを更新』(Dialog で確かめる、送るとは別)。
// プレビュー = レイアウトの実際の描き方(LayoutPreview、送信チャンネルのタブ、未入力は仮の文。種別を選ぶまでは案内だけ)。「あなた宛ての表示例」のボタン = 送る口で描いた表示例(埋め込み情報を差し込む)
// 手で直した書きかけの上に読み込む時は Dialog で確かめる。書きかけのまま閉じる = Modal の confirmOnClose。ページの移動は hook の中の @/lib/unsavedGuard

"use client";

import { useState, type ReactNode } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import Dialog from "@/components/Overlays/Dialog";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { CreateButton } from "@/lib/crud";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { VarPopover } from "@/features/core/messaging/components/common/VarPopover";
import { LayoutFields } from "@/features/core/messaging/components/common/LayoutFields";
import { LayoutPreview } from "@/features/core/messaging/components/common/LayoutPreview";
import { dispatchDetailHref } from "@/features/core/messaging/hooks/useDispatchDetailParam";
import { SampleForYouModal } from "@/features/core/messaging/components/common/SampleForYouModal";
import { SendTargetPicker } from "@/features/core/messaging/components/common/SendTargetPicker";
import { KindCategoryFields } from "@/features/core/messaging/components/common/KindCategoryFields";
import { SendCategoryChannels } from "@/features/core/messaging/components/common/SendCategoryChannels";
import { SendConfirmView, SendResultView } from "@/features/core/messaging/components/common/SendConfirmView";
import { SendSchedule } from "@/features/core/messaging/components/common/SendSchedule";
import { SendVarInputs, SendTemplatePicker } from "@/features/core/messaging/components/common/SendTemplatePicker";
import { useVarTags } from "@/features/core/messaging/hooks/useVarTags";
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
  /** 送信一覧の住所(既定 /admin/messaging)。送った後の「送信の詳細」は <住所>?dispatch=<id>(一覧の上のモーダル、D130) */
  dispatchBasePath?: string;
};

const DEFAULT_LABEL: Record<MessageSendMode["type"], string> = { new: "新規送信", sameAs: "同じ内容で送る", bulk: "一括送信" };

/** 送信設定の行の見出し(左の列。操作の 1 行目と高さを合わせる) */
function SettingLabel({ children }: { children: ReactNode }) {
  return (
    <Span size="sm" weight="medium" tone="muted" className="sm:pt-2.5">
      {children}
    </Span>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs" className="rounded-md border border-border p-3">
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
  const tags = useVarTags({ catalog: m.varCatalog });
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
      // Dialog は自分では閉じない。閉じるのは成功した時だけ(失敗は開いたままで知らせ、やり直すか取り消す)
      setConfirmingUpdate(false);
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
        <InlineLoader />
      );
    }
    if (m.step === "done" && m.result) {
      const res = m.result.result;
      return (
        <SendResultView
          status={res.status}
          queuedCount={m.result.kind === "send" ? m.result.result.queuedCount : m.result.result.counts.queuedCount}
          dispatchHref={res.dispatchId ? dispatchDetailHref(dispatchBasePath, res.dispatchId) : null}
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
    const controls = (
      <Stack gap="md">
        {m.sameAsNote ? (
          <Para size="sm" tone="muted" className="my-0" data-slot="send-same-as-note">
            {m.sameAsNote}
          </Para>
        ) : null}
        {/* 送信設定 = 枠 1 つに「左の見出し | 右の操作」の行(見出しは 1 回だけ。狭い画面は見出しが上) */}
        <Block title="送信設定">
          <Grid className="grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]" data-slot="send-settings">
            <SettingLabel>種別</SettingLabel>
            <KindCategoryFields
              idPrefix="send"
              hideLabels
              kinds={m.kinds.map((item) => ({ value: item.key, label: item.label }))}
              kind={m.kind}
              onKindChange={m.setKind}
              categories={m.categories.map((item) => ({ value: item.key, label: item.label }))}
              category={m.category}
              onCategoryChange={m.setCategory}
            />
            <SettingLabel>送信方法</SettingLabel>
            <SendCategoryChannels
              showCategory={false}
              hideChannelLabel
              categories={m.categories}
              category={m.category}
              onCategoryChange={m.setCategory}
              channels={m.channels}
              onToggleChannel={m.toggleChannel}
            />
            <SettingLabel>宛先</SettingLabel>
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
            <SettingLabel>テンプレート</SettingLabel>
            <SendTemplatePicker
              templates={m.pickerTemplates}
              blank={m.currentLayout ?? m.blank}
              loaded={m.loadedTemplate ? { ...m.loadedTemplate, edited: text.edited } : null}
              onLoad={m.loadTemplate}
              onUnload={m.unloadTemplate}
            />
          </Grid>
        </Block>
        <Block title="内容">
          {text.state && text.layout ? (
            <Stack gap="md" data-slot="send-content">
              {m.loadedTemplate ? (
                <Stack gap="xs">
                  <SecTitle as="h4" size="sm">
                    専用の埋め込み情報
                  </SecTitle>
                  <SendVarInputs
                    declarations={text.state.varDeclarations}
                    values={text.state.vars}
                    onChange={text.setVars}
                    missing={text.missingVars.map((item) => item.key)}
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
              ) : null}
              {text.locked ? null : (
                <LayoutFields control={text.control} fields={text.fields} channels={m.sendChannels} activeChannel={m.layoutPreview.channel} />
              )}
              {m.text.canUpdateTemplate ? (
                <Flex justify="end" gap="xs" align="center">
                  <Span size="xs" tone="muted">
                    直した文面は、この送信だけに使われます。テンプレートにも反映する時は更新してください
                  </Span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!text.edited}
                    loading={text.isUpdatingTemplate}
                    onClick={() => setConfirmingUpdate(true)}
                  >
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
      </Stack>
    );
    // 左右 2 つのペイン(D126、テンプレートのモーダルと同じ形): 左 = プレビュー(md 以上は上に留まる)、右 = 操作。狭い画面は操作が上
    return (
      <Flex direction="column" gap="xl" className="md:flex-row-reverse md:items-start" data-slot="send-editor">
        <Stack gap="md" className="min-w-0 md:w-1/2" data-slot="send-editor-controls">
          {controls}
        </Stack>
        <Stack gap="sm" className="min-w-0 md:sticky md:top-0 md:w-1/2" data-slot="send-editor-preview">
          <SecTitle as="h4" size="sm">
            プレビュー
          </SecTitle>
          {m.kind ? (
            <LayoutPreview
              layout={m.layoutPreview.layout}
              channels={m.layoutPreview.channels}
              channel={m.layoutPreview.channel}
              onChannelChange={m.layoutPreview.setChannel}
              content={m.layoutPreview.content}
              loading={m.layoutPreview.loading}
              error={m.layoutPreview.error}
              incompleteChannels={m.layoutPreview.incompleteChannels}
            />
          ) : (
            <Para size="sm" tone="muted" className="my-0">
              種別を選ぶとプレビューが出ます
            </Para>
          )}
        </Stack>
      </Flex>
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
          <Button type="button" size="sm" variant="primary" disabled={m.estimateOverLimit} loading={m.isSending} onClick={() => void send()}>
            {m.showSchedule && m.scheduleMode === "at" ? "予約する" : "送信する"}
          </Button>
        </Flex>
      );
    }
    // 書く段の下の帯: 左 = 埋め込み情報の吹き出し(上に開く。文面を直せる時だけ)、右 = 表示例・テスト送信・確認に進む
    return (
      <Flex align="center" justify="between" gap="md" wrap="wrap">
        {text.state && !text.locked ? (
          <VarPopover common={tags.common} own={tags.own} onCopy={(alias) => void tags.copy(alias)} />
        ) : (
          <Span size="xs">{null}</Span>
        )}
        <Flex justify="end" gap="xs" wrap="wrap">
          <Button type="button" size="sm" variant="outline" disabled={Boolean(m.contentError)} loading={m.isPreviewing} onClick={() => void preview()}>
            あなた宛ての表示例
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={Boolean(m.contentError)} loading={m.isTesting} onClick={() => void sendTest()}>
            自分にテスト送信
          </Button>
          <Button type="button" size="sm" variant="primary" disabled={!m.canSend} loading={isEstimating} onClick={() => void toConfirm()}>
            確認に進む
          </Button>
        </Flex>
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
        maxWidth={1200}
        // 高さは固定(書く・確認・送った後で揺れない。中身は本文の中でスクロール、低い画面では Modal が縮める)
        maxHeight="85vh"
        height="85vh"
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
      <SampleForYouModal
        open={Boolean(m.preview) && m.open}
        onOpenChange={(next) => {
          if (!next) m.closePreview();
        }}
        channels={(m.preview?.channels ?? []).map((channel) => ({ ...channel, layoutFields: m.previewLayoutFields }))}
      />
    </>
  );
}
