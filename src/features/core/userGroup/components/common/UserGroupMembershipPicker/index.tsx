// src/features/core/userGroup/components/common/UserGroupMembershipPicker/index.tsx
// 部品(props だけ、流れは hook useUserGroupMembershipEditor): 人の選ぶ部品でその場で一員を直す(D101)。
// 候補は検索の欄だけ(selectedView inline)、入っている人は最初からチェック +「選択中」、反対側の人は「除外中」/「含める中」。
// チェックで足す・外す予定を作り、「適用(追加 N・削除 M)」で 1 回に反映する

"use client";

import { Button } from "@/components/Form/Button";
import { AsyncMultiSelectInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";

import type { UserGroupMembershipEditorState } from "@/features/core/userGroup/hooks/useUserGroupMembershipEditor";

export type UserGroupMembershipPickerProps = {
  editor: UserGroupMembershipEditorState;
  disabled?: boolean;
};

export function UserGroupMembershipPicker({ editor, disabled = false }: UserGroupMembershipPickerProps) {
  const pending = editor.addCount + editor.removeCount;
  return (
    <Flex align="start" gap="xs" wrap="wrap" data-slot="user-group-membership-picker">
      <Stack space={1} className="min-w-64 flex-1">
        <AsyncMultiSelectInput
          value={editor.value}
          onChange={editor.onChange}
          cursorFn={editor.cursorFn}
          getOptionFromResult={editor.getOptionFromResult}
          selectedView="inline"
          optionBadge={editor.optionBadge}
          placeholder="ユーザーを検索して選ぶ"
          searchPlaceholder="名前かメールアドレス(Enterで検索)"
          disabled={disabled}
        />
      </Stack>
      <Button type="button" size="sm" variant="primary" disabled={disabled || pending === 0 || editor.applying} onClick={() => void editor.apply()}>
        {`適用(追加 ${editor.addCount}・削除 ${editor.removeCount})`}
      </Button>
    </Flex>
  );
}
