"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Control, ControllerRenderProps, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { FormFieldItem } from "@/components/Form/FormFieldItem";
import {
  DateInput,
  DatetimeInput,
  EmailInput,
  NumberInput,
  PasswordInput,
  TextInput,
  Textarea,
  TimeInput,
} from "@/components/Form/Controlled";
import { SelectInput } from "@/components/Form/Manual";
import { CheckGroupInput } from "@/components/Form/Manual";
import { MultiSelectInput } from "@/components/Form/Manual";
import StepperInput from "@/components/Form/Manual/StepperInput";
import { RadioGroupInput } from "@/components/Form/Manual";
import { SwitchInput } from "@/components/Form/Controlled";
import { BooleanCheckboxInput } from "@/components/Form/Manual/BooleanCheckboxInput";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/_shadcn/form";

import { buildFieldConfigsFromDomainJson, type DomainJsonField } from "./fieldMapper";
import { FieldGroup } from "./FieldGroup";
import type { DomainFieldGroup } from "./types";
import type {
  DomainFieldRenderConfig,
  TextFieldConfig,
  NumberFieldConfig,
  TextareaFieldConfig,
  SelectFieldConfig,
  CheckGroupFieldConfig,
  MultiSelectFieldConfig,
  RadioFieldConfig,
  StepperFieldConfig,
  SwitchFieldConfig,
  MediaUploaderFieldConfig,
  HiddenFieldConfig,
  DateFieldConfig,
  TimeFieldConfig,
  DatetimeFieldConfig,
  EmailFieldConfig,
  PasswordFieldConfig,
  BooleanCheckboxFieldConfig,
} from "./fieldTypes";
import { MediaFieldItem } from "./MediaFieldItem";

export type DomainMediaState = {
  isUploading: boolean;
  commitAll: () => Promise<void>;
  resetAll: () => Promise<void>;
};

export type DomainFieldRendererProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  methods: UseFormReturn<TFieldValues>;
  fields?: DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[];
  domainJsonFields?: DomainJsonField[];
  /** フィールドグループ定義（指定時はグループ化表示） */
  fieldGroups?: DomainFieldGroup[];
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
  fields = [],
  domainJsonFields = [],
  fieldGroups,
  onMediaStateChange,
  beforeAll,
  afterAll,
  beforeField,
  afterField,
}: DomainFieldRendererProps<TFieldValues>) {
  const mediaEntriesRef = useRef<
    Map<
      string,
      {
        isUploading: boolean;
        commit: (finalUrl?: string | null) => Promise<void>;
        reset: () => Promise<void>;
      }
    >
  >(new Map());
  const [mediaVersion, setMediaVersion] = useState(0);

  const handleMediaHandleChange = useCallback(
    (
      name: FieldPath<TFieldValues>,
      entry:
        | {
            isUploading: boolean;
            commit: (finalUrl?: string | null) => Promise<void>;
            reset: () => Promise<void>;
          }
        | null,
    ) => {
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

  const renderTextField = (
    fieldConfig: TextFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => <TextInput field={field} readOnly={fieldConfig.readOnly} />}
    />
  );

  const renderNumberField = (
    fieldConfig: NumberFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => <NumberInput field={field} readOnly={fieldConfig.readOnly} />}
    />
  );

  const renderTextareaField = (
    fieldConfig: TextareaFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => (
        <Textarea
          field={field}
          placeholder={fieldConfig.placeholder}
          readOnly={fieldConfig.readOnly}
        />
      )}
    />
  );

  const renderSelectField = (
    fieldConfig: SelectFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => <SelectInput field={field} options={fieldConfig.options} />}
    />
  );

  const renderCheckGroupField = (
    fieldConfig: CheckGroupFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => (
        <CheckGroupInput
          field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
          options={fieldConfig.options ?? []}
          displayType={fieldConfig.displayType ?? "standard"}
        />
      )}
    />
  );

  const renderMultiSelectField = (
    fieldConfig: MultiSelectFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => (
        <MultiSelectInput
          field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
          options={fieldConfig.options}
          placeholder={fieldConfig.placeholder}
        />
      )}
    />
  );

  const renderRadioField = (
    fieldConfig: RadioFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => (
        <RadioGroupInput
          field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
          options={fieldConfig.options ?? []}
          displayType={fieldConfig.displayType ?? "standard"}
        />
      )}
    />
  );

  const renderStepperField = (
    fieldConfig: StepperFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormField
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <div className="flex w-full flex-col gap-2 rounded border border-muted p-3">
              <span className="text-sm font-medium text-muted-foreground">{fieldConfig.label}</span>
              <StepperInput
                value={typeof field.value === "number" ? field.value : Number(field.value ?? 0)}
                className="w-fit"
                onValueChange={(value) => field.onChange(value)}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const renderSwitchField = (
    fieldConfig: SwitchFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormField
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <SwitchInput field={field} label={fieldConfig.switchLabel ?? fieldConfig.label} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const renderHiddenField = (
    fieldConfig: HiddenFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormField
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      render={({ field }) => <input type="hidden" {...field} />}
    />
  );

  const renderDateField = (
    fieldConfig: DateFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => <DateInput field={field} readOnly={fieldConfig.readOnly} />}
    />
  );

  const renderTimeField = (
    fieldConfig: TimeFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => <TimeInput field={field} readOnly={fieldConfig.readOnly} />}
    />
  );

  const renderDatetimeField = (
    fieldConfig: DatetimeFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => <DatetimeInput field={field} readOnly={fieldConfig.readOnly} />}
    />
  );

  const renderEmailField = (
    fieldConfig: EmailFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => <EmailInput field={field} readOnly={fieldConfig.readOnly} />}
    />
  );

  const renderPasswordField = (
    fieldConfig: PasswordFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => <PasswordInput field={field} readOnly={fieldConfig.readOnly} />}
    />
  );

  const renderBooleanCheckboxField = (
    fieldConfig: BooleanCheckboxFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormField
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <BooleanCheckboxInput
              field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
              label={fieldConfig.label}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const combinedFields = useMemo(() => {
    const jsonFields = buildFieldConfigsFromDomainJson<TFieldValues>(domainJsonFields);
    const standaloneFields: DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[] = [];
    const overrideFields = new Map<
      number,
      DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>
    >();

    fields.forEach((field) => {
      if (typeof field.domainFieldIndex === "number") {
        overrideFields.set(field.domainFieldIndex, field);
      } else {
        standaloneFields.push(field);
      }
    });

    const domainFieldMap = new Map<
      number,
      DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>
    >();
    jsonFields.forEach((config, index) => {
      const domainFieldIndex = typeof config.domainFieldIndex === "number" ? config.domainFieldIndex : index;
      domainFieldMap.set(domainFieldIndex, { ...config, domainFieldIndex });
    });

    const sortedIndexes = Array.from(
      new Set([...domainFieldMap.keys(), ...overrideFields.keys()]),
    ).sort((a, b) => a - b);

    const orderedDomainFields = sortedIndexes
      .map((domainIndex) => overrideFields.get(domainIndex) ?? domainFieldMap.get(domainIndex))
      .filter(
        (
          config,
        ): config is DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>> => Boolean(config),
      );

    return [...standaloneFields, ...orderedDomainFields];
  }, [domainJsonFields, fields]);

  // 単一フィールドをレンダリングする関数
  const renderSingleField = useCallback(
    (fieldConfig: DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>, index: number) => {
      let fieldElement: React.ReactNode;
      switch (fieldConfig.type) {
        case "text":
          fieldElement = renderTextField(fieldConfig);
          break;
        case "number":
          fieldElement = renderNumberField(fieldConfig);
          break;
        case "textarea":
          fieldElement = renderTextareaField(fieldConfig);
          break;
        case "select":
          fieldElement = renderSelectField(fieldConfig);
          break;
        case "checkGroup":
          fieldElement = renderCheckGroupField(fieldConfig);
          break;
        case "multiSelect":
          fieldElement = renderMultiSelectField(fieldConfig);
          break;
        case "radio":
          fieldElement = renderRadioField(fieldConfig);
          break;
        case "stepper":
          fieldElement = renderStepperField(fieldConfig);
          break;
        case "switch":
          fieldElement = renderSwitchField(fieldConfig);
          break;
        case "mediaUploader":
          fieldElement = (
            <MediaFieldItem
              key={fieldConfig.name}
              control={control}
              methods={methods}
              config={fieldConfig}
              onHandleChange={handleMediaHandleChange}
            />
          );
          break;
        case "hidden":
          fieldElement = renderHiddenField(fieldConfig);
          break;
        case "date":
          fieldElement = renderDateField(fieldConfig);
          break;
        case "time":
          fieldElement = renderTimeField(fieldConfig);
          break;
        case "datetime":
          fieldElement = renderDatetimeField(fieldConfig);
          break;
        case "email":
          fieldElement = renderEmailField(fieldConfig);
          break;
        case "password":
          fieldElement = renderPasswordField(fieldConfig);
          break;
        case "booleanCheckbox":
          fieldElement = renderBooleanCheckboxField(fieldConfig);
          break;
        default:
          fieldElement = null;
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

  // フィールド名からconfigを取得するマップ
  const fieldConfigMap = useMemo(() => {
    const map = new Map<string, { config: DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>; index: number }>();
    combinedFields.forEach((config, index) => {
      map.set(config.name, { config, index });
    });
    return map;
  }, [combinedFields]);

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
          {groupFields.map(({ config, index }) => renderSingleField(config, index))}
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
            {ungroupedFields.map(({ config, index }) => renderSingleField(config, index))}
          </div>
        )}
      </>
    );
  }, [fieldGroups, fieldConfigMap, combinedFields, renderSingleField]);

  // フラット表示（従来通り）
  const renderedFields = useMemo(() => {
    if (fieldGroups && fieldGroups.length > 0) return null;
    return combinedFields.map((fieldConfig, index) => renderSingleField(fieldConfig, index));
  }, [fieldGroups, combinedFields, renderSingleField]);

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
