// src/lib/domain/types/domainConfig.ts
// server で読む domain.json の形（lib が読む項目）。生成物の具体の型は src/registry/domainConfigRegistry.ts

import type { DomainConfigOptionals } from "./domainConfigOptionals";

export type DomainConfigField = {
  name: string;
  label: string;
  fieldType: string;
  formInput?: string;
  options?: readonly { readonly value: unknown; readonly label?: string }[];
};

export type DomainConfigRelation = {
  domain: string;
  label: string;
  fieldName: string;
  fieldType?: string;
  relationType: string;
  required?: boolean;
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
  fields: readonly DomainConfigField[];
  relations?: readonly DomainConfigRelation[];
};
