// src/lib/domain/types/domainConfig.ts
// server で読む entity.json の形（lib が読む項目）。生成物の具体の型は src/registry/domainConfigRegistry.ts

import type { DomainConfigOptionals } from "./domainConfigOptionals";
import type { DomainField } from "./domainField";

/** entity.json の関連 1 つ(キーの正は生成器の語彙 RELATION_KEYS。client の写し DomainDisplayRelation もここから作る) */
export type DomainConfigRelation = {
  domain: string;
  label: string;
  fieldName: string;
  fieldType?: string;
  relationType: string;
  required?: boolean;
  /** 削除時の挙動(belongsTo のみ。RESTRICT | CASCADE | SET_NULL) */
  onDelete?: string;
  formInput?: string;
  labelField?: string;
  includeRelationTable?: boolean;
};

export type DomainConfig = DomainConfigOptionals & {
  singular: string;
  plural?: string;
  label: string;
  useCreatedAt?: boolean;
  useUpdatedAt?: boolean;
  /** 項目 = entity.json の項目そのもの(DomainField) */
  fields: readonly DomainField[];
  relations?: readonly DomainConfigRelation[];
};
