// src/lib/domain/fields/fieldFormInputs.mjs
// 「フィールドの型」と、型ごとに選べる「フォーム入力種別」（DB ごと）の表。domain.json の検査（scripts/structure/domain の checks/fields.mjs・vocabulary）と
// ロールの検査、フォームの既定値のテストが使う（道具とアプリのテストが共有するので lib に置く、D78）。組み込みの入力の名前の正は formInputs.mjs（別の表）。
// 値は表示名で、domain.json には camelCase（toCamelCase）で書く。

export const FORM_INPUTS = {
  Firestore: {
    string: ["text input", "textarea", "date input", "number input", "color input", "select", "hidden", "none", "custom"],
    number: ["number input", "stepper input", "select", "radio", "hidden", "none", "custom"],
    boolean: ["checkbox", "radio", "switch input", "hidden", "none", "custom"],
    timestamp: ["datetime input", "hidden", "none", "custom"],
    email: ["email input", "text input", "hidden", "none", "custom"],
    password: ["password input", "hidden", "none", "custom"],
    array: ["checkbox", "multi select", "hidden", "none", "custom"],
    stringArray: ["checkbox", "multi select", "hidden", "none", "custom"],
    geopoint: ["hidden", "none", "custom"],
    reference: ["hidden", "none", "custom"],
    map: ["hidden", "none", "custom"],
    null: ["hidden", "none", "custom"],
  },
  Neon: {
    string: ["text input", "textarea", "date input", "number input", "color input", "select", "hidden", "none", "custom"],
    integer: ["number input", "stepper input", "select", "radio", "hidden", "none", "custom"],
    float: ["number input", "stepper input", "select", "radio", "hidden", "none", "custom"],
    boolean: ["checkbox", "radio", "switch input", "hidden", "none", "custom"],
    // switch input は options がちょうど 2 つのとき(1 つ目 = オン、2 つ目 = オフ。checks/fields.mjs が数を警告)
    enum: ["select", "radio", "switch input", "hidden", "none", "custom"],
    mediaUploader: ["media uploader", "hidden", "none", "custom"],
    mediaCollection: ["media uploader multi"],
    date: ["date input", "text input", "hidden", "none", "custom"],
    time: ["time input", "text input", "hidden", "none", "custom"],
    "timestamp With Time Zone": ["datetime input", "hidden", "none", "custom"],
    email: ["email input", "text input", "hidden", "none", "custom"],
    password: ["password input", "hidden", "none", "custom"],
    bigint: ["number input", "stepper input", "select", "radio", "hidden", "none", "custom"],
    "numeric(10,2)": ["number input", "stepper input", "select", "radio", "hidden", "none", "custom"],
    uuid: ["text input", "hidden", "none", "custom"],
    Point: ["hidden", "none", "custom"],
    jsonb: ["hidden", "none", "custom"],
    array: ["checkbox", "multi select", "hidden", "none", "custom"],
    stringArray: ["checkbox", "multi select", "hidden", "none", "custom"],
  },
};
