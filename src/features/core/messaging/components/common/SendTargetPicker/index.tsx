// src/features/core/messaging/components/common/SendTargetPicker/index.tsx
// 部品(props だけ): 送るモーダルの宛先。全員・ロール・グループ・選んだ利用者。
// グループは使用中のグループを名前と種類の表示名で選ぶ。門 userGroups が開(groupsEnabled)なら 0 件でも選択肢を出し、
// 空なら「ユーザーグループを作成」へ案内する(操作の途中で選択肢が消えないように)。門が閉の時だけ出さない。
// グループの id は値としてだけ持ち、画面には出さない(D94)。
// 一覧の一括(bulk)の時は選んだ記録の数だけを出す(宛先は変えられない)。
// allowedTypes = 選んだ種別が許す宛先の種類(D109 D110。省略 = 全部)。許さない種類は出さない

"use client";

import { MultiSelectInput, RadioGroupInput, SelectInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation/Link";
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
      /** 選べるグループ */
      groups?: readonly SendTargetGroupOption[];
      /** 門 userGroups が開か(開 = グループの選択肢を出す。省略時は groups があれば出す) */
      groupsEnabled?: boolean;
      /** 宛先の知らせ(前の回のグループが今は選べない時など) */
      note?: string | null;
      /** 選べる宛先の種類(種別が許す物。省略 = 全部) */
      allowedTypes?: readonly SendTargetValue["type"][];
    };

export function SendTargetPicker(props: SendTargetPickerProps) {
  if (props.kind === "bulk") {
    return (
      <Para size="sm" className="my-0" data-slot="send-target-picker">
        選択した {props.recordCount} 件の{props.recordNoun}に関連するユーザー(同じユーザーには 1 通にまとめます)
      </Para>
    );
  }
  const { value, onChange, roles, groups = [], groupsEnabled = groups.length > 0, note = null, allowedTypes } = props;
  // グループが無くても、今グループの形なら選択肢を残す(前の回のグループが今は選べない時に選び直せるように)
  const typeOptions = [
    { value: "all", label: "全員" },
    { value: "role", label: "ロール" },
    ...(groupsEnabled || groups.length > 0 || value.type === "group" ? [{ value: "group", label: "グループ" }] : []),
    { value: "users", label: "ユーザーを選ぶ" },
  ].filter((option) => !allowedTypes || allowedTypes.includes(option.value as SendTargetValue["type"]));
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
          <Para size="sm" tone="muted" className="my-0" data-slot="send-target-no-group">
            送れるグループがありません。
            {groupsEnabled ? (
              <>
                {" "}
                <Link href="/admin/user-groups">ユーザーグループを作成</Link>
              </>
            ) : null}
          </Para>
        )
      ) : null}
      {value.type === "users" ? (
        <UserAsyncMultiSelect value={value.userIds} onChange={(v) => onChange({ userIds: v.map(String) })} />
      ) : null}
    </Stack>
  );
}
