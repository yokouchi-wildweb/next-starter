// src/features/core/userGroup/components/AdminUserGroupModal/index.tsx
// セクションコンテナ(管理: ユーザーグループを作る・直すモーダル)。開閉は置き場が持つ(open・onOpenChange・groupId)。
// タブ: 基本(名前・説明・種類・定期計算の間隔と最後の計算と失敗・サーバーの注意。固定を作る時は一員の元)/
//   条件(動的・定期計算: 条件の組み立て・重い条件の注意・人数の見込みと試し)/
//   人(直す時: 固定 = 一員の一覧と足す・外す / 動的・定期計算 = 例外の人と「今の人で固定」)。
// 下の帯: 保管(ConfirmPopover)・保存。作った後は同じモーダルでその 1 件を直す形に変わる(ページは移らない)。
// 流れは hook useUserGroupModal(取る物・タブ・固定の送り直し)と useUserGroupForm(書く欄・操作)ほか。部品は公開の部品だけなので、
// fork は自分の画面にも同じモーダルを置ける。書きかけ・固定の途中で閉じる = confirmOnClose、ページの移動 = hook の中の @/lib/unsavedGuard。
// 内部の鍵・id は出さない(D94)

"use client";

import { useMemo } from "react";

import { Button } from "@/components/Form/Button";
import { Input, SelectInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import Modal from "@/components/Overlays/Modal";
import { ConfirmPopover, PromptPopover } from "@/components/Overlays/Popover";
import TabbedModal from "@/components/Overlays/TabbedModal";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";

import { UserGroupConditionBuilder } from "@/features/core/userGroup/components/common/UserGroupConditionBuilder";
import { UserGroupEstimateView } from "@/features/core/userGroup/components/common/UserGroupEstimateView";
import { UserGroupExceptionsEditor } from "@/features/core/userGroup/components/common/UserGroupExceptionsEditor";
import { UserGroupFreezeProgress } from "@/features/core/userGroup/components/common/UserGroupFreezeProgress";
import { UserGroupMemberList } from "@/features/core/userGroup/components/common/UserGroupMemberList";
import { UserGroupRecomputeStatus } from "@/features/core/userGroup/components/common/UserGroupRecomputeStatus";
import { userGroupCountText } from "@/features/core/userGroup/components/common/UserGroupRow";
import { UserGroupStaticSourceFields } from "@/features/core/userGroup/components/common/UserGroupStaticSourceFields";
import type { UserGroupAction } from "@/features/core/userGroup/hooks/useAdminUserGroupList";
import { useUserGroupEstimate } from "@/features/core/userGroup/hooks/useUserGroupEstimate";
import { useUserGroupExceptions } from "@/features/core/userGroup/hooks/useUserGroupExceptions";
import { intervalLabel, useUserGroupForm } from "@/features/core/userGroup/hooks/useUserGroupForm";
import { useUserGroupModal } from "@/features/core/userGroup/hooks/useUserGroupModal";
import { useUserGroupStaticMembers } from "@/features/core/userGroup/hooks/useUserGroupStaticMembers";
import type { AdminUserGroupDetail } from "@/features/core/userGroup/services/client/userGroupAdminClient";

export type AdminUserGroupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 直す 1 件の id(null・省略 = 作る) */
  groupId?: string | null;
  /** 作る・保存・保管・一員・例外の後(返った 1 件と操作。一覧の取り直し・行の置き換えに使う) */
  onChanged?: (group: AdminUserGroupDetail, action: UserGroupAction) => void;
};

const MODAL_WIDTH = "880px";
/** 定期計算の間隔の「既定」の選択肢の値(null = 設定の既定) */
export const INTERVAL_DEFAULT = "default";

/** 種類の選択の下の 1 行の説明 */
const KIND_HELP: Record<string, string> = {
  dynamic: "条件に合うユーザーを、使うたびにその場で集めます",
  scheduled: "条件に合うユーザーを、決まった間隔で集計して保存します(重い条件でも使えます)",
  static: "選んだユーザーをそのままメンバーにします",
};

export function AdminUserGroupModal({ open, onOpenChange, groupId = null, onChanged }: AdminUserGroupModalProps) {
  const m = useUserGroupModal({ open, groupId, onChanged });

  if (m.state !== "ready" || !m.catalog) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={m.mode === "edit" ? "ユーザーグループを編集" : "ユーザーグループを作成"} maxWidth={MODAL_WIDTH}>
        {m.state === "loading" ? (
          <Flex justify="center" className="py-8">
            <Spinner className="size-6" />
          </Flex>
        ) : (
          <Para tone="destructive" align="center">
            {err(m.error, "ユーザーグループを取得できませんでした")}
          </Para>
        )}
      </Modal>
    );
  }

  // 書く欄は開いた回・1 件の更新ごとに作り直す(保存の後はサーバーの値になる)
  return <UserGroupModalBody key={m.formKey} modal={m} catalog={m.catalog} open={open} onOpenChange={onOpenChange} />;
}

type ModalState = ReturnType<typeof useUserGroupModal>;

function UserGroupModalBody({
  modal,
  catalog,
  open,
  onOpenChange,
}: {
  modal: ModalState;
  catalog: NonNullable<ModalState["catalog"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { group, freeze } = modal;
  const form = useUserGroupForm({ group, catalog, onCreated: modal.onCreated, onChanged: modal.onChanged, startStatic: freeze.start });
  const { fields, condition } = form;
  const { execute: save, isExecuting: isSaving } = useAsyncAction(form.save);
  const locked = form.archived;
  const isStatic = fields.kind === "static";
  const peopleTab = modal.tab === "people";

  const definition = useMemo(
    () => (condition.problems.length === 0 ? condition.toDefinition() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 組(root)と問題が変わった時だけ作り直す(toDefinition は毎回新しい関数)
    [condition.root, condition.problems],
  );
  const estimate = useUserGroupEstimate(isStatic ? null : definition);
  const members = useUserGroupStaticMembers({
    groupId: group && group.kind === "static" ? group.id : null,
    enabled: peopleTab,
    onChanged: (fresh) => void modal.refresh(fresh, "members"),
  });
  const exceptions = useUserGroupExceptions({
    groupId: group && group.kind !== "static" ? group.id : null,
    enabled: peopleTab,
    onChanged: (fresh) => void modal.refresh(fresh, "exceptions"),
  });

  const closeConfirm = freeze.running ? modal.freezeCloseConfirm : form.closeConfirm;
  // 既定の間隔は空でない印で持つ(選択肢の値に空の文字は使えない: Radix の Select.Item が実行時に拒む)
  const intervalOptions = [
    { value: INTERVAL_DEFAULT, label: fields.defaultIntervalMinutes ? `既定(${intervalLabel(fields.defaultIntervalMinutes)})` : "既定" },
    ...fields.intervalChoices.map((minutes) => ({ value: String(minutes), label: intervalLabel(minutes) })),
  ];

  const footer = (
    <Stack space={1}>
      <Flex justify="end" gap="xs" wrap="wrap">
        {group && !locked ? (
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="outline" disabled={form.dirty || freeze.running}>
                アーカイブする
              </Button>
            }
            title="アーカイブ"
            description="アーカイブすると一覧と選択肢に表示されなくなり、新しい配信や条件に使えなくなります。グループ自体は残ります。"
            confirmLabel="アーカイブする"
            confirmVariant="destructive"
            onConfirm={form.archive}
          />
        ) : null}
        {group && locked ? (
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="primary">
                アクティブに戻す
              </Button>
            }
            title="アクティブに戻す"
            description="このグループを使用中に戻します"
            confirmLabel="アクティブに戻す"
            onConfirm={form.restore}
          />
        ) : null}
        {!locked ? (
          <Button type="button" size="sm" variant="primary" disabled={isSaving || freeze.running || !form.canSave} onClick={() => void save()}>
            {isSaving ? <Spinner className="size-4" /> : null}
            {group ? "保存" : "作成"}
          </Button>
        ) : null}
      </Flex>
      {form.dirty && form.problems.length > 0 ? (
        <Para size="sm" tone="muted" align="right" className="my-0">
          {form.problems[0]}
        </Para>
      ) : null}
    </Stack>
  );

  const basicTab = (
    <Stack space={4}>
      {group ? (
        <Flex align="center" gap="sm" wrap="wrap">
          <Span size="sm" data-slot="user-group-count">
            {userGroupCountText(group.count)}
          </Span>
          {locked ? (
            <Span size="sm" tone="muted">
              アーカイブ済みのグループは編集できません
            </Span>
          ) : null}
        </Flex>
      ) : null}
      {group?.notices.map((notice) => (
        <Para key={notice} size="sm" tone="muted" className="my-0" data-slot="user-group-notice">
          {notice}
        </Para>
      ))}
      <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="user-group-meta">
        <Stack space={1}>
          <Label htmlFor="user-group-name" className="text-sm">
            グループ名
          </Label>
          <Input id="user-group-name" value={fields.name} disabled={locked} onChange={(e) => fields.setName(e.target.value)} />
        </Stack>
        <Stack space={1}>
          <Label htmlFor="user-group-description" className="text-sm">
            説明(任意)
          </Label>
          <Textarea id="user-group-description" value={fields.description} rows={2} disabled={locked} onChange={(e) => fields.setDescription(e.target.value)} />
        </Stack>
        <Stack space={1}>
          <Label htmlFor="user-group-kind" className="text-sm">
            種類
          </Label>
          <SelectInput
            id="user-group-kind"
            value={fields.kind}
            disabled={fields.kindLocked}
            showPlaceholderOption={false}
            options={fields.kindOptions.map((option) => ({ value: option.value, label: option.label }))}
            onChange={(v) => v && fields.setKind(String(v))}
          />
          <Para size="sm" tone="muted" className="my-0" data-slot="user-group-kind-help">
            {KIND_HELP[fields.kind]}
          </Para>
          {group && group.kind !== "static" ? (
            <Para size="sm" tone="muted" className="my-0">
              「条件で自動」と「定期的に更新」の間でだけ変更できます(「定期的に更新」から変えると、集計済みのメンバーは消えます)
            </Para>
          ) : null}
        </Stack>
        {fields.kind === "scheduled" ? (
          <Stack space={1}>
            <Label htmlFor="user-group-interval" className="text-sm">
              更新の間隔
            </Label>
            <SelectInput
              id="user-group-interval"
              value={fields.intervalMinutes === null ? INTERVAL_DEFAULT : String(fields.intervalMinutes)}
              disabled={locked}
              options={intervalOptions}
              showPlaceholderOption={false}
              onChange={(v) => fields.setIntervalMinutes(!v || v === INTERVAL_DEFAULT ? null : Number(v))}
            />
            {group?.recompute ? <UserGroupRecomputeStatus recompute={group.recompute} showReason /> : null}
          </Stack>
        ) : null}
      </Stack>
      {!group && isStatic ? (
        <Stack space={3} className="rounded-md border border-border bg-card p-4">
          <UserGroupStaticSourceFields
            value={fields.source}
            onChange={fields.setSource}
            tags={catalog.options.tags}
            staticGroups={catalog.options.staticGroups}
            disabled={freeze.running}
          />
        </Stack>
      ) : null}
      <UserGroupFreezeProgress progress={freeze.progress} onCancel={freeze.cancel} onClear={freeze.clear} />
    </Stack>
  );

  const conditionTab = (
    <Stack space={4}>
      {form.heavyWarning ? (
        <Para size="sm" tone="warning" className="my-0" data-slot="user-group-heavy">
          {form.heavyWarning}
        </Para>
      ) : null}
      <UserGroupConditionBuilder
        root={condition.root}
        readOnlyDefinition={condition.readOnlyDefinition}
        readOnlyNote={condition.readOnlyNote}
        criteria={catalog.criteria}
        actions={condition.actions}
        problems={condition.touched ? condition.problems : []}
        disabled={locked}
      />
      <UserGroupEstimateView
        result={estimate.result}
        reason={estimate.reason}
        isLoading={estimate.isLoading}
        stale={estimate.stale}
        canRun={estimate.canRun}
        onRun={() => void estimate.run()}
      />
    </Stack>
  );

  const peopleContent = !group ? null : group.kind === "static" ? (
    <UserGroupMemberList
      title="メンバー"
      description="このグループのメンバーです。ユーザーを選んで追加・削除できます"
      people={members}
      addLabel="メンバーに追加"
      emptyText="メンバーはいません"
      disabled={locked}
    />
  ) : (
    <Stack space={4}>
      <UserGroupExceptionsEditor exceptions={exceptions} counts={group.exceptions} scheduled={group.kind === "scheduled"} disabled={locked} />
      {!locked ? (
        <Stack space={2} className="rounded-md border border-border bg-card p-4" data-slot="user-group-freeze-current">
          <Para size="sm" tone="muted" className="my-0">
            今このグループに含まれるユーザーで、新しい固定グループを作成します(このグループはそのまま残ります)
          </Para>
          <Flex>
            <PromptPopover
              trigger={
                <Button type="button" size="sm" variant="outline" disabled={freeze.running || form.dirty}>
                  現在のメンバーで固定グループを作成
                </Button>
              }
              title="現在のメンバーで固定グループを作成"
              description="新しい固定グループの名前"
              defaultValue={`${group.name}(固定)`}
              confirmLabel="作成"
              validation={(value) => (value.trim() === "" ? "グループ名を入力してください" : null)}
              onConfirm={async (value) => {
                await modal.freezeCurrent(value.trim());
              }}
            />
          </Flex>
          <UserGroupFreezeProgress progress={freeze.progress} onCancel={freeze.cancel} onClear={freeze.clear} />
        </Stack>
      ) : null}
    </Stack>
  );

  const tabs = [
    { value: "basic", label: "基本", content: basicTab },
    ...(!isStatic ? [{ value: "condition", label: "条件", content: conditionTab }] : []),
    ...(group ? [{ value: "people", label: group.kind === "static" ? "メンバー" : "例外", content: peopleContent }] : []),
  ];

  return (
    <TabbedModal
      open={open}
      onOpenChange={onOpenChange}
      title={group ? `ユーザーグループを編集: ${group.name}` : "ユーザーグループを作成"}
      maxWidth={MODAL_WIDTH}
      tabs={tabs}
      value={tabs.some((tab) => tab.value === modal.tab) ? modal.tab : "basic"}
      onValueChange={modal.setTab}
      ariaLabel="ユーザーグループのタブ"
      footer={footer}
      confirmOnClose={closeConfirm}
    />
  );
}
