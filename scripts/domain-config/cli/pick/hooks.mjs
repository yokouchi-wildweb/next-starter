// dc:generate:hook: 複数ドメインを選び、フックを個別に選んで生成する

import { createDomainContext } from "../../domain/context.mjs";
import { createWorkspace } from "../../domain/workspace.mjs";
import { applyOutputs } from "../../pipeline/apply.mjs";
import { HOOK_SPECS } from "../../render/hooks/catalog.mjs";
import { renderHook } from "../../render/hooks/index.mjs";
import { confirmSelection, prompt, selectDomains } from "../prompts.mjs";

const BASE_HOOK_CHOICES = [
  { name: "useXxx.ts（単一取得）", value: "get" },
  { name: "useXxxList.ts（一覧取得）", value: "list" },
  { name: "useSearchXxx.ts（検索）", value: "search" },
  { name: "useCreateXxx.ts（作成）", value: "create" },
  { name: "useUpdateXxx.ts（更新）", value: "update" },
  { name: "useUpsertXxx.ts（upsert）", value: "upsert" },
  { name: "useDeleteXxx.ts（削除）", value: "delete" },
  { name: "useBulkDeleteByIdsXxx.ts（ID指定一括削除）", value: "bulkDeleteByIds" },
  { name: "useBulkDeleteByQueryXxx.ts（クエリ指定一括削除）", value: "bulkDeleteByQuery" },
  { name: "useBulkUpsertXxx.ts（一括upsert）", value: "bulkUpsert" },
  { name: "useBulkUpdateXxx.ts（一括更新）", value: "bulkUpdate" },
];

// 条件付きフック（選んだドメインのうち 1 つでも条件を満たせば選択肢に出す）
const CONDITIONAL_HOOK_CHOICES = [
  { name: "useXxxViewModal.ts（詳細モーダル）", value: "viewModal", condition: "useDetailModal" },
  { name: "useDuplicateXxx.ts（複製）", value: "duplicate", condition: "useDuplicateButton" },
  { name: "useRestoreXxx.ts（復元）", value: "restore", condition: "useSoftDelete" },
  { name: "useHardDeleteXxx.ts（物理削除）", value: "hardDelete", condition: "useSoftDelete" },
  { name: "useReorderXxx.ts（並び替え）", value: "reorder", condition: "sortOrderField" },
  { name: "useSearchForSortingXxx.ts（ソート用検索）", value: "searchForSorting", condition: "sortOrderField" },
];

function generateHooksFor(workspace, domain, selectedHooks) {
  const ctx = createDomainContext(workspace, domain);
  const outputs = [];
  for (const hookKey of selectedHooks) {
    const conditionalDef = CONDITIONAL_HOOK_CHOICES.find((c) => c.value === hookKey);
    if (conditionalDef && !ctx.config?.[conditionalDef.condition]) {
      console.log(`  [スキップ] ${hookKey}: ${domain} では ${conditionalDef.condition} が無効です`);
      continue;
    }
    const spec = HOOK_SPECS.find((s) => s.key === hookKey);
    if (spec) outputs.push(renderHook(ctx, workspace, spec));
  }
  applyOutputs(outputs);
}

export async function runPickHooks() {
  const workspace = createWorkspace();
  const domains = workspace.listDomains();
  if (domains.length === 0) {
    console.log("domain.json を含むドメインが存在しません。");
    return;
  }

  const selectedDomains = await selectDomains(domains);
  if (!selectedDomains.length) {
    console.log("生成対象が選択されなかったため、キャンセルしました。");
    return;
  }

  const domainConfigs = selectedDomains.map((domain) => workspace.readConfig(domain));
  const hookChoices = [
    ...BASE_HOOK_CHOICES,
    ...CONDITIONAL_HOOK_CHOICES.filter((choice) => domainConfigs.some((config) => config && config[choice.condition])),
  ];
  const { selectedHooks } = await prompt({
    type: "checkbox",
    name: "selectedHooks",
    message: "生成するフックを選択してください（スペースで選択／Enterで確定）:",
    choices: hookChoices,
    default: BASE_HOOK_CHOICES.map((c) => c.value),
    loop: false,
  });
  if (!selectedHooks.length) {
    console.log("生成対象のフックが選択されなかったため、キャンセルしました。");
    return;
  }

  const labels = selectedHooks.map((hook) => hookChoices.find((c) => c.value === hook)?.name || hook);
  if (!(await confirmSelection(selectedDomains, "フック", labels))) {
    console.log("生成をキャンセルしました。");
    return;
  }

  for (const domain of selectedDomains) {
    console.log(`\n[${domain}] のフック生成を開始します。`);
    generateHooksFor(workspace, domain, selectedHooks);
  }
  console.log("\nすべてのフック生成が完了しました。");
}
