#!/usr/bin/env node
/**
 * フィールド定義から各種型への変換ユーティリティ
 *
 * domain-config の generate-schema.mjs, generate-drizzle-entity.mjs を参考に実装
 */

/**
 * fieldType から Zod スキーマの型文字列を生成
 * @param {Object} field フィールド定義
 * @returns {string} Zod 型文字列
 */
export function mapZodType(field) {
  const { fieldType, required, options } = field;
  let zodType;

  switch (fieldType) {
    case "string":
    case "mediaUploader":
      zodType = "z.string().trim()";
      break;
    case "integer":
      zodType = "z.coerce.number().int()";
      break;
    case "float":
      zodType = "z.coerce.number()";
      break;
    case "boolean":
      zodType = "z.coerce.boolean()";
      break;
    case "enum":
      if (options?.length > 0) {
        const values = options.map((o) => `"${o.value}"`).join(", ");
        zodType = `z.enum([${values}])`;
      } else {
        zodType = "z.string()";
      }
      break;
    case "date":
    case "time":
      zodType = "z.string()";
      break;
    case "timestamp":
    case "timestamp With Time Zone":
      zodType = "z.preprocess((val) => (val === '' ? null : val), z.coerce.date())";
      break;
    default:
      zodType = "z.string()";
  }

  // 必須でない場合は nullish() を追加
  if (!required) {
    zodType += ".nullish()";
  }

  return zodType;
}

/**
 * fieldType から Drizzle の列型を生成
 * @param {Object} field フィールド定義
 * @returns {Object} { typeFn, columnDef }
 */
export function mapDrizzleType(field) {
  const { name, fieldType, required, defaultValue, options } = field;
  const snakeName = camelToSnake(name);

  let typeFn;
  let columnDef;
  let imports = new Set();

  switch (fieldType) {
    case "string":
    case "mediaUploader":
      typeFn = "text";
      columnDef = `text("${snakeName}")`;
      imports.add("text");
      break;
    case "integer":
      typeFn = "integer";
      columnDef = `integer("${snakeName}")`;
      imports.add("integer");
      break;
    case "float":
      typeFn = "doublePrecision";
      columnDef = `doublePrecision("${snakeName}")`;
      imports.add("doublePrecision");
      break;
    case "boolean":
      typeFn = "boolean";
      columnDef = `boolean("${snakeName}")`;
      imports.add("boolean");
      break;
    case "enum":
      // pgEnum を生成する必要がある
      typeFn = "pgEnum";
      const enumName = `setting${toPascalCase(name)}Enum`;
      columnDef = `${enumName}("${snakeName}")`;
      imports.add("pgEnum");
      break;
    case "date":
      typeFn = "date";
      columnDef = `date("${snakeName}")`;
      imports.add("date");
      break;
    case "time":
      typeFn = "time";
      columnDef = `time("${snakeName}")`;
      imports.add("time");
      break;
    case "timestamp":
    case "timestamp With Time Zone":
      typeFn = "timestamp";
      columnDef = `timestamp("${snakeName}", { withTimezone: true })`;
      imports.add("timestamp");
      break;
    default:
      typeFn = "text";
      columnDef = `text("${snakeName}")`;
      imports.add("text");
  }

  // デフォルト値の処理
  if (defaultValue !== undefined && defaultValue !== null) {
    if (fieldType === "boolean") {
      columnDef += `.default(${defaultValue})`;
    } else if (fieldType === "integer" || fieldType === "float") {
      columnDef += `.default(${defaultValue})`;
    } else if (fieldType === "string" || fieldType === "mediaUploader") {
      columnDef += `.default("${defaultValue}")`;
    } else if (fieldType === "enum") {
      columnDef += `.default("${defaultValue}")`;
    }
  }

  // 必須の場合は notNull() を追加
  if (required) {
    columnDef += ".notNull()";
  }

  return { typeFn, columnDef, imports: Array.from(imports) };
}

/**
 * fieldType から TypeScript 型を生成
 * @param {Object} field フィールド定義
 * @returns {string} TypeScript 型文字列
 */
export function mapTsType(field) {
  const { fieldType, required, options } = field;
  let tsType;

  switch (fieldType) {
    case "string":
    case "mediaUploader":
      tsType = "string";
      break;
    case "integer":
    case "float":
      tsType = "number";
      break;
    case "boolean":
      tsType = "boolean";
      break;
    case "enum":
      if (options?.length > 0) {
        tsType = options.map((o) => `"${o.value}"`).join(" | ");
      } else {
        tsType = "string";
      }
      break;
    case "date":
    case "time":
      tsType = "string";
      break;
    case "timestamp":
    case "timestamp With Time Zone":
      tsType = "Date";
      break;
    default:
      tsType = "string";
  }

  // 必須でない場合は null を許容
  if (!required) {
    tsType += " | null";
  }

  return tsType;
}

/**
 * formInput からコンポーネント情報を取得
 * @param {Object} field フィールド定義
 * @returns {Object} { component, props, imports }
 */
export function mapFormComponent(field) {
  const { formInput, options, uploadPath, accept } = field;
  let component;
  let props = {};
  let imports = new Set();

  switch (formInput) {
    case "textInput":
      component = "TextInput";
      imports.add("TextInput");
      break;
    case "textarea":
      component = "Textarea";
      imports.add("Textarea");
      break;
    case "numberInput":
      component = "TextInput";
      props.type = "number";
      imports.add("TextInput");
      break;
    case "switchInput":
      component = "Switch";
      imports.add("Switch");
      break;
    case "select":
      component = "Select";
      imports.add("Select");
      break;
    case "radio":
      component = "RadioGroup";
      imports.add("RadioGroup");
      break;
    case "dateInput":
      component = "DateInput";
      imports.add("DateInput");
      break;
    case "datetimeInput":
      component = "DatetimeInput";
      imports.add("DatetimeInput");
      break;
    case "mediaUploader":
      component = "ControlledMediaUploader";
      props.uploadPath = uploadPath || "setting";
      props.accept = accept || "image/*";
      imports.add("ControlledMediaUploader");
      break;
    default:
      component = "TextInput";
      imports.add("TextInput");
  }

  return { component, props, imports: Array.from(imports) };
}

/**
 * camelCase を snake_case に変換
 * @param {string} str
 * @returns {string}
 */
export function camelToSnake(str) {
  return str.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`).replace(/^_/, "");
}

/**
 * snake_case を camelCase に変換
 * @param {string} str
 * @returns {string}
 */
export function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 文字列を PascalCase に変換
 * @param {string} str
 * @returns {string}
 */
export function toPascalCase(str) {
  const camel = snakeToCamel(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
