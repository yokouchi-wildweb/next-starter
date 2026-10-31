// components/ テンプレートのうち、domain.json の設定で本文が変わるもの: 編集フォームのオートセーブ、一覧テーブルの複製ボタン

/** Edit__Domain__Form.tsx: useAutoSave なら import・フック・props を差し込む（トークン置換の前に行う） */
export function applyAutoSave(content, config) {
  if (!(config?.useAutoSave ?? false)) return content;
  return content
    .replace(
      'import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";',
      'import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";\nimport { useAutoSaveConfig } from "@/components/Form/AutoSave";',
    )
    .replace(
      "const { trigger, isMutating } = useUpdate__Domain__();",
      "const { trigger, isMutating } = useUpdate__Domain__();\n  const autoSave = useAutoSaveConfig(trigger, __domain__.id);",
    )
    .replace("onCancel={() => router.push(redirectPath)}", "autoSave={autoSave}");
}

/** Admin__Domain__List/Table.tsx: 複製ボタンのプレースホルダー（__DUPLICATE_IMPORT__ / __DUPLICATE_BUTTON__） */
export function applyDuplicateButton(content, config) {
  if (!(config?.useDuplicateButton ?? false)) {
    return content.replace(/__DUPLICATE_IMPORT__/g, "").replace(/__DUPLICATE_BUTTON__/g, "");
  }
  // string 型の name フィールドを持つドメインでは、複製確認時に名前を編集できるよう currentName を渡す
  // （name が無いドメインで d.name を参照すると型エラーになるため条件付き）。非必須の name は string | null なので undefined に変換する
  const nameField = (config?.fields ?? []).find((f) => f.name === "name" && f.fieldType === "string");
  const currentNameAttr = nameField ? (nameField.required ? " currentName={d.name}" : " currentName={d.name ?? undefined}") : "";
  const duplicateImport = `import { EditButton, DuplicateButton, DeleteButton } from "@/lib/crud";\n`;
  const duplicateButton = `<DuplicateButton domain={__domain__Display} id={d.id}${currentNameAttr} />\n        `;
  return content
    .replace(/import { EditButton, DeleteButton } from "@\/lib\/crud";\n__DUPLICATE_IMPORT__/g, duplicateImport)
    .replace(/__DUPLICATE_BUTTON__/g, duplicateButton);
}
