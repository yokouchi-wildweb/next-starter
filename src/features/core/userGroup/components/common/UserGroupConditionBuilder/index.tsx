// src/features/core/userGroup/components/common/UserGroupConditionBuilder/index.tsx
// 部品(props だけ): 条件の組み立て。根の組(すべて満たす / いずれかを満たす)の中に条件と条件グループ(2 階層まで。グループの中は条件だけ)。
// 見た目: 根の組 = 枠つきのカード(下に追加の操作) / 条件グループ = 左に色の帯 + 「条件グループ」の札 + 薄い地 / 並んだ条件の間に「かつ・または」 / 番号の札(グループの外の条件 = 1・2…、条件グループ = a・b…、その中 = a1・a2…。並びから毎回数える) / 条件・条件グループは右上でたたむ(見出しと 1 行の要約だけ。開閉は画面だけの状態)
// - どの条件・グループも「含める / 除外する」を選べる(not。両方を見せた 2 択)/ 条件は部品の label で選び、引数は部品の欄から(UserGroupCriterionFields)
// - 画面で組めない深い定義は読むだけで出し(label と引数の表示)、「作り直す」で空の組から組める
// 流れ(木の形・足す外す・定義の木への変換)は hook useUserGroupConditionBuilder。部品の鍵は出さない(D94)

"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { RadioGroupInput, SelectInput } from "@/components/Form/Input/Manual";
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

const OP_OPTIONS = (Object.keys(CONDITION_OP_LABELS) as ConditionGroupOp[]).map((value) => ({
  value,
  label: CONDITION_OP_LABELS[value],
}));
const UNKNOWN_CRITERION = "使用できない条件";
const NEGATE_OPTIONS = [
  { value: "include", label: "含める" },
  { value: "exclude", label: "除外する" },
];

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;
const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
};

/** 開く・たたむの切り替え(右上。たたむと見出しと要約だけ) */
function CollapseToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "たたむ" : "開く"}
      title={open ? "たたむ" : "開く"}
      className="size-8 text-muted-foreground"
      data-slot="condition-collapse"
    >
      <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
    </Button>
  );
}

/** 引数の表示(選択肢は label に。日時は読める形に。読むだけの表示・たたんだ時の要約) */
function describeArgs(criterion: CriterionCatalogItem | undefined, args: unknown): string {
  if (!criterion || !args || typeof args !== "object") return "";
  const parts: string[] = [];
  for (const field of criterion.fields) {
    const value = (args as Record<string, unknown>)[field.name];
    if (value === undefined || value === null || value === "") continue;
    const options = ((field as { options?: { value: unknown; label: string }[] }).options ?? []) as {
      value: unknown;
      label: string;
    }[];
    const show = (item: unknown) =>
      options.find((option) => String(option.value) === String(item))?.label ??
      (options.length > 0 ? "削除された選択肢" : String(item));
    const text = Array.isArray(value)
      ? value.map(show).join("・")
      : typeof value === "string" && ISO_DATETIME.test(value)
        ? formatDateTime(value)
        : show(value);
    parts.push(`${field.label ?? ""}: ${text}`);
  }
  return parts.join(" / ");
}

function ReadOnlyNode({
  node,
  criteria,
}: {
  node: UserGroupDefinitionNode;
  criteria: readonly CriterionCatalogItem[];
}) {
  if ("op" in node && node.op === "not") {
    return (
      <Stack space={1} className="border-l-2 border-border pl-3">
        <Span size="sm" weight="semiBold">
          除外する
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

/** 含める / 除外する(not)の 2 択。両方を見せて今の方を選んだ形にする(状態だけを出すボタンにしない) */
function NegateChoice({ node, actions, disabled }: Omit<NodeProps, "level" | "criteria">) {
  return (
    <RadioGroupInput
      aria-label="含める・除外する"
      value={node.negate ? "exclude" : "include"}
      options={NEGATE_OPTIONS}
      displayType="segmented"
      disabled={disabled}
      onChange={(v) => actions.setNegate(node.id, v === "exclude")}
      data-slot="negate"
    />
  );
}

/** 番号の札(条件 = 1・2… / グループの中 = a1・a2…) */
function NumberTag({ children }: { children: string }) {
  return (
    <Span
      size="xs"
      weight="semiBold"
      tone="muted"
      className="min-w-6 rounded-md bg-muted px-1.5 py-0.5 text-center tabular-nums"
      data-slot="condition-number"
    >
      {children}
    </Span>
  );
}

function CriterionNode({
  node,
  number,
  criteria,
  actions,
  disabled,
}: Omit<NodeProps, "level"> & { node: Extract<ConditionDraftNode, { type: "criterion" }>; number: string }) {
  const criterion = criteria.find((c) => c.key === node.part);
  const [open, setOpen] = useState(true);
  const summary = criterion ? describeArgs(criterion, node.args) : "";
  return (
    <Stack
      space={2}
      className="rounded-md border border-border bg-card p-3"
      data-slot="condition-criterion"
      data-collapsed={open ? undefined : ""}
    >
      <Flex align="center" justify="between" gap="xs" wrap="wrap">
        <Flex align="center" gap="xs" wrap="wrap">
          <NumberTag>{number}</NumberTag>
          <Span weight="semiBold">{criterion?.label ?? UNKNOWN_CRITERION}</Span>
          {criterion?.weight === "heavy" ? (
            <Span size="sm" tone="warning">
              {criterion.weightLabel}
            </Span>
          ) : null}
        </Flex>
        <Flex align="center" gap="xs">
          <NegateChoice node={node} actions={actions} disabled={disabled} />
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => actions.remove(node.id)}>
            削除
          </Button>
          <CollapseToggle open={open} onToggle={() => setOpen((v) => !v)} />
        </Flex>
      </Flex>
      {!open ? (
        <Para size="sm" tone="muted" className="my-0 line-clamp-1" data-slot="condition-summary">
          {summary || "未入力"}
        </Para>
      ) : null}
      {open && criterion?.description ? (
        <Para size="sm" tone="muted" className="my-0">
          {criterion.description}
        </Para>
      ) : null}
      {open && criterion ? (
        <UserGroupCriterionFields
          fields={criterion.fields}
          inlineGroups={criterion.inlineGroups}
          args={node.args}
          onChange={(args) => actions.setArgs(node.id, args)}
          disabled={disabled}
        />
      ) : null}
    </Stack>
  );
}

/** 並んだ条件の間に置く合わせ方の印(すべて = かつ / いずれか = または) */
function JoinMark({ op }: { op: ConditionGroupOp }) {
  return (
    <Flex align="center" gap="sm" aria-hidden data-slot="condition-join">
      <Span className="h-px flex-1 bg-border">{null}</Span>
      <Span
        size="xs"
        weight="medium"
        tone="muted"
        className="rounded-full border border-border bg-background px-2.5 py-0.5"
      >
        {op === "and" ? "かつ" : "または"}
      </Span>
      <Span className="h-px flex-1 bg-border">{null}</Span>
    </Flex>
  );
}

/** 条件グループの記号(0 → a、25 → z、26 → aa) */
function groupLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function GroupNode({
  node,
  level,
  letter = "",
  criteria,
  actions,
  disabled,
}: NodeProps & { node: ConditionDraftGroup; /** 条件グループの記号(根は空) */ letter?: string }) {
  const isRoot = level === 1;
  const [open, setOpen] = useState(true);
  const expanded = isRoot || open;
  // 番号は並びから毎回数える(足す・消すと付け直す)。根 = 条件は 1・2…、グループは a・b… / グループの中 = a1・a2…
  let criterionCount = 0;
  let groupCount = 0;
  const numbers = node.children.map((child) =>
    child.type === "group" ? groupLetter(groupCount++) : `${letter}${++criterionCount}`,
  );
  const pickOptions = criteria.map((criterion) => ({
    value: criterion.key,
    label: criterion.weight === "heavy" ? `${criterion.label}(${criterion.weightLabel})` : criterion.label,
  }));
  return (
    <Stack
      space={3}
      className={
        isRoot
          ? "rounded-lg border border-border bg-card p-4"
          : "rounded-lg border border-border border-l-4 border-l-primary/60 bg-muted/40 p-3"
      }
      data-slot={`condition-group-${level}`}
    >
      <Flex align="center" justify="between" gap="xs" wrap="wrap">
        <Flex align="center" gap="xs" wrap="wrap">
          {isRoot ? null : (
            <Span size="xs" weight="semiBold" tone="primary" className="rounded-full bg-primary/10 px-2.5 py-0.5">
              {`条件グループ ${letter}`}
            </Span>
          )}
          <Span size="sm">{isRoot ? "次の条件を" : "この中の条件を"}</Span>
          <SelectInput
            value={node.op}
            options={OP_OPTIONS}
            showPlaceholderOption={false}
            size="sm"
            className="w-auto data-[size=sm]:h-9"
            disabled={disabled}
            onChange={(value) => value && actions.setOp(node.id, String(value) as ConditionGroupOp)}
          />
          <NegateChoice node={node} actions={actions} disabled={disabled} />
        </Flex>
        {isRoot ? null : (
          <Flex align="center" gap="xs">
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => actions.remove(node.id)}>
              グループを削除
            </Button>
            <CollapseToggle open={open} onToggle={() => setOpen((v) => !v)} />
          </Flex>
        )}
      </Flex>
      {!expanded ? (
        <Para size="sm" tone="muted" className="my-0" data-slot="condition-summary">
          {node.children.length === 0
            ? "条件はまだありません"
            : `条件 ${node.children.length} 件(${numbers.join("・")})`}
        </Para>
      ) : node.children.length === 0 ? (
        <Para
          size="sm"
          tone="muted"
          align="center"
          className="my-0 rounded-md border border-dashed border-border px-3 py-4"
        >
          {isRoot
            ? "条件はまだありません。下の「条件を追加」から足してください"
            : "このグループに条件を追加してください"}
        </Para>
      ) : (
        <Stack space={2}>
          {node.children.map((child, index) => (
            <Fragment key={child.id}>
              {index > 0 ? <JoinMark op={node.op} /> : null}
              {child.type === "group" ? (
                <GroupNode
                  node={child}
                  level={level + 1}
                  letter={numbers[index]}
                  criteria={criteria}
                  actions={actions}
                  disabled={disabled}
                />
              ) : (
                <CriterionNode
                  node={child}
                  number={numbers[index]}
                  criteria={criteria}
                  actions={actions}
                  disabled={disabled}
                />
              )}
            </Fragment>
          ))}
        </Stack>
      )}
      {expanded ? (
        <Flex align="center" gap="xs" wrap="wrap" className={isRoot ? "border-t border-border pt-3" : ""}>
          <SelectInput
            value=""
            options={pickOptions}
            showPlaceholderOption={false}
            placeholder={isRoot ? "条件を追加" : "このグループに条件を追加"}
            disabled={disabled}
            onChange={(value) => value && actions.addCriterion(node.id, String(value))}
          />
          {isRoot ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => actions.addGroup(node.id)}
            >
              条件グループを追加
            </Button>
          ) : null}
        </Flex>
      ) : null}
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
