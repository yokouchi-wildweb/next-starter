// 検査: 主と従属の組（主の集まりの項目 mediaCollection → 従属ドメイン）の書く前の検査。domain.json だけを読む。
// 1 組の誤りを全件返す（止めるのは呼び出し側。全組の誤りを集めてから、何も書く前に throw する）。知らせるだけのものは notices。
// 道具は人の domain.json を書き換えない: 誤りの文は直す場所（どの domain.json のどのキー）を言う。
// 「所有する主が 2 つ以上」「従属の名前が無い」は組を解く段（pipeline/pairs.mjs）が見る

import { domainTableName, buildShortFkName, isFkNameTooLong, PG_MAX_IDENTIFIER_LENGTH } from "../domain/names.mjs";
import { belongsToRelations, getOnDeleteBehavior } from "../domain/relations.mjs";
import { parentRule } from "../render/collections/childDomainConfig.mjs";
import { resolveOperationRule, unionUploadRules } from "../render/registry/storagePurpose/rules.mjs";
import { toCamelCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";
import { describeRule, isBroader, isNarrower } from "./accessRules.mjs";

/** 主の集まりの項目に書いてはいけないファイルの条件（従属の file の項目に書く） */
const FILE_CONDITION_KEYS = ["slug", "accept", "mediaTypePreset", "validationRule", "storage"];

const sameDomain = (a, b) => toCamelCase(toSnakeCase(a ?? "")) === toCamelCase(toSnakeCase(b ?? ""));

/** 従属の項目の名前が、プロパティ名・DB 名のどちらで書かれていても同じ列か */
const sameColumn = (a, b) => toSnakeCase(a ?? "") === toSnakeCase(b ?? "");

/** 従属のメディア項目の実際の権限（storage の明示値、無ければ従属の汎用 API から。ファイル用途の生成と同じ導出） */
function childEffectiveRules(childConfig, mediaField) {
  const storage = mediaField?.storage ?? {};
  const apiAccess = childConfig.apiAccess ?? null;
  const upload = storage.upload ?? unionUploadRules([resolveOperationRule(apiAccess, "create"), resolveOperationRule(apiAccess, "update")]);
  const read = storage.read ?? resolveOperationRule(apiAccess, "get");
  const visibility = storage.visibility ?? (read === "public" ? "public" : "private");
  return { upload, read, visibility };
}

/**
 * @param {object} params
 * @param {string} params.owner 主のフォルダ名
 * @param {object} params.ownerConfig 主の domain.json
 * @param {object} params.field 主の集まりの項目
 * @param {string} params.child 従属のフォルダ名
 * @param {object} params.childConfig 従属の domain.json（この実行で書き出すなら書き出す中身）
 * @param {Map<string, object>} params.domains 全ドメインのフォルダ名 → domain.json（名前の衝突を見る）
 * @param {Map<string, string>} params.roleCategories ロール ID → カテゴリ
 * @returns {{ errors: string[], notices: string[] }}
 */
export function pairIssues({ owner, ownerConfig, field, child, childConfig, domains, roleCategories }) {
  const errors = [];
  const notices = [];
  const ownerAt = `${owner}/domain.json の集まりの項目 "${field.name}"`;
  const childAt = `${child}/domain.json`;
  const fields = childConfig.fields ?? [];

  // a. ファイルの条件は従属に書く
  const misplaced = FILE_CONDITION_KEYS.filter((key) => field[key] !== undefined);
  if (misplaced.length) errors.push(`${ownerAt}: ファイルの条件（${misplaced.join(", ")}）は主に書けません。${childAt} の file の項目に書いてください`);

  // b. 主への belongsTo が 1 本だけ、必須、CASCADE
  const toOwner = belongsToRelations(childConfig).filter((relation) => sameDomain(relation.domain, ownerConfig.singular ?? owner));
  if (toOwner.length !== 1) {
    errors.push(`${childAt}: 主（${owner}）への belongsTo がちょうど 1 本必要です（今 ${toOwner.length} 本）`);
  } else if (toOwner[0].required !== true || getOnDeleteBehavior(toOwner[0]) !== "CASCADE") {
    errors.push(`${childAt}: 主（${owner}）への belongsTo は required: true と onDelete: "CASCADE" にしてください`);
  }
  const fkColumn = toOwner[0]?.fieldName;

  // d. 論理削除の従属は扱わない
  if (childConfig.useSoftDelete === true) errors.push(`${childAt}: useSoftDelete は false にしてください（論理削除の従属は扱いません）`);

  // e. メディア項目はちょうど 1 つ（複数・集まりは持たない）
  const media = fields.filter((f) => f.fieldType === "mediaUploader");
  const multi = fields.filter((f) => f.fieldType === "mediaUploaderMulti" || f.fieldType === "mediaCollection");
  if (media.length !== 1 || multi.length) {
    errors.push(`${childAt}: メディア項目（mediaUploader）はちょうど 1 つで、mediaUploaderMulti / mediaCollection は持てません（今 mediaUploader ${media.length} / 複数・集まり ${multi.length}）`);
  }

  // f. 並び列（集まりの並びを持つ列。lib の sortColumn は必須なので reorderable に関わらず要る。reorderable は画面のドラッグだけ）
  const sortField = childConfig.sortOrderField;
  if (!sortField) errors.push(`${childAt}: 並び列 sortOrderField を宣言してください（集まりの並びを持つ列。主の項目が reorderable: false でも要ります）`);
  else {
    if (!fields.some((f) => sameColumn(f.name, sortField))) errors.push(`${childAt}: sortOrderField "${sortField}" の項目が fields にありません`);
    if (!(childConfig.systemColumns ?? []).some((column) => sameColumn(column, sortField))) {
      errors.push(`${childAt}: sortOrderField "${sortField}" を systemColumns に入れてください（並びは systemUpdate で書きます）`);
    }
  }

  // g. 主のフォームからは埋められない必須の項目（主への参照・メディア・並び以外で、既定値の無いもの）
  const filled = new Set([fkColumn, media[0]?.name, sortField].filter(Boolean).map((name) => toSnakeCase(name)));
  for (const f of fields) {
    if (f.required === true && f.defaultValue === undefined && !filled.has(toSnakeCase(f.name))) {
      errors.push(`${childAt}: 必須の項目 "${f.name}" は主の画面から埋められません。required を外すか defaultValue を書いてください`);
    }
  }

  // h. 権限の食い違い（主の規則が写せない形なら見ない）
  if (media.length === 1) {
    const effective = childEffectiveRules(childConfig, media[0]);
    const create = parentRule(ownerConfig, "create");
    const update = parentRule(ownerConfig, "update");
    if (create !== null && update !== null) {
      const ownerUpload = unionUploadRules([create, update]);
      if (isNarrower(effective.upload, ownerUpload, roleCategories)) {
        errors.push(`${childAt}: file の storage.upload ${describeRule(effective.upload)} が主の create・update ${describeRule(ownerUpload)} より狭く、主のフォームからアップロードできない人がいます`);
      } else if (isBroader(effective.upload, ownerUpload, roleCategories)) {
        notices.push(`${childAt}: file の storage.upload ${describeRule(effective.upload)} は主の create・update ${describeRule(ownerUpload)} より広い（主を書けない人もファイルを置けます）`);
      }
    }
    const ownerGet = parentRule(ownerConfig, "get");
    if (ownerGet !== null && effective.visibility !== "public" && isNarrower(effective.read, ownerGet, roleCategories)) {
      errors.push(`${childAt}: file の storage.read ${describeRule(effective.read)} が主の get ${describeRule(ownerGet)} より狭く、主を読める人がファイルを読めません`);
    }
  }

  // i. 63 字（表名・主への FK 名。FK は長ければ短い名前になるので、短い名前も超えるときだけ）
  const childTable = domainTableName(child, childConfig);
  if (childTable.length > PG_MAX_IDENTIFIER_LENGTH) errors.push(`${childAt}: 表名 "${childTable}" が ${PG_MAX_IDENTIFIER_LENGTH} 字を超えます（plural を短くしてください）`);
  if (fkColumn) {
    const ownerTable = domainTableName(owner, ownerConfig);
    const columnName = toSnakeCase(fkColumn);
    if (isFkNameTooLong(childTable, columnName, ownerTable) && buildShortFkName(childTable, columnName).length > PG_MAX_IDENTIFIER_LENGTH) {
      errors.push(`${childAt}: 主への FK 名 "${buildShortFkName(childTable, columnName)}" が ${PG_MAX_IDENTIFIER_LENGTH} 字を超えます（表名か fieldName を短くしてください）`);
    }
  }

  // j. 名前の衝突（組の外のドメインと従属・主の項目名どうし）
  for (const [other, config] of domains) {
    if (other === child || !config) continue;
    if (sameDomain(config.singular, childConfig.singular)) errors.push(`${childAt}: singular "${childConfig.singular}" が ${other}/domain.json と重なります`);
    else if (domainTableName(other, config) === childTable) errors.push(`${childAt}: 表名 "${childTable}" が ${other}/domain.json の表と重なります`);
  }
  const ownerNames = [
    ...(ownerConfig.fields ?? []).filter((f) => f !== field).map((f) => f.name),
    ...(ownerConfig.relations ?? []).map((relation) => relation.fieldName).filter(Boolean),
  ];
  if (ownerNames.some((name) => sameColumn(name, field.name))) errors.push(`${ownerAt}: 項目名が主の他の項目・関係の fieldName と重なります`);

  // k. 必須 × 複製で写さない（複製した主が必ず下限を割る）
  if (field.required === true && field.collection?.duplicate === false) {
    errors.push(`${ownerAt}: required の集まりに collection.duplicate: false は書けません（複製すると空になります）`);
  }

  // l. 従属の汎用 API が開いている（知らせるだけ。主の画面から使う従属は閉じるのが既定）
  const access = childConfig.apiAccess;
  const open = !access || [access.read, access.write, ...Object.values(access.operations ?? {})].some((rule) => rule !== undefined && rule !== "none");
  if (open || access.read === undefined || access.write === undefined) {
    notices.push(`${childAt}: 汎用 API（apiAccess）が開いています。主の画面から使う従属は { "read": "none", "write": "none" } が既定です`);
  }

  return { errors, notices };
}
