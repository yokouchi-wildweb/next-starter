// src/features/core/messaging/components/common/SendAudiencePicker/index.tsx
// 部品(props だけ): 送るモーダルの宛先。全員・ロール・宛先の集め方(audiences の受け口)・選んだ利用者。
// 一覧の一括(bulk)の時は選んだ記録の数だけを出す(宛先は変えられない)

"use client";

import { MultiSelectInput, RadioGroupInput, SelectInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import { UserAsyncMultiSelect } from "@/features/core/user/components/common/UserAsyncMultiSelect";

export type SendAudienceValue = { type: "all" | "role" | "audience" | "users"; roles: string[]; audienceKey: string; userIds: string[] };

export type SendAudiencePickerProps =
  | { kind: "bulk"; recordCount: number; recordNoun: string }
  | {
      kind: "select";
      value: SendAudienceValue;
      onChange: (patch: Partial<SendAudienceValue>) => void;
      roles: { id: string; label: string }[];
      audiences: { key: string; label: string }[];
    };

const TYPE_OPTIONS = [
  { value: "all", label: "全員" },
  { value: "role", label: "ロール" },
  { value: "audience", label: "宛先の集め方" },
  { value: "users", label: "選んだ利用者" },
];

export function SendAudiencePicker(props: SendAudiencePickerProps) {
  if (props.kind === "bulk") {
    return (
      <Para size="sm" className="my-0" data-slot="send-audience-picker">
        選んだ {props.recordCount} 件の{props.recordNoun}に紐づく利用者(同じ利用者には 1 通にまとめます)
      </Para>
    );
  }
  const { value, onChange, roles, audiences } = props;
  return (
    <Stack space={2} data-slot="send-audience-picker">
      <RadioGroupInput
        value={value.type}
        options={TYPE_OPTIONS}
        onChange={(v) => onChange({ type: (v as SendAudienceValue["type"]) ?? "all" })}
      />
      {value.type === "role" ? (
        <MultiSelectInput
          aria-label="ロール"
          value={value.roles}
          options={roles.map((role) => ({ value: role.id, label: role.label }))}
          onChange={(v) => onChange({ roles: (v ?? []).map(String) })}
        />
      ) : null}
      {value.type === "audience" ? (
        audiences.length === 0 ? (
          <Para size="sm" tone="muted" className="my-0">
            宛先の集め方はありません(fork が audiences の受け口に足す)
          </Para>
        ) : (
          <SelectInput
            aria-label="宛先の集め方"
            value={value.audienceKey}
            options={audiences.map((audience) => ({ value: audience.key, label: audience.label }))}
            onChange={(v) => onChange({ audienceKey: v ? String(v) : "" })}
          />
        )
      ) : null}
      {value.type === "users" ? (
        <UserAsyncMultiSelect value={value.userIds} onChange={(v) => onChange({ userIds: v.map(String) })} />
      ) : null}
    </Stack>
  );
}
