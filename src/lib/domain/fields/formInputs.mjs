// src/lib/domain/fields/formInputs.mjs
// 組み込みの入力種別（domain.json の formInput）の名前の正。画面の型（FormInputType）と生成の検査（FORM_INPUT_VALUES）がここから導く。
// 型ごとに選べる候補の表は fieldFormInputs.mjs（役目が違うので別）

export const BUILTIN_FORM_INPUTS = /** @type {const} */ ([
  "textInput", "numberInput", "textarea", "select", "multiSelect", "combobox", "radio", "checkbox",
  "stepperInput", "switchInput", "dateInput", "timeInput", "datetimeInput", "emailInput",
  "passwordInput", "colorInput", "colorValueInput", "mediaUploader", "mediaUploaderMulti", "hidden",
  "none", "custom", "asyncCombobox", "asyncMultiSelect",
]);
