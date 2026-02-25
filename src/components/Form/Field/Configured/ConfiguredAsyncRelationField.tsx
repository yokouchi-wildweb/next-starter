// src/components/Form/Field/Configured/ConfiguredAsyncRelationField.tsx
// FieldConfig の asyncApiPath/asyncLabelField/asyncSearchFields を読み取り、
// 非同期検索コンポーネント（AsyncComboboxInput / AsyncMultiSelectInput）をレンダリングする。
// ConfiguredMediaField と同じパターンで FieldRenderer から呼び出される。

"use client";

import { useMemo, type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import type {
  Control,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import useSWR from "swr";

import { ControlledField } from "../Controlled";
import type { FieldConfig, FieldCommonProps } from "../types";
import type { Options } from "@/components/Form/types";
import {
  AsyncComboboxInput,
} from "@/components/Form/Input/Controlled/AsyncComboboxInput";
import {
  AsyncMultiSelectInput,
} from "@/components/Form/Input/Controlled/AsyncMultiSelectInput";
import { createApiClient } from "@/lib/crud";
import type { SearchParams, PaginatedResult } from "@/lib/crud/types";
import { getBlurMode } from "./inputResolver";

// ---- 内部型 ----

/** 汎用レコード型（id + 任意フィールド） */
type RelationRecord = Record<string, unknown> & { id: string };

// ---- Props ----

export type ConfiguredAsyncRelationFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = FieldCommonProps & {
  /** react-hook-form の control */
  control: Control<TFieldValues, any, TFieldValues>;
  /** フィールド設定 */
  fieldConfig: FieldConfig;
  /** フィールド名（省略時は fieldConfig.name） */
  name?: TName;
  /** ラベル（省略時は fieldConfig.label） */
  label?: ReactNode;
};

// ---- 内部フック ----

/**
 * FieldConfig のメタデータから API クライアントの search 関数を生成
 */
function useAsyncRelationClient(apiPath: string) {
  return useMemo(() => {
    const client = createApiClient<RelationRecord>(apiPath);
    const searchFn = (params: SearchParams): Promise<PaginatedResult<RelationRecord>> => {
      return client.search!(params);
    };
    return { searchFn, client };
  }, [apiPath]);
}

/**
 * レコードから Options を生成する関数を構築
 */
function useGetOptionFromResult(labelField: string) {
  return useMemo(
    () => (item: RelationRecord): Options => ({
      value: item.id,
      label: String(item[labelField] ?? item.id),
    }),
    [labelField],
  );
}

/**
 * asyncCombobox 用: 編集時の既存値IDからラベルを SWR で解決
 */
function useInitialOption(
  apiPath: string,
  currentValue: unknown,
  labelField: string,
  client: ReturnType<typeof createApiClient<RelationRecord>>,
) {
  const initialId = typeof currentValue === "string" && currentValue.length > 0
    ? currentValue
    : null;

  const { data } = useSWR(
    initialId ? ["asyncRelation:initial", apiPath, initialId] : null,
    async () => {
      const { results } = await client.search!({
        where: { field: "id", op: "eq", value: initialId },
        limit: 1,
      });
      if (results.length === 0) return undefined;
      return {
        value: results[0].id,
        label: String(results[0][labelField] ?? results[0].id),
      } satisfies Options;
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  return data;
}

/**
 * asyncMultiSelect 用: 編集時の既存ID配列からラベルを SWR で解決
 */
function useInitialOptions(
  apiPath: string,
  currentValue: unknown,
  labelField: string,
  client: ReturnType<typeof createApiClient<RelationRecord>>,
) {
  const initialIds = Array.isArray(currentValue) && currentValue.length > 0
    ? (currentValue as string[])
    : null;

  const { data } = useSWR(
    initialIds ? ["asyncRelation:initialMulti", apiPath, initialIds.join(",")] : null,
    async () => {
      const { results } = await client.search!({
        where: { field: "id", op: "in", value: initialIds },
        limit: initialIds!.length,
      });
      return results.map((item) => ({
        value: item.id,
        label: String(item[labelField] ?? item.id),
      } satisfies Options));
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  return data ?? [];
}

// ---- メインコンポーネント ----

/**
 * 非同期リレーションフィールドコンポーネント
 *
 * FieldConfig の asyncApiPath / asyncLabelField / asyncSearchFields を読み取り、
 * 内部で API クライアント生成・初期値解決・非同期検索コンポーネントのレンダリングを行う。
 */
export function ConfiguredAsyncRelationField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  fieldConfig,
  name,
  label,
  required,
  description,
  className,
  inputClassName,
  hideLabel = false,
  hideError = false,
  requiredMark,
  requiredMarkPosition,
  layout,
  labelClass,
}: ConfiguredAsyncRelationFieldProps<TFieldValues, TName>) {
  const resolvedName = (name ?? fieldConfig.name) as TName;
  const resolvedLabel = label ?? fieldConfig.label;
  const resolvedRequired = required ?? fieldConfig.required ?? false;
  const { formInput } = fieldConfig;

  const apiPath = fieldConfig.asyncApiPath ?? "";
  const labelField = fieldConfig.asyncLabelField ?? "name";
  const searchFields = fieldConfig.asyncSearchFields;

  // API クライアント
  const { searchFn, client } = useAsyncRelationClient(apiPath);

  // getOptionFromResult
  const getOptionFromResult = useGetOptionFromResult(labelField);

  // フォームの現在値を監視（初期値解決用）
  const currentValue = useWatch({ control, name: resolvedName });

  // 初期値解決（フック呼び出し順序を固定するため両方呼ぶ。SWR キーが null なら fetch しない）
  const initialOption = useInitialOption(apiPath, currentValue, labelField, client);
  const initialOptions = useInitialOptions(apiPath, currentValue, labelField, client);

  const blurMode = getBlurMode(fieldConfig);

  const commonFieldProps = {
    control,
    name: resolvedName,
    label: resolvedLabel,
    required: resolvedRequired,
    requiredMark,
    requiredMarkPosition,
    description,
    className,
    inputClassName,
    hideLabel,
    hideError,
    layout,
    labelClass,
    blurMode,
  } as const;

  if (formInput === "asyncCombobox") {
    return (
      <ControlledField
        {...commonFieldProps}
        renderInput={(field) => (
          <RelationAsyncCombobox
            field={field}
            searchFn={searchFn}
            getOptionFromResult={getOptionFromResult}
            searchFields={searchFields}
            initialOption={initialOption}
            clearable={!resolvedRequired}
            disabled={fieldConfig.disabled}
          />
        )}
      />
    );
  }

  // asyncMultiSelect
  return (
    <ControlledField
      {...commonFieldProps}
      renderInput={(field) => (
        <RelationAsyncMultiSelect
          field={field}
          searchFn={searchFn}
          getOptionFromResult={getOptionFromResult}
          searchFields={searchFields}
          initialOptions={initialOptions}
          disabled={fieldConfig.disabled}
        />
      )}
    />
  );
}

// ---- 内部レンダリングコンポーネント（型パラメータ固定用） ----

function RelationAsyncCombobox<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  searchFn,
  getOptionFromResult,
  searchFields,
  initialOption,
  clearable,
  disabled,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  searchFn: (params: SearchParams) => Promise<PaginatedResult<RelationRecord>>;
  getOptionFromResult: (item: RelationRecord) => Options;
  searchFields?: string[];
  initialOption?: Options;
  clearable?: boolean;
  disabled?: boolean;
}) {
  return (
    <AsyncComboboxInput<RelationRecord, TFieldValues, TName>
      field={field}
      searchFn={searchFn}
      getOptionFromResult={getOptionFromResult}
      searchFields={searchFields}
      initialOption={initialOption}
      clearable={clearable}
      disabled={disabled}
    />
  );
}

function RelationAsyncMultiSelect<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  searchFn,
  getOptionFromResult,
  searchFields,
  initialOptions,
  disabled,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  searchFn: (params: SearchParams) => Promise<PaginatedResult<RelationRecord>>;
  getOptionFromResult: (item: RelationRecord) => Options;
  searchFields?: string[];
  initialOptions: Options[];
  disabled?: boolean;
}) {
  return (
    <AsyncMultiSelectInput<RelationRecord, TFieldValues, TName>
      field={field}
      searchFn={searchFn}
      getOptionFromResult={getOptionFromResult}
      searchFields={searchFields}
      initialOptions={initialOptions}
      disabled={disabled}
    />
  );
}
