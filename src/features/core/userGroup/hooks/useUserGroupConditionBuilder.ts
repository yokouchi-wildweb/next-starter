"use client";

// src/features/core/userGroup/hooks/useUserGroupConditionBuilder.ts
//
// 管理: 条件の組み立ての流れ(部品 UserGroupConditionBuilder はこれが返す物を描くだけ)。
// - 画面で組める形(2 段まで): 根の組(すべて満たす and / どれか満たす or)の中に、条件と組。組の中は条件だけ。
//   どの条件・組にも「当てはまらない(not)」を付けられる
// - 保存した定義がこの形に収まらない(3 段以上・not の重なりなど)時は読むだけ(readOnly + 注意)。「作り直す」で空の組から組める
// - 部品は catalog の label で選び、引数の初めの値は部品の欄の defaultValue
// - toDefinition(): 定義の木 { op, children } / { op: "not", child } / { part, args }。空の組がある間は problems に出す
// - heavy: 重い部品(weight heavy)を含むか(動的グループの注意に使う)

import { useCallback, useMemo, useState } from "react";

import type { AdminUserGroupCriteriaCatalog, UserGroupDefinitionNode } from "../services/client/userGroupAdminClient";

/** 組の合わせ方 */
export type ConditionGroupOp = "and" | "or";

/** 条件(部品 1 つと引数) */
export type ConditionDraftLeaf = {
  id: string;
  type: "criterion";
  /** 部品の鍵(定義の木の値としてだけ持つ。画面は catalog の label を出す) */
  part: string;
  args: Record<string, unknown>;
  negate: boolean;
};

/** 組(根 = 1 段目、その中の組 = 2 段目。2 段目の組は条件だけを持つ) */
export type ConditionDraftGroup = {
  id: string;
  type: "group";
  op: ConditionGroupOp;
  negate: boolean;
  children: ConditionDraftNode[];
};

export type ConditionDraftNode = ConditionDraftLeaf | ConditionDraftGroup;

export type CriterionCatalogItem = AdminUserGroupCriteriaCatalog["criteria"][number];

/** 画面で組める深さ(根の組 + その中の組) */
export const CONDITION_MAX_DEPTH = 2;

export const CONDITION_OP_LABELS: Record<ConditionGroupOp, string> = {
  and: "すべて満たす",
  or: "いずれかを満たす",
};

let seq = 0;
const nextId = () => `n${++seq}`;

/** 空の根の組 */
export function emptyConditionRoot(): ConditionDraftGroup {
  return { id: nextId(), type: "group", op: "and", negate: false, children: [] };
}

/** 部品の欄の defaultValue から引数の初めの値 */
export function defaultArgsOf(criterion: CriterionCatalogItem | undefined): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const field of criterion?.fields ?? []) {
    const value = (field as { defaultValue?: unknown }).defaultValue;
    if (value !== undefined) args[field.name] = value;
  }
  return args;
}

const isOpNode = (node: UserGroupDefinitionNode): node is { op: "and" | "or"; children: UserGroupDefinitionNode[] } =>
  "op" in node && (node.op === "and" || node.op === "or");
const isNotNode = (node: UserGroupDefinitionNode): node is { op: "not"; child: UserGroupDefinitionNode } =>
  "op" in node && node.op === "not";

function leafOf(node: UserGroupDefinitionNode, negate: boolean): ConditionDraftLeaf | null {
  if (!("part" in node)) return null;
  const args = node.args && typeof node.args === "object" && !Array.isArray(node.args) ? (node.args as Record<string, unknown>) : {};
  return { id: nextId(), type: "criterion", part: node.part, args: { ...args }, negate };
}

/** level = 組の段(1 = 根)。収まらなければ null */
function nodeOf(node: UserGroupDefinitionNode, level: number, negate = false): ConditionDraftNode | null {
  if (isNotNode(node)) {
    if (negate) return null; // not の重なりは組めない
    return nodeOf(node.child, level, true);
  }
  if (isOpNode(node)) {
    if (level > CONDITION_MAX_DEPTH) return null;
    const children: ConditionDraftNode[] = [];
    for (const child of node.children) {
      const draft = nodeOf(child, level + 1);
      if (!draft) return null;
      children.push(draft);
    }
    return { id: nextId(), type: "group", op: node.op, negate, children };
  }
  return leafOf(node, negate);
}

/** 保存した定義 → 画面の組(収まらない = null。読むだけで出す) */
export function conditionFromDefinition(definition: UserGroupDefinitionNode | null | undefined): ConditionDraftGroup | null {
  if (!definition) return emptyConditionRoot();
  const draft = nodeOf(definition, 1);
  if (!draft) return null;
  // 根が条件 1 つ(または not の条件)= すべて満たすの組に入れる
  if (draft.type === "criterion") return { id: nextId(), type: "group", op: "and", negate: false, children: [draft] };
  return draft;
}

function definitionOfNode(node: ConditionDraftNode): UserGroupDefinitionNode {
  const inner: UserGroupDefinitionNode =
    node.type === "criterion"
      ? { part: node.part, args: node.args }
      : { op: node.op, children: node.children.map(definitionOfNode) };
  return node.negate ? { op: "not", child: inner } : inner;
}

/** 画面の組 → 定義の木 */
export function conditionToDefinition(root: ConditionDraftGroup): UserGroupDefinitionNode {
  return definitionOfNode(root);
}

/** 組めていない所(空の組・知らない部品)。空なら保存・見込みに出せる */
export function conditionProblems(root: ConditionDraftGroup, criteria: readonly CriterionCatalogItem[]): string[] {
  const problems: string[] = [];
  const walk = (node: ConditionDraftNode, top: boolean) => {
    if (node.type === "criterion") {
      if (!criteria.some((c) => c.key === node.part)) problems.push("使用できない条件があります(削除してください)");
      return;
    }
    if (node.children.length === 0) problems.push(top ? "条件を 1 つ以上追加してください" : "条件が空のグループがあります(条件を追加するか、グループを削除してください)");
    node.children.forEach((child) => walk(child, false));
  };
  walk(root, true);
  return [...new Set(problems)];
}

/** 重い部品を含むか */
export function conditionHasHeavy(root: ConditionDraftGroup | null, criteria: readonly CriterionCatalogItem[]): boolean {
  if (!root) return false;
  const walk = (node: ConditionDraftNode): boolean =>
    node.type === "criterion"
      ? criteria.find((c) => c.key === node.part)?.weight === "heavy"
      : node.children.some(walk);
  return walk(root);
}

function mapNode(node: ConditionDraftNode, id: string, fn: (node: ConditionDraftNode) => ConditionDraftNode | null): ConditionDraftNode | null {
  if (node.id === id) return fn(node);
  if (node.type === "criterion") return node;
  const children: ConditionDraftNode[] = [];
  for (const child of node.children) {
    const next = mapNode(child, id, fn);
    if (next) children.push(next);
  }
  return { ...node, children };
}

/** 組の段(根 = 1)。見つからない = 0 */
function levelOf(root: ConditionDraftGroup, id: string): number {
  const walk = (node: ConditionDraftNode, level: number): number => {
    if (node.id === id) return level;
    if (node.type === "criterion") return 0;
    for (const child of node.children) {
      const found = walk(child, level + 1);
      if (found) return found;
    }
    return 0;
  };
  return walk(root, 1);
}

export type UseUserGroupConditionBuilderOptions = {
  /** 保存した元の定義(作る時は null) */
  definition: UserGroupDefinitionNode | null;
  criteria: readonly CriterionCatalogItem[];
};

export function useUserGroupConditionBuilder({ definition, criteria }: UseUserGroupConditionBuilderOptions) {
  // 初めの組は 1 度だけ作る(入れ物が開いた回・1 件の版ごとに key して作り直す)
  const [initialRoot] = useState<ConditionDraftGroup | null>(() => conditionFromDefinition(definition));
  const [root, setRoot] = useState<ConditionDraftGroup | null>(initialRoot);

  const update = useCallback((fn: (root: ConditionDraftGroup) => ConditionDraftGroup) => {
    setRoot((prev) => (prev ? fn(prev) : prev));
  }, []);
  const change = useCallback(
    (id: string, fn: (node: ConditionDraftNode) => ConditionDraftNode | null) =>
      update((prev) => (mapNode(prev, id, fn) as ConditionDraftGroup | null) ?? prev),
    [update],
  );

  const addCriterion = useCallback(
    (groupId: string, part: string) =>
      change(groupId, (node) =>
        node.type === "group"
          ? {
              ...node,
              children: [
                ...node.children,
                { id: nextId(), type: "criterion", part, args: defaultArgsOf(criteria.find((c) => c.key === part)), negate: false },
              ],
            }
          : node,
      ),
    [change, criteria],
  );
  const addGroup = useCallback(
    (groupId: string) => {
      if (!root || levelOf(root, groupId) !== 1) return; // 組の中の組は根だけ(2 段まで)
      change(groupId, (node) =>
        node.type === "group" ? { ...node, children: [...node.children, { id: nextId(), type: "group", op: "or", negate: false, children: [] }] } : node,
      );
    },
    [change, root],
  );
  const remove = useCallback(
    (id: string) => {
      if (root?.id === id) return; // 根は外せない(作り直すは reset)
      change(id, () => null);
    },
    [change, root],
  );
  const setOp = useCallback(
    (groupId: string, op: ConditionGroupOp) => change(groupId, (node) => (node.type === "group" ? { ...node, op } : node)),
    [change],
  );
  const setNegate = useCallback((id: string, negate: boolean) => change(id, (node) => ({ ...node, negate })), [change]);
  const setArgs = useCallback(
    (leafId: string, args: Record<string, unknown>) => change(leafId, (node) => (node.type === "criterion" ? { ...node, args } : node)),
    [change],
  );
  /** 読むだけの定義を捨てて空の組から組む(または今の組を空にする) */
  const reset = useCallback(() => setRoot(emptyConditionRoot()), []);

  // 変えたか = 定義の木が初めと違う(欄の書き戻しで同じ値が来ても変えていない)。読むだけから作り直した = 変えた
  const touched = useMemo(
    () =>
      root !== initialRoot &&
      (initialRoot === null || root === null || JSON.stringify(conditionToDefinition(root)) !== JSON.stringify(conditionToDefinition(initialRoot))),
    [root, initialRoot],
  );
  const problems = useMemo(() => (root ? conditionProblems(root, criteria) : []), [root, criteria]);
  const heavy = useMemo(
    () => (root ? conditionHasHeavy(root, criteria) : false),
    [root, criteria],
  );

  return {
    /** 組める形の根(null = 読むだけ) */
    root,
    readOnly: root === null,
    /** 読むだけの時に出す元の定義 */
    readOnlyDefinition: root === null ? definition : null,
    readOnlyNote: root === null ? "この条件は画面で編集できる形(2 階層まで)より複雑なため、表示のみです。編集するには作り直してください" : null,
    /** 組を変えたか(読むだけのまま = 変えていない) */
    touched,
    problems,
    heavy,
    /** 定義の木(読むだけで変えていない = 元の定義) */
    toDefinition: (): UserGroupDefinitionNode | null => (root ? conditionToDefinition(root) : definition),
    actions: { addCriterion, addGroup, remove, setOp, setNegate, setArgs, reset },
  };
}

export type ConditionBuilderState = ReturnType<typeof useUserGroupConditionBuilder>;
