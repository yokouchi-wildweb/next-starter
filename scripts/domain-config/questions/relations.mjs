// Questions for domain relations
import inquirer from 'inquirer';
import { toSnakeCase } from '../../../src/utils/stringCase.mjs';
const prompt = inquirer.createPromptModule();

async function askSingleRelation(config, domain, label, relationType) {
  const defaultField =
    relationType === 'belongsToMany'
      ? toSnakeCase(`${domain}Ids`)
      : toSnakeCase(`${domain}Id`);

  let fieldName = defaultField;
  let fieldType = config.idType;

  if (relationType !== 'belongsToMany') {
    const resName = await prompt({
      type: 'input',
      name: 'fieldName',
      message: `リレーションIDのフィールド名（snake_case） [${defaultField}]:`,
      default: defaultField,
    });
    fieldName = resName.fieldName.trim();
    const normalizedFieldName = toSnakeCase(fieldName) || defaultField;
    fieldName = normalizedFieldName;

    const fieldChoices =
      config.dbEngine === 'Neon'
        ? [
            { name: 'uuid', value: 'uuid' },
            { name: 'string', value: 'string' },
            { name: 'number', value: 'number' },
          ]
        : [
            { name: 'string', value: 'string' },
            { name: 'number', value: 'number' },
            { name: 'reference', value: 'reference' },
          ];
    const resType = await prompt({
      type: 'list',
      name: 'fieldType',
      message: 'リレーションIDの型を選択:',
      choices: fieldChoices,
    });
    fieldType = resType.fieldType;
  }


  let required = undefined;
  if (relationType === 'belongsTo') {
    const res = await prompt({
      type: 'confirm',
      name: 'required',
      message: 'このリレーションIDを必須にしますか?',
      default: false,
    });
    required = res.required;
  }

  let onDeleteCascade = undefined;
  if (relationType === 'hasOne' || relationType === 'belongsTo') {
    const res = await prompt({
      type: 'confirm',
      name: 'onDeleteCascade',
      message: '関連レコード削除時にこのレコードも削除しますか?',
      default: false,
    });
    onDeleteCascade = res.onDeleteCascade;
  }

  let includeRelationTable = undefined;
  if (relationType === 'belongsToMany') {
    const res = await prompt({
      type: 'confirm',
      name: 'includeRelationTable',
      message: 'このドメインにリレーションの中間テーブル定義を含めますか?',
      default: true,
    });
    includeRelationTable = res.includeRelationTable;
  }

  return {
    domain: domain.trim(),
    label: label.trim() || domain.trim(),
    fieldName: fieldName.trim(),
    fieldType,
    relationType,
    required,
    onDeleteCascade,
    includeRelationTable,
  };
}

export default async function askRelations(config) {
  const relations = [];
  while (true) {
    const { domain } = await prompt({
      type: 'input',
      name: 'domain',
      message:
        relations.length === 0
          ? '関連ドメイン名（camelCase、例: cardRarity。空でスキップ）:'
          : '関連ドメイン名（camelCase。空で終了）:',
    });

    if (!domain.trim()) break;

    const { relationType } = await prompt({
      type: 'list',
      name: 'relationType',
      message: 'リレーション種別を選択:',
      choices: [
        { name: '参照（belongsTo）', value: 'belongsTo' },
        { name: '子リスト（hasMany）', value: 'hasMany' },
        { name: '多対多（belongsToMany）', value: 'belongsToMany' },
        { name: '1対1（hasOne）', value: 'hasOne' },
      ],
    });

    const { label } = await prompt({
      type: 'input',
      name: 'label',
      message: 'このリレーションの表示名:',
    });

    const relation = await askSingleRelation(config, domain, label, relationType);
    relations.push(relation);
    console.log('\nリレーションを追加しました:', relation, '\n');
  }

  return { relations };
}
