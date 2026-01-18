"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { ConfiguredField } from "@/components/Form/Field/ConfiguredField";
import { ConfiguredFieldGroup } from "@/components/Form/Field/ConfiguredFieldGroup";
import { ConfiguredMediaField } from "@/components/Form/Field/ConfiguredMediaField";
import { FieldGroup } from "./FieldGroup";
import type { DomainJsonField, DomainFieldGroup, DomainInlineGroup } from "./types";

export type DomainMediaState = {
  isUploading: boolean;
  commitAll: () => Promise<void>;
  resetAll: () => Promise<void>;
};

export type MediaHandleEntry = {
  isUploading: boolean;
  commit: (finalUrl?: string | null) => Promise<void>;
  reset: () => Promise<void>;
};

export type DomainFieldRendererProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  methods: UseFormReturn<TFieldValues>;
  /** ドメインJSONフィールド定義 */
  domainJsonFields?: DomainJsonField[];
  /**
   * カスタムフィールド定義（関連フィールドなど）
   * domainJsonFields の後に追加される
   */
  customFields?: DomainJsonField[];
  /** フィールドグループ定義（指定時はグループ化表示） */
  fieldGroups?: DomainFieldGroup[];
  /** インラインフィールドグループ定義（横並び表示） */
  inlineGroups?: DomainInlineGroup[];
  onMediaStateChange?: (state: DomainMediaState | null) => void;
  /** 全フィールドの前に挿入するUI */
  beforeAll?: ReactNode;
  /** 全フィールドの後に挿入するUI */
  afterAll?: ReactNode;
  /** 特定フィールドの前に挿入するUI（キー: フィールド名） */
  beforeField?: Partial<Record<FieldPath<TFieldValues>, ReactNode>>;
  /** 特定フィールドの後に挿入するUI（キー: フィールド名） */
  afterField?: Partial<Record<FieldPath<TFieldValues>, ReactNode>>;
};

export function DomainFieldRenderer<TFieldValues extends FieldValues>({
  control,
  methods,
  domainJsonFields = [],
  customFields = [],
  fieldGroups,
  inlineGroups,
  onMediaStateChange,
  beforeAll,
  afterAll,
  beforeField,
  afterField,
}: DomainFieldRendererProps<TFieldValues>) {
  // メディアアップロード状態管理
  const mediaEntriesRef = useRef<Map<string, MediaHandleEntry>>(new Map());
  const [mediaVersion, setMediaVersion] = useState(0);

  const handleMediaHandleChange = useCallback(
    (name: FieldPath<TFieldValues>, entry: MediaHandleEntry | null) => {
      const key = String(name);
      if (entry) {
        mediaEntriesRef.current.set(key, entry);
      } else {
        mediaEntriesRef.current.delete(key);
      }
      setMediaVersion((value) => value + 1);
    },
    [],
  );

  // ドメインフィールドとカスタムフィールドを統合
  const combinedFields = useMemo(() => {
    // domainFieldIndex を付与
    const indexedDomainFields = domainJsonFields.map((field, index) => ({
      ...field,
      domainFieldIndex: field.domainFieldIndex ?? index,
    }));

    // カスタムフィールドで上書きするフィールド名のセット
    const customFieldNames = new Set(customFields.map((f) => f.name));

    // ドメインフィールドからカスタムフィールドと同名のものを除外
    const filteredDomainFields = indexedDomainFields.filter(
      (field) => !customFieldNames.has(field.name)
    );

    // 統合（ドメインフィールド + カスタムフィールド）
    return [...filteredDomainFields, ...customFields];
  }, [domainJsonFields, customFields]);

  // フィールド名からconfigを取得するマップ
  const fieldConfigMap = useMemo(() => {
    const map = new Map<string, { config: DomainJsonField; index: number }>();
    combinedFields.forEach((config, index) => {
      map.set(config.name, { config, index });
    });
    return map;
  }, [combinedFields]);

  // インライングループに含まれるフィールド名のSet
  const inlineGroupFieldsSet = useMemo(() => {
    const set = new Set<string>();
    inlineGroups?.forEach((group) => {
      group.fields.forEach((fieldName) => set.add(fieldName));
    });
    return set;
  }, [inlineGroups]);

  // インライングループの先頭フィールド名 → グループ定義 のマップ
  const inlineGroupByFirstField = useMemo(() => {
    const map = new Map<string, DomainInlineGroup>();
    inlineGroups?.forEach((group) => {
      if (group.fields.length > 0) {
        map.set(group.fields[0], group);
      }
    });
    return map;
  }, [inlineGroups]);

  // 単一フィールドをレンダリングする関数
  const renderSingleField = useCallback(
    (fieldConfig: DomainJsonField, index: number) => {
      // none は何も表示しない
      if (fieldConfig.formInput === "none") {
        return null;
      }

      let fieldElement: ReactNode;

      if (fieldConfig.formInput === "mediaUploader") {
        // メディアアップローダーは専用コンポーネント
        fieldElement = (
          <ConfiguredMediaField
            key={fieldConfig.name}
            control={control}
            methods={methods}
            config={fieldConfig}
            onHandleChange={handleMediaHandleChange}
          />
        );
      } else {
        // 通常フィールドは ConfiguredField を使用
        fieldElement = (
          <ConfiguredField
            key={fieldConfig.name}
            control={control}
            fieldConfig={fieldConfig}
          />
        );
      }

      const fieldName = fieldConfig.name as FieldPath<TFieldValues>;
      const beforeContent = beforeField?.[fieldName];
      const afterContent = afterField?.[fieldName];

      return (
        <Fragment key={fieldConfig.name ?? index}>
          {beforeContent}
          {fieldElement}
          {afterContent}
        </Fragment>
      );
    },
    [control, methods, handleMediaHandleChange, beforeField, afterField],
  );

  // インライングループをレンダリングする関数
  const renderInlineGroup = useCallback(
    (group: DomainInlineGroup) => {
      const groupFieldConfigs = group.fields
        .map((fieldName) => fieldConfigMap.get(fieldName))
        .filter((entry): entry is NonNullable<typeof entry> => entry != null)
        .map(({ config }) => config);

      if (groupFieldConfigs.length === 0) return null;

      return (
        <ConfiguredFieldGroup
          key={group.key}
          control={control}
          fieldConfigs={groupFieldConfigs}
          label={group.label}
          fieldWidths={group.fieldWidths}
          required={group.required}
          description={group.description}
        />
      );
    },
    [control, fieldConfigMap],
  );

  // インライングループ対応でフィールドをレンダリング
  const renderFieldsWithInlineSupport = useCallback(
    (fieldEntries: { config: DomainJsonField; index: number }[]) => {
      const elements: ReactNode[] = [];
      const processedInlineGroups = new Set<string>();

      fieldEntries.forEach(({ config, index }) => {
        const fieldName = config.name;

        // インライングループに含まれるフィールドの場合
        if (inlineGroupFieldsSet.has(fieldName)) {
          // 先頭フィールドの場合のみインライングループをレンダリング
          const inlineGroup = inlineGroupByFirstField.get(fieldName);
          if (inlineGroup && !processedInlineGroups.has(inlineGroup.key)) {
            processedInlineGroups.add(inlineGroup.key);
            elements.push(renderInlineGroup(inlineGroup));
          }
          // 先頭以外のフィールドはスキップ
          return;
        }

        // 通常のフィールド
        elements.push(renderSingleField(config, index));
      });

      return elements;
    },
    [inlineGroupFieldsSet, inlineGroupByFirstField, renderInlineGroup, renderSingleField],
  );

  // グループ化されたフィールドのレンダリング
  const renderedGroupedFields = useMemo(() => {
    if (!fieldGroups || fieldGroups.length === 0) return null;

    // グループに含まれるフィールド名を収集
    const groupedFieldNames = new Set<string>();
    fieldGroups.forEach((group) => {
      group.fields.forEach((fieldName) => groupedFieldNames.add(fieldName));
    });

    // グループごとにレンダリング
    const groups = fieldGroups.map((group) => {
      const groupFields = group.fields
        .map((fieldName) => fieldConfigMap.get(fieldName))
        .filter((entry): entry is NonNullable<typeof entry> => entry != null);

      if (groupFields.length === 0) return null;

      return (
        <FieldGroup
          key={group.key}
          label={group.label}
          collapsible={group.collapsible}
          defaultCollapsed={group.defaultCollapsed}
          bgColor={group.bgColor}
        >
          {renderFieldsWithInlineSupport(groupFields)}
        </FieldGroup>
      );
    });

    // グループに含まれないフィールド（その他）
    const ungroupedFields = combinedFields
      .map((config, index) => ({ config, index }))
      .filter(({ config }) => !groupedFieldNames.has(config.name));

    return (
      <>
        {groups}
        {ungroupedFields.length > 0 && (
          <div className="flex flex-col gap-4">
            {renderFieldsWithInlineSupport(ungroupedFields)}
          </div>
        )}
      </>
    );
  }, [fieldGroups, fieldConfigMap, combinedFields, renderFieldsWithInlineSupport]);

  // フラット表示（インライングループ対応）
  const renderedFields = useMemo(() => {
    if (fieldGroups && fieldGroups.length > 0) return null;

    const elements: ReactNode[] = [];

    combinedFields.forEach((fieldConfig, index) => {
      const fieldName = fieldConfig.name;

      // インライングループに含まれるフィールドの場合
      if (inlineGroupFieldsSet.has(fieldName)) {
        // 先頭フィールドの場合のみインライングループをレンダリング
        const inlineGroup = inlineGroupByFirstField.get(fieldName);
        if (inlineGroup) {
          elements.push(renderInlineGroup(inlineGroup));
        }
        // 先頭以外のフィールドはスキップ（グループ内でレンダリング済み）
        return;
      }

      // 通常のフィールド
      elements.push(renderSingleField(fieldConfig, index));
    });

    return elements;
  }, [fieldGroups, combinedFields, renderSingleField, inlineGroupFieldsSet, inlineGroupByFirstField, renderInlineGroup]);

  // メディア状態の通知
  useEffect(() => {
    if (!onMediaStateChange) return;
    const entries = Array.from(mediaEntriesRef.current.values());
    if (entries.length === 0) {
      onMediaStateChange(null);
      return;
    }
    const isUploading = entries.some((entry) => entry.isUploading);
    onMediaStateChange({
      isUploading,
      commitAll: async () => {
        await Promise.all(entries.map((entry) => entry.commit()));
      },
      resetAll: async () => {
        await Promise.all(entries.map((entry) => entry.reset()));
      },
    });
  }, [onMediaStateChange, mediaVersion]);

  return (
    <>
      {beforeAll}
      {fieldGroups && fieldGroups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {renderedGroupedFields}
        </div>
      ) : (
        renderedFields
      )}
      {afterAll}
    </>
  );
}
