// src/features/core/messaging/components/common/SendTargetPicker/index.tsx
// 部品(props だけ): 送るモーダルの宛先。全員・ロール・グループ・選んだ利用者。
// グループは使用中のグループを名前と種類の表示名で選ぶ(groups が空 = 門 userGroups が閉かグループが無い = 選択肢ごと出さない、D99)。
// グループの id は値としてだけ持ち、画面には出さない(D94)。
// 一覧の一括(bulk)の時は選んだ記録の数だけを出す(宛先は変えられない)

"use client";

import { MultiSelectInput, RadioGroupInput, SelectInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import { UserAsyncMultiSelect } from "@/features/core/user/components/common/UserAsyncMultiSelect";

export type SendTargetValue = { type: "all" | "role" | "group" | "users"; roles: string[]; groupId: string; userIds: string[] };

export type SendTargetGroupOption = { id: string; label: string; kindLabel: string };

export type SendTargetPickerProps =
  | { kind: "bulk"; recordCount: number; recordNoun: string }
  | {
      kind: "select";
      value: SendTargetValue;
      onChange: (patch: Partial<SendTargetValue>) => void;
      roles: { id: string; label: string }[];
      /** 選べるグループ(空 = グループの選択肢を出さない) */
      groups?: readonly SendTargetGroupOption[];
      /** 宛先の知らせ(前の回のグループが今は選べない時など) */
      note?: string | null;
    };

export function SendTargetPicker(props: SendTargetPickerProps) {
  if (props.kind === "bulk") {
    return (
      <Para size="sm" className="my-0" data-slot="send-target-picker">
        選んだ {props.recordCount} 件の{props.recordNoun}に紐づく利用者(同じ利用者には 1 通にまとめます)
      </Para>
    );
  }
  const { value, onChange, roles, groups = [], note = null } = props;
  // グループが無くても、今グループの形なら選択肢を残す(前の回のグループが今は選べない時に選び直せるように)
  const typeOptions = [
    { value: "all", label: "全員" },
    { value: "role", label: "ロール" },
    ...(groups.length > 0 || value.type === "group" ? [{ value: "group", label: "グループ" }] : []),
    { value: "users", label: "選んだ利用者" },
  ];
  return (
    <Stack space={2} data-slot="send-target-picker">
      <RadioGroupInput
        value={value.type}
        options={typeOptions}
        onChange={(v) => onChange({ type: (v as SendTargetValue["type"]) ?? "all" })}
      />
      {note ? (
        <Para size="sm" tone="warning" className="my-0" data-slot="send-target-note">
          {note}
        </Para>
      ) : null}
      {value.type === "role" ? (
        <MultiSelectInput
          aria-label="ロール"
          value={value.roles}
          options={roles.map((role) => ({ value: role.id, label: role.label }))}
          onChange={(v) => onChange({ roles: (v ?? []).map(String) })}
        />
      ) : null}
      {value.type === "group" ? (
        groups.length > 0 ? (
          <SelectInput
            aria-label="グループ"
            value={value.groupId}
            options={groups.map((group) => ({ value: group.id, label: `${group.label}(${group.kindLabel})` }))}
            placeholder="グループを選ぶ"
            showPlaceholderOption={false}
            onChange={(v) => onChange({ groupId: v ? String(v) : "" })}
          />
        ) : (
          <Para size="sm" tone="muted" className="my-0">
            選べるグループがありません
          </Para>
        )
      ) : null}
      {value.type === "users" ? (
        <UserAsyncMultiSelect value={value.userIds} onChange={(v) => onChange({ userIds: v.map(String) })} />
      ) : null}
    </Stack>
  );
}
