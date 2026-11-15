// src/features/core/userGroup/components/common/UserGroupConditionBuilder/index.tsx
// 部品(props だけ): 条件の組み立て。根の組(すべて満たす / どれか 1 つを満たす)の中に条件と組(2 段まで。組の中は条件だけ)。
// - どの条件・組にも「当てはまらない人」を付けられる(not)/ 条件は部品の label で選び、引数は部品の欄から(UserGroupCriterionFields)
// - 画面で組めない深い定義は読むだけで出し(label と引数の表示)、「作り直す」で空の組から組める
// 流れ(木の形・足す外す・定義の木への変換)は hook useUserGroupConditionBuilder。部品の鍵は出さない(D94)

"use client";

import { Button } from "@/components/Form/Button";
import { SelectInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

import { UserGroupCriterionFields } from "@/features/core/userGroup/components/common/UserGroupCriterionFields";
import {
  CONDITION_OP_LABELS,
  type ConditionBuilderState,
  type ConditionDraftGroup,
  type ConditionDraftNode,
  type ConditionGroupOp,
  type CriterionCatalogItem,
} from "@/features/core/userGroup/hooks/useUserGroupConditionBuilder";
import type { UserGroupDefinitionNode } from "@/features/core/userGroup/services/client/userGroupAdminClient";

export type UserGroupConditionBuilderProps = {
  /** 組める形の根(null = 読むだけ) */
  root: ConditionDraftGroup | null;
  /** 読むだけの時の元の定義 */
  readOnlyDefinition?: UserGroupDefinitionNode | null;
  readOnlyNote?: string | null;
  criteria: readonly CriterionCatalogItem[];
  actions: ConditionBuilderState["actions"];
  problems?: readonly string[];
  disabled?: boolean;
};

const OP_OPTIONS = (Object.keys(CONDITION_OP_LABELS) as ConditionGroupOp[]).map((value) => ({ value, label: CONDITION_OP_LABELS[value] }));
const UNKNOWN_CRITERION = "今は使えない条件";

/** 引数の表示(選択肢は label に。読むだけの表示) */
function describeArgs(criterion: CriterionCatalogItem | undefined, args: unknown): string {
  if (!criterion || !args || typeof args !== "object") return "";
  const parts: string[] = [];
  for (const field of criterion.fields) {
    const value = (args as Record<string, unknown>)[field.name];
    if (value === undefined || value === null || value === "") continue;
    const options = ((field as { options?: { value: unknown; label: string }[] }).options ?? []) as { value: unknown; label: string }[];
    const show = (item: unknown) => options.find((option) => String(option.value) === String(item))?.label ?? (options.length > 0 ? "今は無い選択肢" : String(item));
    const text = Array.isArray(value) ? value.map(show).join("・") : show(value);
    parts.push(`${field.label ?? ""}: ${text}`);
  }
  return parts.join(" / ");
}

function ReadOnlyNode({ node, criteria }: { node: UserGroupDefinitionNode; criteria: readonly CriterionCatalogItem[] }) {
  if ("op" in node && node.op === "not") {
    return (
      <Stack space={1} className="border-l-2 border-border pl-3">
        <Span size="sm" weight="semiBold">
          当てはまらない人
        </Span>
        <ReadOnlyNode node={node.child} criteria={criteria} />
      </Stack>
    );
  }
  if ("op" in node) {
    return (
      <Stack space={1} className="border-l-2 border-border pl-3">
        <Span size="sm" weight="semiBold">
          {CONDITION_OP_LABELS[node.op]}
        </Span>
        {node.children.map((child, index) => (
          <ReadOnlyNode key={index} node={child} criteria={criteria} />
        ))}
      </Stack>
    );
  }
  const criterion = criteria.find((c) => c.key === node.part);
  return (
    <Span size="sm">
      {`${criterion?.label ?? UNKNOWN_CRITERION}${criterion ? `(${describeArgs(criterion, node.args)})` : ""}`}
    </Span>
  );
}

type NodeProps = {
  node: ConditionDraftNode;
  level: number;
  criteria: readonly CriterionCatalogItem[];
  actions: ConditionBuilderState["actions"];
  disabled: boolean;
};

function NegateToggle({ node, actions, disabled }: Omit<NodeProps, "level" | "criteria">) {
  return (
    <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => actions.setNegate(node.id, !node.negate)} data-slot="negate">
      {node.negate ? "当てはまらない人" : "当てはまる人"}
    </Button>
  );
}

function CriterionNode({ node, criteria, actions, disabled }: Omit<NodeProps, "level"> & { node: Extract<ConditionDraftNode, { type: "criterion" }> }) {
  const criterion = criteria.find((c) => c.key === node.part);
  return (
    <Stack space={2} className="rounded-md border border-border bg-card p-3" data-slot="condition-criterion">
      <Flex align="center" justify="between" gap="xs" wrap="wrap">
        <Flex align="center" gap="xs" wrap="wrap">
          <Span weight="semiBold">{criterion?.label ?? UNKNOWN_CRITERION}</Span>
          {criterion?.weight === "heavy" ? (
            <Span size="sm" tone="warning">
              {criterion.weightLabel}
            </Span>
          ) : null}
        </Flex>
        <Flex gap="xs">
          <NegateToggle node={node} actions={actions} disabled={disabled} />
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => actions.remove(node.id)}>
            外す
          </Button>
        </Flex>
      </Flex>
      {criterion?.description ? (
        <Para size="sm" tone="muted" className="my-0">
          {criterion.description}
        </Para>
      ) : null}
      {criterion ? (
        <UserGroupCriterionFields fields={criterion.fields} args={node.args} onChange={(args) => actions.setArgs(node.id, args)} disabled={disabled} />
      ) : null}
    </Stack>
  );
}

function GroupNode({ node, level, criteria, actions, disabled }: NodeProps & { node: ConditionDraftGroup }) {
  const pickOptions = criteria.map((criterion) => ({
    value: criterion.key,
    label: criterion.weight === "heavy" ? `${criterion.label}(${criterion.weightLabel})` : criterion.label,
  }));
  return (
    <Stack space={3} className={level === 1 ? "" : "rounded-md border border-dashed border-border p-3"} data-slot={`condition-group-${level}`}>
      <Flex align="center" justify="between" gap="xs" wrap="wrap">
        <Flex align="center" gap="xs" wrap="wrap">
          <Span size="sm">{level === 1 ? "次の条件を" : "この組の条件を"}</Span>
          <SelectInput
            value={node.op}
            options={OP_OPTIONS}
            showPlaceholderOption={false}
            disabled={disabled}
            onChange={(value) => value && actions.setOp(node.id, String(value) as ConditionGroupOp)}
          />
          <NegateToggle node={node} actions={actions} disabled={disabled} />
        </Flex>
        {level > 1 ? (
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => actions.remove(node.id)}>
            組を外す
          </Button>
        ) : null}
      </Flex>
      {node.children.map((child) =>
        child.type === "group" ? (
          <GroupNode key={child.id} node={child} level={level + 1} criteria={criteria} actions={actions} disabled={disabled} />
        ) : (
          <CriterionNode key={child.id} node={child} criteria={criteria} actions={actions} disabled={disabled} />
        ),
      )}
      <Flex align="center" gap="xs" wrap="wrap">
        <SelectInput
          value=""
          options={pickOptions}
          showPlaceholderOption={false}
          placeholder="条件を足す"
          disabled={disabled}
          onChange={(value) => value && actions.addCriterion(node.id, String(value))}
        />
        {level === 1 ? (
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => actions.addGroup(node.id)}>
            組を足す
          </Button>
        ) : null}
      </Flex>
    </Stack>
  );
}

export function UserGroupConditionBuilder({
  root,
  readOnlyDefinition = null,
  readOnlyNote = null,
  criteria,
  actions,
  problems = [],
  disabled = false,
}: UserGroupConditionBuilderProps) {
  if (!root) {
    return (
      <Stack space={3} data-slot="condition-read-only">
        {readOnlyNote ? (
          <Para size="sm" tone="muted" className="my-0">
            {readOnlyNote}
          </Para>
        ) : null}
        {readOnlyDefinition ? <ReadOnlyNode node={readOnlyDefinition} criteria={criteria} /> : null}
        {!disabled ? (
          <Flex>
            <Button type="button" size="sm" variant="outline" onClick={actions.reset}>
              作り直す
            </Button>
          </Flex>
        ) : null}
      </Stack>
    );
  }
  return (
    <Stack space={3} data-slot="condition-builder">
      <GroupNode node={root} level={1} criteria={criteria} actions={actions} disabled={disabled} />
      {problems.map((problem) => (
        <Para key={problem} size="sm" tone="destructive" className="my-0">
          {problem}
        </Para>
      ))}
    </Stack>
  );
}
