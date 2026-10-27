// dc:generate:component: 複数ドメインを選び、コンポーネントを個別に選んで生成する

import { createDomainContext } from "../../domain/context.mjs";
import { createWorkspace } from "../../domain/workspace.mjs";
import { applyOutputs } from "../../pipeline/apply.mjs";
import { COMPONENT_SPECS } from "../../render/components/catalog.mjs";
import { renderComponent } from "../../render/components/index.mjs";
import { confirmSelection, prompt, selectDomains } from "../prompts.mjs";

const COMPONENT_CHOICES = [
  { name: "CreateXxxForm.tsx（作成フォーム）", value: "createForm" },
  { name: "EditXxxForm.tsx（編集フォーム）", value: "editForm" },
  { name: "XxxForm.tsx（共通フォーム）", value: "domainForm" },
  { name: "XxxFields.tsx（フィールド定義）", value: "domainFields" },
  { name: "XxxDetailModal.tsx（詳細モーダル）", value: "detailModal" },
  { name: "AdminXxxCreate/index.tsx（管理画面：作成ページ）", value: "adminCreate" },
  { name: "AdminXxxEdit/index.tsx（管理画面：編集ページ）", value: "adminEdit" },
  { name: "AdminXxxList/index.tsx（管理画面：一覧ページ）", value: "adminListIndex" },
  { name: "AdminXxxList/Header.tsx（管理画面：一覧ヘッダー）", value: "adminListHeader" },
  { name: "AdminXxxList/Table.tsx（管理画面：一覧テーブル）", value: "adminListTable" },
  { name: "AdminXxxSort/index.tsx（管理画面：並び替えページ／sortOrderField が必要）", value: "adminSort" },
];

function generateComponentsFor(workspace, domain, selectedComponents) {
  const ctx = createDomainContext(workspace, domain);
  const outputs = [];
  for (const key of selectedComponents) {
    const spec = COMPONENT_SPECS.find((s) => s.key === key);
    if (!spec) continue;
    const output = renderComponent(ctx, workspace, spec);
    if (output) outputs.push(output);
  }
  applyOutputs(outputs);
}

export async function runPickComponents() {
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

  const { selectedComponents } = await prompt({
    type: "checkbox",
    name: "selectedComponents",
    message: "生成するコンポーネントを選択してください（スペースで選択／Enterで確定）:",
    choices: COMPONENT_CHOICES,
    default: ["createForm", "editForm", "domainForm", "domainFields"],
    loop: false,
  });
  if (!selectedComponents.length) {
    console.log("生成対象のコンポーネントが選択されなかったため、キャンセルしました。");
    return;
  }

  const labels = selectedComponents.map((comp) => COMPONENT_CHOICES.find((c) => c.value === comp)?.name || comp);
  if (!(await confirmSelection(selectedDomains, "コンポーネント", labels))) {
    console.log("生成をキャンセルしました。");
    return;
  }

  for (const domain of selectedDomains) {
    console.log(`\n[${domain}] のコンポーネント生成を開始します。`);
    generateComponentsFor(workspace, domain, selectedComponents);
  }
  console.log("\nすべてのコンポーネント生成が完了しました。");
}
