// src/lib/domain/types/display.ts
// client に出すドメイン設定の写しの型(<domain>/entities/display.ts)。
// domain.json のある domain は pnpm generate registry が書く。無い手書きの domain は同じ形を手で書く。
// 秘密・内部の項目(apiAccess・dbEngine・generateFiles・storage 等)は持たない。

import type { DomainField } from "./domainField";

/** client に出す項目 = domain.json の項目(DomainField)のうち client で使うキーだけ(storage・unique・collection などは出さない)。
 * 手書きの写しは fieldType を省ける */
export type DomainDisplayField = Pick<
  DomainField,
  | "name"
  | "label"
  | "formInput"
  | "options"
  | "required"
  | "readonly"
  | "defaultValue"
  | "displayType"
  | "placeholder"
  | "accept"
  | "validationRule"
  | "reorderable"
  | "helperText"
> & { fieldType?: DomainField["fieldType"] };

export type DomainDisplayFieldGroup = {
  key: string;
  label: string;
  /** グループに含む列名 */
  fields: readonly string[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  bgColor?: string;
};

export type DomainDisplayRelation = {
  domain: string;
  label: string;
  fieldName: string;
  fieldType?: string;
  relationType: string;
  required?: boolean;
  formInput?: string;
  /** 関連先の表示に使う列 */
  labelField?: string;
  includeRelationTable?: boolean;
  /** 非同期検索の関連だけ: 関連先の searchFields */
  searchFields?: readonly string[];
};

export type DomainDisplay = {
  singular: string;
  plural: string;
  label: string;
  fields: readonly DomainDisplayField[];
  relations: readonly DomainDisplayRelation[];
  searchFields: readonly string[];
  useCreatedAt: boolean;
  useUpdatedAt: boolean;
  useSoftDelete: boolean;
  useImportExport?: boolean;
  sortOrderField?: string;
  fieldGroups?: readonly DomainDisplayFieldGroup[];
  tableFields?: readonly string[];
};
