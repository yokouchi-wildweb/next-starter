// src/features/core/userGroup/components/common/UserGroupStaticSourceFields/index.tsx
// 部品(props だけ): 固定のグループを作る時の一員の元。選んだ人(利用者を選ぶ部品)/ タグを持つ今の人 / 固定のグループの今の一員。
// 選択肢は条件の部品の一覧の API の label(タグ・固定のグループ)。動的・定期計算の今の一員から作るのは、そのグループのモーダルの「今の人で固定」

"use client";

import { RadioGroupInput, SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Stack } from "@/components/Layout/Stack";

import { UserAsyncMultiSelect } from "@/features/core/user/components/common/UserAsyncMultiSelect";
import { STATIC_SOURCE_LABELS, type StaticSourceDraft } from "@/features/core/userGroup/hooks/useUserGroupForm";
import type { AdminUserGroupOption } from "@/features/core/userGroup/services/client/userGroupAdminClient";

export type UserGroupStaticSourceFieldsProps = {
  value: StaticSourceDraft;
  onChange: (value: StaticSourceDraft) => void;
  tags: readonly AdminUserGroupOption[];
  staticGroups: readonly AdminUserGroupOption[];
  disabled?: boolean;
};

const TYPE_OPTIONS = (Object.keys(STATIC_SOURCE_LABELS) as StaticSourceDraft["type"][]).map((value) => ({ value, label: STATIC_SOURCE_LABELS[value] }));

export function UserGroupStaticSourceFields({ value, onChange, tags, staticGroups, disabled = false }: UserGroupStaticSourceFieldsProps) {
  return (
    <Stack space={3} data-slot="user-group-static-source">
      <Stack space={1}>
        <Label className="text-sm">一員の元</Label>
        <RadioGroupInput
          value={value.type}
          options={TYPE_OPTIONS}
          disabled={disabled}
          onChange={(next) => onChange({ ...value, type: String(next) as StaticSourceDraft["type"] })}
        />
      </Stack>
      {value.type === "users" ? (
        <UserAsyncMultiSelect value={value.userIds} disabled={disabled} onChange={(ids) => onChange({ ...value, userIds: ids.map(String) })} />
      ) : null}
      {value.type === "tag" ? (
        <SelectInput
          value={value.tagId}
          options={tags.map((tag) => ({ value: tag.value, label: tag.label }))}
          placeholder="タグを選ぶ"
          disabled={disabled}
          onChange={(next) => onChange({ ...value, tagId: next ? String(next) : "" })}
        />
      ) : null}
      {value.type === "group" ? (
        <SelectInput
          value={value.groupId}
          options={staticGroups.map((group) => ({ value: group.value, label: group.label }))}
          placeholder="固定のグループを選ぶ"
          disabled={disabled}
          onChange={(next) => onChange({ ...value, groupId: next ? String(next) : "" })}
        />
      ) : null}
    </Stack>
  );
}
