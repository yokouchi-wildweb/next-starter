// src/domains/core/messaging/components/DefinitionSendModal/index.tsx
// セクションコンテナ(管理: 定義連絡の汎用の送るモーダル、D164)。ボタンとモーダルを描き、hook useDefinitionSendModal を呼んで部品を並べるだけ。
// 目的の props は無い。入口 entry: records(一覧の一括操作 definitionBulkAction、門の外)/ broadcast(全員・ロール・グループ、門 messagingBroadcast が閉なら何も描かない)。
// 書く段(1 列。定義の中身はコードが持ち、選択肢は直せる欄の値しか返さないので、自由連絡のような描き方のプレビューは置かない):
// 送る連絡(1 つならそれ)+ 説明の文 adminText.description → 送信方法(off は出さない、on・required のメールは外せない)→ 宛先 → 管理者の値
// → 内容(直せる欄だけ、required・直せる欄なし = 箱なし、D169)→ 送信日時(broadcast だけ)。下の帯: あなた宛ての表示例(記録は最初の記録)・自分にテスト送信・確認に進む。
// 確認の段 = DefinitionSendConfirm(adminText.confirm。全員・ロール・グループは人数の見込み = RecipientEstimateView、上限を超えたら送るを押せない)。結果の段 = SendResultView + 送信の結果 SendResult(useSendResults、D214 (1))。
// fork は同じ hook と部品で自前のモーダルを組める(D191)

"use client";

import type { ReactNode } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Label } from "@/components/Input/Label";
import { SelectInput } from "@/components/Input/Select";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { LayoutFields } from "@/domains/core/messaging/components/common/LayoutFields";
import { SampleForYouModal } from "@/domains/core/messaging/components/common/SampleForYouModal";
import { SendCategoryChannels } from "@/domains/core/messaging/components/common/SendCategoryChannels";
import { SendResultView } from "@/domains/core/messaging/components/common/SendConfirmView";
import { SendResult } from "@/domains/core/messaging/components/common/SendResult";
import { SendSchedule } from "@/domains/core/messaging/components/common/SendSchedule";
import { SendTargetPicker } from "@/domains/core/messaging/components/common/SendTargetPicker";
import { SendVarInputs } from "@/domains/core/messaging/components/common/SendTemplatePicker";
import {
  dispatchDetailHref,
  useDefinitionSendModal,
  useSendResults,
  type DefinitionSendEntry,
  type DefinitionSendModalState,
} from "@/domains/core/messaging/hooks";
import type { AdminDefinitionSendResult } from "@/domains/core/messaging/services/client/definitionSendClient";

import { DefinitionSendConfirm } from "./DefinitionSendConfirm";

export { DefinitionSendConfirm, type DefinitionSendConfirmProps } from "./DefinitionSendConfirm";

export type DefinitionSendModalProps = {
  entry: DefinitionSendEntry;
  /** 開くボタンの文言(既定「連絡を送る」) */
  label?: string;
  /** 開くボタンの見た目 */
  triggerVariant?: "primary" | "outline";
  disabled?: boolean;
  /** 開くボタンの頭に描く物(アイコンなど) */
  icon?: ReactNode;
  /** 送った後(結果を出した時) */
  onSent?: (result: AdminDefinitionSendResult) => void;
  /** 送信一覧の住所(既定 /admin/messaging)。送った後の「送信の詳細」は <住所>?dispatch=<id> */
  dispatchBasePath?: string;
};

const DEFAULT_LABEL = "連絡を送る";

/** 確認の段の宛先の文 */
export function definitionRecipientsText(
  m: Pick<DefinitionSendModalState, "entry" | "recordCount" | "recordNoun" | "target" | "roles" | "groups">,
): string {
  if (m.entry.type === "records") return `選択した ${m.recordCount} 件の${m.recordNoun}に関連するユーザー`;
  if (m.target.type === "role") {
    const names = m.target.roles.map((id) => m.roles.find((role) => role.id === id)?.label ?? id);
    return `ロール: ${names.join("・")}`;
  }
  if (m.target.type === "group") return `グループ: ${m.groups.find((group) => group.id === m.target.groupId)?.label ?? "-"}`;
  return "全員";
}

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

export function DefinitionSendModal({
  entry,
  label,
  triggerVariant = "outline",
  disabled = false,
  icon,
  onSent,
  dispatchBasePath = "/admin/messaging",
}: DefinitionSendModalProps) {
  const { showToast } = useToast();
  const m = useDefinitionSendModal({ entry, onSent });
  const results = useSendResults(m.result?.dispatchId ?? null, { enabled: m.step === "done" });

  const { execute: preview } = useAsyncAction(async () => {
    try {
      await m.runPreview();
    } catch (e) {
      showToast(err(e, "表示例を表示できませんでした"), "error");
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
  const { execute: toConfirm, isExecuting: isConfirming } = useAsyncAction(async () => {
    try {
      await m.requestConfirm();
    } catch (e) {
      showToast(err(e, "内容を確認してください"), "error");
    }
  });
  const { execute: send } = useAsyncAction(async () => {
    try {
      const sent = await m.confirmSend();
      showToast(sent.status === "scheduled" ? "予約しました" : "送信を受け付けました", "success");
    } catch (e) {
      showToast(err(e, "送信できませんでした"), "error");
    }
  });

  if (!m.available) return null;

  const definition = m.definition;
  const onChannelLabels = m.channels.filter((channel) => channel.on).map((channel) => channel.label);
  const scheduledAt = m.showSchedule && m.scheduleMode === "at" ? m.scheduledAt : null;

  const body = () => {
    if (!m.optionsLoaded) {
      if (m.optionsError) return <Para tone="destructive">{err(m.optionsError, "選択肢を取得できませんでした")}</Para>;
      return <InlineLoader />;
    }
    if (m.step === "done" && m.result) {
      return (
        <Stack gap="md" data-slot="definition-send-result">
          <SendResultView
            status={m.result.status}
            queuedCount={m.result.counts.queuedCount}
            dispatchHref={m.result.dispatchId ? dispatchDetailHref(dispatchBasePath, m.result.dispatchId) : null}
            afterSend={m.result.afterSend}
            recordNoun={m.entry.type === "records" ? m.recordNoun : undefined}
          />
          {m.result.dispatchId ? <SendResult channels={results.channels} failed={results.failed} /> : null}
        </Stack>
      );
    }
    if (m.step === "confirm" && definition) {
      return (
        <DefinitionSendConfirm
          definitionLabel={definition.label}
          recipients={definitionRecipientsText(m)}
          channels={onChannelLabels}
          scheduledAt={scheduledAt}
          confirmText={definition.adminText?.confirm ?? null}
          estimate={m.entry.type === "broadcast" ? m.estimate : undefined}
        />
      );
    }
    return (
      <Stack gap="md" data-slot="definition-send-editor">
        <Block title="送信設定">
          <Grid className="grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]" data-slot="definition-send-settings">
            <SettingLabel>連絡</SettingLabel>
            {m.definitions.length > 1 ? (
              <Stack gap="2xs">
                <Label htmlFor="definition-send-message" className="sr-only">
                  送る連絡
                </Label>
                <SelectInput
                  id="definition-send-message"
                  value={definition?.key ?? ""}
                  options={m.definitions.map((item) => ({ value: item.key, label: item.label }))}
                  onChange={(value) => m.chooseDefinition(value ? String(value) : "")}
                />
              </Stack>
            ) : (
              <Span size="sm" className="sm:pt-2.5" data-slot="definition-send-message">
                {definition?.label ?? m.definitionError}
              </Span>
            )}
            {definition ? (
              <>
                <SettingLabel>送信方法</SettingLabel>
                <SendCategoryChannels
                  categories={[]}
                  category=""
                  onCategoryChange={() => undefined}
                  showCategory={false}
                  hideChannelLabel
                  channels={m.channels}
                  onToggleChannel={m.toggleChannel}
                />
                <SettingLabel>宛先</SettingLabel>
                {m.entry.type === "records" ? (
                  <SendTargetPicker kind="bulk" recordCount={m.recordCount} recordNoun={m.recordNoun} />
                ) : (
                  <SendTargetPicker
                    kind="select"
                    value={{ ...m.target, userIds: [] }}
                    onChange={(patch) =>
                      // 選んだ利用者は定義連絡の宛先に無い(SendTargetPicker も allowedTypes で出さない)
                      m.setTarget({
                        ...(patch.type && patch.type !== "users" ? { type: patch.type } : {}),
                        ...(patch.roles ? { roles: patch.roles } : {}),
                        ...(patch.groupId !== undefined ? { groupId: patch.groupId } : {}),
                      })
                    }
                    roles={m.roles}
                    groups={m.groups}
                    groupsEnabled={m.groupsEnabled}
                    allowedTypes={m.allowedTargetTypes}
                  />
                )}
              </>
            ) : null}
          </Grid>
          {definition?.adminText?.description ? (
            <Para size="sm" tone="muted" className="my-0" data-slot="definition-send-description">
              {definition.adminText.description}
            </Para>
          ) : null}
        </Block>
        {definition && m.adminVars.length > 0 ? (
          <Block title="入力する値">
            <SendVarInputs declarations={m.adminVars} values={m.vars} onChange={m.setVar} missing={m.missingVars.map((item) => item.key)} />
          </Block>
        ) : null}
        {definition ? (
          <Block title="内容">
            {m.canEdit ? (
              <LayoutFields control={m.textControl} fields={m.textFields} channels={m.sendChannels} />
            ) : (
              <Para size="sm" tone="muted" className="my-0" data-slot="definition-send-fixed-text">
                {definition.required ? "この連絡の文面は変えられません" : "この連絡に直せる欄はありません"}
              </Para>
            )}
          </Block>
        ) : null}
        {definition && m.showSchedule ? (
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
            {scheduledAt ? "予約する" : "送信する"}
          </Button>
        </Flex>
      );
    }
    const blocked = !definition || Boolean(m.contentError) || Boolean(m.targetError);
    return (
      <Flex justify="end" gap="xs" wrap="wrap">
        <Button type="button" size="sm" variant="outline" disabled={blocked} loading={m.isPreviewing} onClick={() => void preview()}>
          あなた宛ての表示例
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={blocked} loading={m.isTesting} onClick={() => void sendTest()}>
          自分にテスト送信
        </Button>
        <Button type="button" size="sm" variant="primary" disabled={!m.canSend} loading={isConfirming} onClick={() => void toConfirm()}>
          確認に進む
        </Button>
      </Flex>
    );
  };

  const title = label ?? DEFAULT_LABEL;
  return (
    <>
      <Button type="button" size="sm" variant={triggerVariant} disabled={disabled} onClick={() => m.setOpen(true)}>
        {icon ?? <Send className="size-4" />}
        {title}
      </Button>
      <Modal
        open={m.open}
        onOpenChange={m.setOpen}
        title={m.step === "confirm" ? `${title}(確認)` : title}
        maxWidth={760}
        maxHeight="85vh"
        confirmOnClose={m.closeConfirm}
        footer={footer()}
      >
        {body()}
      </Modal>
      <SampleForYouModal
        open={Boolean(m.preview) && m.open}
        onOpenChange={(next) => {
          if (!next) m.closePreview();
        }}
        channels={(m.preview?.channels ?? []).map((channel) => ({ ...channel, layoutFields: definition?.layout.fields ?? null }))}
      />
    </>
  );
}
