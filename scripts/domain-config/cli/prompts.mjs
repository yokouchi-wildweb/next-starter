// 複数の CLI で共通の対話（ドメインの選択・確認）。inquirer を使うのは cli/ と questions/ だけ

import inquirer from "inquirer";

export const prompt = inquirer.createPromptModule();

/** 1 ドメインを選ぶ。候補が無ければ例外 */
export async function selectDomain(domains, message = "生成するドメインを選択してください:") {
  if (domains.length === 0) {
    throw new Error("domain.json を含むドメインが存在しません。");
  }
  const { selectedDomain } = await prompt({
    type: "list",
    name: "selectedDomain",
    message,
    choices: domains.map((d) => ({ name: d, value: d })),
    loop: false,
  });
  return selectedDomain;
}

/** 複数ドメインを選ぶ（既定は全件） */
export async function selectDomains(domains) {
  const { selectedDomains } = await prompt({
    type: "checkbox",
    name: "selectedDomains",
    message: "生成対象のドメインを選択してください（スペースで選択／Enterで確定）:",
    choices: domains.map((domain) => ({ name: domain, value: domain })),
    default: domains,
    loop: false,
  });
  return selectedDomains;
}

export async function confirm(message, defaultValue = false) {
  const { answer } = await prompt({ type: "confirm", name: "answer", message, default: defaultValue });
  return answer;
}

/** 選択内容の確認表示 + 実行の確認（dc:generate:hook / component / service） */
export async function confirmSelection(selectedDomains, kindLabel, items) {
  console.log(`\n対象ドメイン（${selectedDomains.length}件）:`);
  selectedDomains.forEach((domain) => console.log(`  - ${domain}`));
  console.log(`\n生成する${kindLabel}（${items.length}件）:`);
  items.forEach((item) => console.log(`  - ${item}`));
  return confirm("\n選択した内容で生成を実行しますか？既存ファイルは上書きされます。", false);
}
