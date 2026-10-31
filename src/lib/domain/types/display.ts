// src/lib/domain/types/display.ts
// client に出すドメイン設定の写しの型(<domain>/entities/display.ts)。
// domain.json のある domain は pnpm registry:generate が書く。無い手書きの domain は同じ形を手で書く。
// 秘密・内部の項目(apiAccess・dbEngine・generateFiles・storage 等)は持たない。

export type DomainDisplayField = {
  name: string;
  label: string;
  fieldType?: string;
  formInput?: string;
  options?: readonly { readonly value: unknown; readonly label?: string }[];
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
};
