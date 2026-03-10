// scripts/role-config/questions/profile-relations.mjs
// プロフィール用リレーション質問
//
// ドメインの relations.mjs をベースに、プロフィール固有の制約を反映:
// - dbEngine は常に Neon（PostgreSQL）
// - belongsTo と belongsToMany のみ（hasMany/hasOne はプロフィールでは不要）
// - fieldType は uuid 固定

import inquirer from "inquirer";
import { toSnakeCase, toPascalCase } from "../../../src/utils/stringCase.mjs";

const prompt = inquirer.createPromptModule();

/**
 * 単一リレーションの詳細を質問
 */
async function askSingleRelation(domain, label, relationType) {
  const defaultField =
    relationType === "belongsToMany"
      ? toSnakeCase(`${domain}_ids`)
      : toSnakeCase(`${domain}_id`);

  let fieldName = defaultField;

  if (relationType !== "belongsToMany") {
    const resName = await prompt({
      type: "input",
      name: "fieldName",
      message: `リレーションIDのフィールド名（snake_case） [${defaultField}]:`,
      default: defaultField,
    });
    fieldName = toSnakeCase(resName.fieldName.trim()) || defaultField;
  }

  let required = false;
  if (relationType === "belongsTo") {
    const res = await prompt({
      type: "confirm",
      name: "required",
      message: "このリレーションIDを必須にしますか?",
      default: false,
    });
    required = res.required;
  }

  let onDelete = undefined;
  if (relationType === "belongsTo") {
    const onDeleteChoices = [
      { name: "RESTRICT（参照があれば削除を拒否）", value: "RESTRICT" },
      { name: "CASCADE（このレコードも削除）", value: "CASCADE" },
    ];
    if (!required) {
      onDeleteChoices.push({
        name: "SET_NULL（外部キーをNULLに設定）",
        value: "SET_NULL",
      });
    }

    const res = await prompt({
      type: "list",
      name: "onDelete",
      message: "参照先削除時の挙動を選択:",
      choices: onDeleteChoices,
      default: "RESTRICT",
    });
    onDelete = res.onDelete;
  }

  let includeRelationTable = false;
  if (relationType === "belongsToMany") {
    const res = await prompt({
      type: "confirm",
      name: "includeRelationTable",
      message: "中間テーブル定義を含めますか?",
      default: true,
    });
    includeRelationTable = res.includeRelationTable;
  }

  // フォーム入力タイプ
  let formInput = undefined;
  if (relationType === "belongsTo") {
    const res = await prompt({
      type: "list",
      name: "formInput",
      message: "フォーム入力タイプを選択:",
      choices: [
        { name: "非同期コンボボックス（asyncCombobox）", value: "asyncCombobox" },
        { name: "セレクトボックス（select）", value: "select" },
        { name: "非表示（hidden）", value: "hidden" },
      ],
      default: "asyncCombobox",
    });
    formInput = res.formInput;
  } else if (relationType === "belongsToMany") {
    const res = await prompt({
      type: "list",
      name: "formInput",
      message: "フォーム入力タイプを選択:",
      choices: [
        { name: "非同期マルチセレクト（asyncMultiSelect）", value: "asyncMultiSelect" },
        { name: "マルチセレクト（multiSelect）", value: "multiSelect" },
        { name: "非表示（hidden）", value: "hidden" },
      ],
      default: "asyncMultiSelect",
    });
    formInput = res.formInput;
  }

  const defaultLabel = toPascalCase(domain) || domain;
  return {
    domain,
    label: label.trim() || defaultLabel,
    fieldName: relationType === "belongsToMany" ? defaultField : fieldName,
    fieldType: "uuid",
    relationType,
    required,
    ...(onDelete && { onDelete }),
    ...(relationType === "belongsToMany" && { includeRelationTable }),
    ...(formInput && { formInput }),
  };
}

/**
 * プロフィール用リレーション質問のメイン関数
 */
export default async function askProfileRelations() {
  const relations = [];

  console.log("\n--- リレーション設定 ---");

  while (true) {
    const { domain } = await prompt({
      type: "input",
      name: "domain",
      message:
        relations.length === 0
          ? "関連ドメイン名（snake_case、例: contributor_tag。空でスキップ）:"
          : "関連ドメイン名（snake_case。空で終了）:",
    });

    const trimmedDomain = domain.trim();
    if (!trimmedDomain) break;
    const normalizedDomain = toSnakeCase(trimmedDomain);

    const { relationType } = await prompt({
      type: "list",
      name: "relationType",
      message: "リレーション種別を選択:",
      choices: [
        { name: "参照（belongsTo）", value: "belongsTo" },
        { name: "多対多（belongsToMany）", value: "belongsToMany" },
      ],
    });

    const { label } = await prompt({
      type: "input",
      name: "label",
      message: "このリレーションの表示名:",
    });

    const relation = await askSingleRelation(
      normalizedDomain,
      label,
      relationType
    );
    relations.push(relation);
    console.log("\nリレーションを追加しました:", relation, "\n");
  }

  return { relations };
}
