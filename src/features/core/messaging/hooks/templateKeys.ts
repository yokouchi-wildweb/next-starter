// src/features/core/messaging/hooks/templateKeys.ts
//
// 保存されたテンプレートの SWR のキー。保存・公開・取り下げは 1 件・版・一覧(画面が revalidate)を取り直す

export const MESSAGE_TEMPLATES_KEY = "messaging/admin/templates";
export const MESSAGE_TEMPLATE_OPTIONS_KEY = `${MESSAGE_TEMPLATES_KEY}/options`;

/** 1 件のキー */
export const messageTemplateKey = (id: string) => `${MESSAGE_TEMPLATES_KEY}/${id}`;
/** 版の一覧のキー */
export const messageTemplateVersionsKey = (id: string) => `${messageTemplateKey(id)}/versions`;
/** 版 1 つのキー */
export const messageTemplateVersionKey = (id: string, version: number) => `${messageTemplateVersionsKey(id)}/${version}`;
