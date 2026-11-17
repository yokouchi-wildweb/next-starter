// src/lib/messaging/embedded/names.ts
//
// 埋め込み情報の名前の形。差し込みの書式 {{名前}}(lib/structuredDocument の VARIABLE_PATTERN)が拾える形に合わせる

/** 鍵: 英字で始まる英数字(camelCase) */
export const EMBEDDED_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** 別名: 文字・数字・_ だけ(空白・記号は書式に拾われないので不可)。英数字だけの別名は鍵と紛れるので 1 字は英数字以外を含む */
export const EMBEDDED_ALIAS_PATTERN = /^(?=.*[^A-Za-z0-9_])[\p{L}\p{N}_]+$/u;
