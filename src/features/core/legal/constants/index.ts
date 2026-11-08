// src/features/core/legal/constants/index.ts — 法務の文書の定数

import type { LegalDocumentKind } from "../types";

/** 文書の種類(並び = 表示・検査の順) */
export const LEGAL_DOCUMENT_KINDS: readonly LegalDocumentKind[] = ["terms", "privacy", "tradelaw"];

/** 中身を licenses の欄で埋める節の id(欄が空なら節ごと外す) */
export const LICENSES_SECTION_ID = "licenses";

/** 文面に制定日が無いとき事業の素性の launchedAt を制定日にする文書(今までの表示と同じ) */
export const LAUNCH_DATE_DEFAULT_KINDS: readonly LegalDocumentKind[] = ["terms", "privacy"];
