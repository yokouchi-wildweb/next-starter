"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import {
  ConfiguredField,
  ConfiguredFieldGroup,
  ConfiguredMediaField,
  type FieldConfig,
} from "@/components/Form/Field";
import { useAppFormMedia } from "@/components/Form/AppForm";
import { FieldGroupSection } from "./FieldGroupSection";
import type { FieldGroup, InlineFieldGroup, MediaState, MediaHandleEntry, InsertFieldsMap } from "./types";

// 型を re-export（後方互換性のため）
export type { MediaState, MediaHandleEntry } from "./types";

export type FieldRendererProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  methods: UseFormReturn<TFieldValues>;

  /** ベースとなるフィールド定義 */
  baseFields?: FieldConfig[];

  /**
   * フィールドのパッチ（部分的に上書き・追加）
   * - 同名フィールド: 位置を維持してベースフィールドにマージ
   * - 新規フィールド: 末尾に追加
   */
  fieldPatches?: Partial<FieldConfig>[];

  /**
   * フィールド挿入（指定フィールドの前に追加）
   * - キー: 挿入先フィールド名 または "__first__"（先頭に挿入）
   * - 値: 挿入するフィールド設定の配列
   */
  insertBefore?: InsertFieldsMap;

  /**
   * フィールド挿入（指定フィールドの後に追加）
   * - キー: 挿入先フィールド名 または "__last__"（末尾に挿入）
   * - 値: 挿入するフィールド設定の配列
   */
  insertAfter?: InsertFieldsMap;

  /** フィールドグループ定義（セクション分け） */
  fieldGroups?: FieldGroup[];

  /** インラインフィールドグループ定義（横並び表示） */
  inlineGroups?: InlineFieldGroup[];

  /** メディアアップロード状態の変更通知 */
  onMediaStateChange?: (state: MediaState | null) => void;

  /** 全フィールドの前に挿入するUI */
  beforeAll?: ReactNode;

  /** 全フィールドの後に挿入するUI */
  afterAll?: ReactNode;

  /** 特定フィールドの前に挿入するUI（キー: フィールド名） */
  beforeField?: Partial<Record<FieldPath<TFieldValues>, ReactNode>>;

  /** 特定フィールドの後に挿入するUI（キー: フィールド名） */
  afterField?: Partial<Record<FieldPath<TFieldValues>, ReactNode>>;
};

export function FieldRenderer<TFieldValues extends FieldValues>({
  control,
  methods,
  baseFields = [],
  fieldPatches = [],
  insertBefore = {},
  insertAfter = {},
  fieldGroups,
  inlineGroups,
  onMediaStateChange,
  beforeAll,
  afterAll,
  beforeField,
  afterField,
}: FieldRendererProps<TFieldValues>) {
  // AppFormのContextを取得（存在する場合）
  const appFormMedia = useAppFormMedia();

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

  // baseFields, fieldPatches, insertBefore, insertAfter を統合
  // 処理順序:
  // 1. insertBefore["__first__"] を先頭に配置
  // 2. baseFields を処理（fieldPatches で部分的に上書き・マージ）
  // 3. 各フィールドの前後に insertBefore/insertAfter で指定されたフィールドを挿入
  //    （挿入されたフィールドに対しても再帰的に insertBefore/insertAfter を適用）
  // 4. fieldPatches の新規フィールドを末尾に追加
  // 5. insertAfter["__last__"] を最後に配置
  const combinedFields = useMemo(() => {
    const patchMap = new Map(
      fieldPatches.filter((f) => f.name).map((f) => [f.name, f])
    );

    // フィールドにパッチを適用するヘルパー関数
    const applyPatch = (field: FieldConfig): FieldConfig => {
      const patch = patchMap.get(field.name);
      if (patch) {
        patchMap.delete(field.name); // 使用済み
        return { ...field, ...patch } as FieldConfig;
      }
      return field;
    };

    // 使用済みの insertBefore/insertAfter キーを追跡（無限ループ防止）
    const usedInsertKeys = new Set<string>();

    /**
     * フィールドとその前後挿入を再帰的に処理するヘルパー関数
     * これにより、insertBefore.__first__ で挿入されたリレーションフィールドなどに対しても
     * insertBefore/insertAfter でフィールドを挟み込める
     * @param field パッチ適用済みのフィールド
     * @param output 結果を格納する配列
     */
    const processFieldWithInserts = (field: FieldConfig, output: FieldConfig[]) => {
      const fieldName = field.name;

      // このフィールドの前に挿入（未処理の場合のみ）
      const beforeKey = `before:${fieldName}`;
      if (!usedInsertKeys.has(beforeKey)) {
        usedInsertKeys.add(beforeKey);
        const beforeFields = insertBefore[fieldName];
        if (beforeFields) {
          beforeFields.forEach((bf) => processFieldWithInserts(applyPatch(bf), output));
        }
      }

      // フィールド本体
      output.push(field);

      // このフィールドの後に挿入（未処理の場合のみ）
      const afterKey = `after:${fieldName}`;
      if (!usedInsertKeys.has(afterKey)) {
        usedInsertKeys.add(afterKey);
        const afterFields = insertAfter[fieldName];
        if (afterFields) {
          afterFields.forEach((af) => processFieldWithInserts(applyPatch(af), output));
        }
      }
    };

    const result: FieldConfig[] = [];

    // 1. 先頭に挿入（insertBefore["__first__"]）
    const firstFields = insertBefore["__first__"] ?? [];
    firstFields.forEach((f) => processFieldWithInserts(applyPatch(f), result));

    // 2. baseFields を処理
    baseFields.forEach((f) => processFieldWithInserts(applyPatch(f), result));

    // 3. 残り（新規追加分）を末尾に追加
    // 注: 新規フィールドの場合は完全なFieldConfig定義が必要
    const remainingPatches = Array.from(patchMap.values()) as FieldConfig[];
    result.push(...remainingPatches);

    // 4. 末尾に挿入（insertAfter["__last__"]）
    const lastFields = insertAfter["__last__"] ?? [];
    lastFields.forEach((f) => processFieldWithInserts(applyPatch(f), result));

    return result;
  }, [baseFields, fieldPatches, insertBefore, insertAfter]);

  // フィールド名からconfigを取得するマップ
  const fieldConfigMap = useMemo(() => {
    const map = new Map<string, { config: FieldConfig; index: number }>();
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
    const map = new Map<string, InlineFieldGroup>();
    inlineGroups?.forEach((group) => {
      if (group.fields.length > 0) {
        map.set(group.fields[0], group);
      }
    });
    return map;
  }, [inlineGroups]);

  // 単一フィールドをレンダリングする関数
  const renderSingleField = useCallback(
    (fieldConfig: FieldConfig, index: number) => {
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
            fieldConfig={fieldConfig}
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
    (group: InlineFieldGroup) => {
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
    (fieldEntries: { config: FieldConfig; index: number }[]) => {
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
        <FieldGroupSection
          key={group.key}
          label={group.label}
          collapsible={group.collapsible}
          defaultCollapsed={group.defaultCollapsed}
          bgColor={group.bgColor}
        >
          {renderFieldsWithInlineSupport(groupFields)}
        </FieldGroupSection>
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
  // AppFormのContextが存在する場合は、それを優先して使用
  const effectiveOnMediaStateChange = onMediaStateChange ?? appFormMedia?.setMediaState;

  useEffect(() => {
    if (!effectiveOnMediaStateChange) return;
    const entries = Array.from(mediaEntriesRef.current.values());
    if (entries.length === 0) {
      effectiveOnMediaStateChange(null);
      return;
    }
    const isUploading = entries.some((entry) => entry.isUploading);
    effectiveOnMediaStateChange({
      isUploading,
      commitAll: async () => {
        await Promise.all(entries.map((entry) => entry.commit()));
      },
      resetAll: async () => {
        await Promise.all(entries.map((entry) => entry.reset()));
      },
    });
  }, [effectiveOnMediaStateChange, mediaVersion]);

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
