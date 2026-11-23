// src/domains/core/user/components/AdminUserBulkStatusAction/index.tsx
// 管理一覧の一括操作の作成関数: 選んだ利用者の状態のまとめての変更(@/lib/crud の bulk*Action と同じ形 = meta + options → BulkActionItem)。
// 選んだ記録の id = 利用者 id。上流は項目を差さない(D304): fork が自分の一覧のドメインの plugs/adminBulkActions/<名前>.tsx で数行の項目にする
// (書き方: user README「状態をまとめて変える」)。中身は hook useBulkChangeUserStatus(= 管理の API = 運用コマンド user:bulk-change-status と同じ関数。
// 1 人ずつ recordStatusTransition と監査を通す)。汎用の一括ボタン(bulkFieldAction)には載せない: 状態は記録が必須の列(tableSuite README)。
// 流れ: 入力(変える先・今の状態で絞る・理由)→ 確かめる(dryRun: 変える人・飛ばす人)→ 実行 → トースト → onDone。
// 確かめた後に入力を変えると確かめ直し(実行は新しい確かめの後だけ)。上限を超える選択は hook が束に分けて送る

"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Label } from "@/components/Input/Label";
import { SelectInput } from "@/components/Input/Select";
import { Textarea } from "@/components/Input/Textarea";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";
import type { BulkActionItem, BulkActionProps } from "@/lib/tableSuite";

import { BULK_STATUS_TARGETS, USER_STATUSES, USER_STATUS_LABELS } from "@/domains/core/user/constants/status";
import { useBulkChangeUserStatus } from "@/domains/core/user/hooks/useBulkChangeUserStatus";
import type { BulkChangeStatusResult, UserStatus } from "@/domains/core/user/types";

/** 項目の並べ方・出し分け(BulkActionItem の Component 以外) */
type ItemMeta<Access> = Omit<BulkActionItem<unknown, Access>, "Component">;

export type BulkUserStatusActionOptions = {
  /** ボタンとモーダルの題 */
  label?: string;
  disabled?: boolean;
};

const count = (n: number) => `${n.toLocaleString("ja-JP")} 人`;
const TARGET_OPTIONS = BULK_STATUS_TARGETS.map((status) => ({ value: status, label: USER_STATUS_LABELS[status] }));
const FROM_OPTIONS = USER_STATUSES.map((status) => ({ value: status, label: USER_STATUS_LABELS[status] }));
const isStatus = (value: unknown): value is UserStatus => (USER_STATUSES as readonly unknown[]).includes(value);

type Draft = { newStatus: UserStatus | ""; onlyFrom: UserStatus | ""; reason: string };
const BLANK: Draft = { newStatus: "", onlyFrom: "", reason: "" };

function ChangeSelection({ selection, onDone, label }: BulkActionProps<unknown> & { label: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [plan, setPlan] = useState<BulkChangeStatusResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { trigger, isMutating } = useBulkChangeUserStatus();
  const { showToast } = useToast();
  const ids = selection.selectedIds.map(String);
  const ready = draft.newStatus !== "" && draft.reason.trim() !== "" && ids.length > 0;
  const targetLabel = draft.newStatus === "" ? "" : USER_STATUS_LABELS[draft.newStatus];

  const edit = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setPlan(null);
    setError(null);
  };
  const run = async (dryRun: boolean) => {
    if (draft.newStatus === "") return;
    setError(null);
    try {
      const result = await trigger({
        userIds: ids,
        newStatus: draft.newStatus,
        reason: draft.reason.trim(),
        ...(draft.onlyFrom === "" ? {} : { onlyFrom: draft.onlyFrom }),
        dryRun,
      });
      if (dryRun) {
        setPlan(result);
        return;
      }
      setOpen(false);
      showToast(
        `${count(result.changed.length)}を「${targetLabel}」にしました(飛ばした ${count(result.skipped.length)}${result.failed.length > 0 ? `、失敗 ${count(result.failed.length)}` : ""})`,
        result.failed.length > 0 ? "warning" : "success",
      );
      onDone();
    } catch (caught) {
      setError(caught);
    }
  };
  const openModal = () => {
    setDraft(BLANK);
    setPlan(null);
    setError(null);
    setOpen(true);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={selection.count === 0} onClick={openModal}>
        <UserCog className="size-4" />
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={label}
        maxWidth="560px"
        confirmOnClose={{ enabled: isMutating, message: "状態を変えています。閉じても処理は止まりません。閉じてもよろしいですか？" }}
        footer={
          <Flex justify="end" gap="xs">
            <Button type="button" size="sm" variant="outline" disabled={!ready} loading={isMutating && plan === null} onClick={() => void run(true)}>
              確かめる
            </Button>
            {plan ? (
              <Button type="button" size="sm" variant="primary" disabled={plan.changed.length === 0} loading={isMutating} onClick={() => void run(false)}>
                実行
              </Button>
            ) : null}
          </Flex>
        }
      >
        <Stack gap="sm">
          <Para size="sm" tone="muted" className="my-0">
            {`選択した ${count(ids.length)}の状態をまとめて変えます(先に「確かめる」で変わる人を見てから実行します。管理者のロールの人は変えません)`}
          </Para>
          <Stack gap="2xs">
            <Label htmlFor="bulk-user-status-target" className="text-sm">
              変える先
            </Label>
            <SelectInput
              id="bulk-user-status-target"
              value={draft.newStatus}
              options={TARGET_OPTIONS}
              placeholder="状態を選ぶ"
              disabled={isMutating}
              onChange={(v) => edit({ newStatus: isStatus(v) ? v : "" })}
            />
          </Stack>
          <Stack gap="2xs">
            <Label htmlFor="bulk-user-status-from" className="text-sm">
              今この状態の人だけ(任意)
            </Label>
            <SelectInput
              id="bulk-user-status-from"
              value={draft.onlyFrom}
              options={FROM_OPTIONS}
              placeholder="絞らない"
              disabled={isMutating}
              onChange={(v) => edit({ onlyFrom: isStatus(v) ? v : "" })}
            />
          </Stack>
          <Stack gap="2xs">
            <Label htmlFor="bulk-user-status-reason" className="text-sm">
              理由(監査に残ります)
            </Label>
            <Textarea id="bulk-user-status-reason" value={draft.reason} rows={2} maxLength={500} disabled={isMutating} onChange={(e) => edit({ reason: e.target.value })} />
          </Stack>
          {plan ? (
            <Stack gap="2xs" data-slot="bulk-user-status-plan">
              <Para size="sm" className="my-0">
                {`${count(plan.changed.length)}を「${targetLabel}」に変えます`}
              </Para>
              {plan.skipped.length > 0 ? (
                <Para size="sm" tone="muted" className="my-0">
                  {`飛ばす ${count(plan.skipped.length)}: ${plan.skipped
                    .slice(0, 3)
                    .map((row) => row.why)
                    .join(" / ")}${plan.skipped.length > 3 ? " ほか" : ""}`}
                </Para>
              ) : null}
            </Stack>
          ) : null}
          {error ? (
            <Para size="sm" tone="destructive" className="my-0" data-slot="bulk-user-status-error">
              {err(error, "状態の変更に失敗しました")}
            </Para>
          ) : null}
        </Stack>
      </Modal>
    </>
  );
}

/** 選んだ利用者の状態をまとめて変える(1 人ずつ遷移の履歴と監査を通す) */
export function bulkUserStatusAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: BulkUserStatusActionOptions = {},
): BulkActionItem<Row, Access> {
  const label = options.label ?? "状態をまとめて変更";
  const Component = (props: BulkActionProps<Row>) => (
    <ChangeSelection {...(props as BulkActionProps<unknown>)} selection={{ ...props.selection, count: options.disabled ? 0 : props.selection.count }} label={label} />
  );
  Component.displayName = `bulkUserStatusAction(${meta.key})`;
  return { ...meta, Component };
}
