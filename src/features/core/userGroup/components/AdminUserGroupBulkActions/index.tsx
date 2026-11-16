// src/features/core/userGroup/components/AdminUserGroupBulkActions/index.tsx
// 管理一覧の一括操作の作成関数(利用者一覧の受け口 user/adminBulkActions の項目が使う。lib は features を読めないので userGroup に置く)。
// @/lib/crud/components の bulk*Action と同じ形(meta + options → BulkActionItem)。選んだ記録の id = 利用者 id。
// - bulkCreateUserGroupAction: 選んだ人で固定のグループを作る(名前・説明)。一員の書き込みが途中なら自動で送り直し、終わるまで進み具合を出す
// - bulkAddToUserGroupAction: 選んだ人を既存の固定のグループに足す(使用中の固定のグループを名前で選ぶ)
// 終わったらグループ名と人数のトースト。人数の上限などで断られた時はサーバーの理由を出す。内部の鍵・id は出さない(D94)。門 userGroups の出し分けは項目の feature

"use client";

import { useState } from "react";
import { FolderPlus, UserPlus } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { Input, SelectInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading/InlineLoader";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";
import type { BulkActionItem, BulkActionProps } from "@/lib/tableSuite";

import { UserGroupFreezeProgress } from "@/features/core/userGroup/components/common/UserGroupFreezeProgress";
import { useAddToUserGroup } from "@/features/core/userGroup/hooks/useAddToUserGroup";
import { useUserGroupCriteriaCatalog } from "@/features/core/userGroup/hooks/useUserGroup";
import { useUserGroupFreeze } from "@/features/core/userGroup/hooks/useUserGroupFreeze";

/** 項目の並べ方・出し分け(BulkActionItem の Component 以外) */
type ItemMeta<Access> = Omit<BulkActionItem<unknown, Access>, "Component">;

export type BulkUserGroupActionOptions = {
  /** ボタンとモーダルの題 */
  label?: string;
  disabled?: boolean;
};

const count = (n: number) => `${n.toLocaleString("ja-JP")} 人`;

function CreateFromSelection({ selection, onDone, label }: BulkActionProps<unknown> & { label: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { showToast } = useToast();
  const freeze = useUserGroupFreeze({
    onDone: (group) => {
      setOpen(false);
      showToast(`「${group.name}」を作成しました(${count(group.count.value ?? 0)})`, "success");
      onDone();
    },
  });
  const ids = selection.selectedIds.map(String);
  const start = () => freeze.start({ name: name.trim(), description: description.trim() === "" ? null : description.trim(), from: { type: "users", userIds: ids } });
  const openModal = () => {
    setName("");
    setDescription("");
    freeze.clear();
    setOpen(true);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={selection.count === 0} onClick={openModal}>
        <FolderPlus className="size-4" />
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!next) freeze.cancel();
          setOpen(next);
        }}
        title={label}
        maxWidth="560px"
        confirmOnClose={{ enabled: freeze.running, message: "メンバーを登録しています。閉じると登録が中断されます。閉じてもよろしいですか？" }}
        footer={
          <Flex justify="end" gap="xs">
            <Button type="button" size="sm" variant="primary" disabled={name.trim() === "" || ids.length === 0} loading={freeze.running} onClick={() => void start()}>
              作成
            </Button>
          </Flex>
        }
      >
        <Stack gap="sm">
          <Para size="sm" tone="muted" className="my-0">
            {`選択した ${count(ids.length)}で固定グループを作成します`}
          </Para>
          <Stack gap="2xs">
            <Label htmlFor="bulk-user-group-name" className="text-sm">
              グループ名
            </Label>
            <Input id="bulk-user-group-name" value={name} disabled={freeze.running} onChange={(e) => setName(e.target.value)} />
          </Stack>
          <Stack gap="2xs">
            <Label htmlFor="bulk-user-group-description" className="text-sm">
              説明(任意)
            </Label>
            <Textarea id="bulk-user-group-description" value={description} rows={2} disabled={freeze.running} onChange={(e) => setDescription(e.target.value)} />
          </Stack>
          <UserGroupFreezeProgress progress={freeze.progress} onCancel={freeze.cancel} />
        </Stack>
      </Modal>
    </>
  );
}

function AddSelection({ selection, onDone, label }: BulkActionProps<unknown> & { label: string }) {
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const { catalog, error: catalogError } = useUserGroupCriteriaCatalog(open);
  const adding = useAddToUserGroup();
  const { showToast } = useToast();
  const ids = selection.selectedIds.map(String);
  const groups = catalog?.options.staticGroups ?? [];
  const openModal = () => {
    setGroupId("");
    adding.clear();
    setOpen(true);
  };
  const add = async () => {
    const done = await adding.add(groupId, ids);
    if (done) {
      setOpen(false);
      showToast(
        `「${done.group.name}」に ${count(done.added)}を追加しました${done.skipped > 0 ? `(${count(done.skipped)}は登録済みか、追加できませんでした)` : ""}`,
        "success",
      );
      onDone();
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={selection.count === 0} onClick={openModal}>
        <UserPlus className="size-4" />
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={label}
        maxWidth="560px"
        footer={
          <Flex justify="end" gap="xs">
            <Button type="button" size="sm" variant="primary" disabled={groupId === "" || ids.length === 0} loading={adding.isAdding} onClick={() => void add()}>
              追加
            </Button>
          </Flex>
        }
      >
        <Stack gap="sm">
          <Para size="sm" tone="muted" className="my-0">
            {`選択した ${count(ids.length)}を固定グループに追加します(登録済みのユーザーはそのままです)`}
          </Para>
          {catalogError ? (
            <Para size="sm" tone="destructive" className="my-0">
              {err(catalogError, "固定グループの一覧を取得できませんでした")}
            </Para>
          ) : !catalog ? (
            <InlineLoader />
          ) : groups.length === 0 ? (
            <Para size="sm" tone="muted" className="my-0">
              追加できる固定グループがありません(「選択したユーザーでグループを作成」で作れます)
            </Para>
          ) : (
            <Stack gap="2xs">
              <Label htmlFor="bulk-user-group-target" className="text-sm">
                追加先のグループ
              </Label>
              <SelectInput
                id="bulk-user-group-target"
                value={groupId}
                options={groups.map((group) => ({ value: group.value, label: group.label }))}
                placeholder="固定グループを選ぶ"
                disabled={adding.isAdding}
                onChange={(v) => setGroupId(v ? String(v) : "")}
              />
            </Stack>
          )}
          {adding.reason ? (
            <Para size="sm" tone="destructive" className="my-0" data-slot="bulk-user-group-reason">
              {adding.reason}
            </Para>
          ) : null}
        </Stack>
      </Modal>
    </>
  );
}

/** 選んだ利用者で固定のグループを作る */
export function bulkCreateUserGroupAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: BulkUserGroupActionOptions = {},
): BulkActionItem<Row, Access> {
  const label = options.label ?? "選択したユーザーでグループを作成";
  const Component = (props: BulkActionProps<Row>) => (
    <CreateFromSelection {...(props as BulkActionProps<unknown>)} selection={{ ...props.selection, count: options.disabled ? 0 : props.selection.count }} label={label} />
  );
  Component.displayName = `bulkCreateUserGroupAction(${meta.key})`;
  return { ...meta, Component };
}

/** 選んだ利用者を既存の固定のグループに足す */
export function bulkAddToUserGroupAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: BulkUserGroupActionOptions = {},
): BulkActionItem<Row, Access> {
  const label = options.label ?? "固定グループに追加";
  const Component = (props: BulkActionProps<Row>) => (
    <AddSelection {...(props as BulkActionProps<unknown>)} selection={{ ...props.selection, count: options.disabled ? 0 : props.selection.count }} label={label} />
  );
  Component.displayName = `bulkAddToUserGroupAction(${meta.key})`;
  return { ...meta, Component };
}
