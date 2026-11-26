// src/domains/core/messaging/constants/domain.ts
// どの表にも属さないドメイン全体の定数と入力の形(entities/<登録名>/ にはその表の物だけ)

/** message_dispatches.expand_cursor の「展開を終えた」印(keyset の印・"i:<番号>" とぶつからない値) */
export const MESSAGE_EXPAND_DONE = "~done";
/** 「全体」を表す非 null の値（message_preferences の category / channel、message_suppressions の scope） */
export const MESSAGE_ALL = "*";
