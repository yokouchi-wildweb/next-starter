// src/features/core/demo/services/client/bankTransferVision.ts

"use client";

import axios from "axios";

import type { DemoJudgeInput, DemoJudgmentResult } from "@/features/core/demo/types/bankTransferVision";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/demo/bank-transfer-vision";

/** 判定デモ: 画像(とストリクトの期待値)を送り、AI の判定結果を受け取る。失敗は HttpError で投げる */
export async function judgeDemoBankTransferImage(input: DemoJudgeInput): Promise<DemoJudgmentResult> {
  try {
    const formData = new FormData();
    formData.append("file", input.file);
    if (input.strict) {
      formData.append("expectedIdentifier", input.strict.expectedIdentifier);
      formData.append("expectedAmount", String(input.strict.expectedAmount));
    }
    const res = await axios.post<DemoJudgmentResult>(ENDPOINT, formData);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "判定に失敗しました");
  }
}
