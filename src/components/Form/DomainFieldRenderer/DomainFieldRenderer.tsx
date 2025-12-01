"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Control, ControllerRenderProps, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput, NumberInput, Textarea } from "@/components/Form/Controlled";
import { SelectInput } from "@/components/Form/Manual";
import { CheckGroupInput } from "@/components/Form/Manual";
import { MultiSelectInput } from "@/components/Form/Manual";
import StepperInput from "@/components/Form/Manual/StepperInput";
import { BooleanRadioGroupInput } from "@/components/Form/Manual";
import { SwitchInput } from "@/components/Form/Controlled";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/_shadcn/form";
import type { Options } from "@/types/form";

import { buildFieldConfigsFromDomainJson, type DomainJsonField } from "./fieldMapper";
import type {
  DomainFieldRenderConfig,
  TextFieldConfig,
  NumberFieldConfig,
  TextareaFieldConfig,
  SelectFieldConfig,
  CheckGroupFieldConfig,
  MultiSelectFieldConfig,
  RadioBooleanFieldConfig,
  StepperFieldConfig,
  SwitchFieldConfig,
  MediaUploaderFieldConfig,
  HiddenFieldConfig,
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
  onMediaStateChange?: (state: DomainMediaState | null) => void;
};

export function DomainFieldRenderer<TFieldValues extends FieldValues>({
  control,
  methods,
  fields = [],
  domainJsonFields = [],
  onMediaStateChange,
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
          options={fieldConfig.options}
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

  const renderRadioBooleanField = (
    fieldConfig: RadioBooleanFieldConfig<TFieldValues, FieldPath<TFieldValues>>
  ) => (
    <FormFieldItem
      key={fieldConfig.name}
      control={control}
      name={fieldConfig.name}
      label={fieldConfig.label}
      description={fieldConfig.description}
      renderInput={(field) => (
        <BooleanRadioGroupInput
          field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
          options={fieldConfig.options}
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

  const renderedFields = combinedFields.map((fieldConfig, index) => {
    switch (fieldConfig.type) {
      case "text":
        return renderTextField(fieldConfig);
      case "number":
        return renderNumberField(fieldConfig);
      case "textarea":
        return renderTextareaField(fieldConfig);
      case "select":
        return renderSelectField(fieldConfig);
      case "checkGroup":
        return renderCheckGroupField(fieldConfig);
      case "multiSelect":
        return renderMultiSelectField(fieldConfig);
      case "radioBoolean":
        return renderRadioBooleanField(fieldConfig);
      case "stepper":
        return renderStepperField(fieldConfig);
      case "switch":
        return renderSwitchField(fieldConfig);
      case "mediaUploader":
        return (
          <MediaFieldItem
            key={fieldConfig.name}
            control={control}
            methods={methods}
            config={fieldConfig}
            onHandleChange={handleMediaHandleChange}
          />
        );
      case "hidden":
        return renderHiddenField(fieldConfig);
      default:
        return <Fragment key={index} />;
    }
  });

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

  return <>{renderedFields}</>;
}
