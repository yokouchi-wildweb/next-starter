// src/app/admin/(protected)/bank-transfer-reviews/_components/BankTransferReviewFilterBar.tsx
//
// 銀行振込レビュー一覧のフィルタ UI。
// draft (編集中の値) と applied (パネル側に渡されている確定値) を分け、
// 「適用」ボタンで初めて検索条件として反映する。

"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Button } from "@/components/Form/Button";
import { Manual } from "@/components/Form/Input";
import type { BankTransferReviewMode } from "@/features/core/bankTransferReview";

/**
 * パネル側で扱うフィルタ確定値。
 * - mode: 動作モード (immediate / approval_required) — 未指定は「すべて」
 * - userId: 申告ユーザーの UUID
 * - dateFrom / dateTo: YYYY-MM-DD 形式の日付文字列。API へは ISO 8601 に整形して渡す
 */
export type BankTransferReviewAppliedFilters = {
  mode?: BankTransferReviewMode;
  userId: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_FILTERS: BankTransferReviewAppliedFilters = {
  mode: undefined,
  userId: "",
  dateFrom: "",
  dateTo: "",
};

const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "immediate", label: "即時付与 (immediate)" },
  { value: "approval_required", label: "確認待ち (approval_required)" },
];

type Props = {
  applied: BankTransferReviewAppliedFilters;
  onApply: (next: BankTransferReviewAppliedFilters) => void;
  onReset: () => void;
};

export function BankTransferReviewFilterBar({ applied, onApply, onReset }: Props) {
  const [draft, setDraft] = useState<BankTransferReviewAppliedFilters>(applied);

  // 親側でリセットされた場合などに draft を applied と同期する
  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  const handleApply = () => {
    onApply({
      mode: draft.mode,
      userId: draft.userId.trim(),
      dateFrom: draft.dateFrom.trim(),
      dateTo: draft.dateTo.trim(),
    });
  };

  const handleReset = () => {
    setDraft(EMPTY_FILTERS);
    onReset();
  };

  return (
    <Stack space={3} className="rounded-lg border border-border bg-card p-4">
      <Flex gap="md" wrap="wrap">
        <FilterField label="モード">
          <Manual.SelectInput
            value={draft.mode ?? ""}
            onChange={(value) =>
              setDraft({
                ...draft,
                mode: value === "" || value === null
                  ? undefined
                  : (value as BankTransferReviewMode),
              })
            }
            options={MODE_OPTIONS}
            placeholder="すべて"
          />
        </FilterField>

        <FilterField label="ユーザーID (UUID)">
          <Manual.Input
            value={draft.userId}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setDraft({ ...draft, userId: e.target.value })
            }
            placeholder="申告ユーザーの UUID"
          />
        </FilterField>

        <FilterField label="申告日 (開始)">
          <Manual.DateInput
            value={draft.dateFrom || undefined}
            onValueChange={(value) => setDraft({ ...draft, dateFrom: value })}
          />
        </FilterField>

        <FilterField label="申告日 (終了)">
          <Manual.DateInput
            value={draft.dateTo || undefined}
            onValueChange={(value) => setDraft({ ...draft, dateTo: value })}
          />
        </FilterField>
      </Flex>

      <Flex gap="sm">
        <Button onClick={handleApply} variant="primary">適用</Button>
        <Button onClick={handleReset} variant="ghost">リセット</Button>
      </Flex>
    </Stack>
  );
}

type FilterFieldProps = {
  label: string;
  children: React.ReactNode;
};

function FilterField({ label, children }: FilterFieldProps) {
  return (
    <label className="flex min-w-[200px] flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
