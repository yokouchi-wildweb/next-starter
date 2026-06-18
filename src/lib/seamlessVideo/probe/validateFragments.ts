// src/lib/seamlessVideo/probe/validateFragments.ts
//
// 「適正なフォーマット(統一プロファイルの fmp4)」かどうかをブラウザ側で検証する。
// 入力フォーマット規約(README.md)を口頭ルールではなくコードで判定できる契約にするための汎用機能。
// サーバー変換は行わない。アップロード前/再生前のクライアントチェックとして利用する。

import type { FragmentInfo, SeamlessFragmentSource } from "../types";
import { toArrayBuffer } from "../core/fragmentBytes";
import { isTypeSupported } from "../core/codecSupport";
import { parseFragment } from "./boxWalker";

/** 検証対象 1 件(表示名 + ソース)。 */
export type FragmentInput = {
  name: string;
  data: SeamlessFragmentSource;
};

/** フラグメント単位の検証結果。 */
export type FragmentValidation = {
  name: string;
  info: FragmentInfo | null;
  /** このフラグメント固有の問題(致命的) */
  issues: string[];
  /** 注意喚起(再生は可能だが推奨外) */
  warnings: string[];
};

/** 検証レポート全体。 */
export type ValidationReport = {
  fragments: FragmentValidation[];
  /** 全フラグメントで codec / 解像度が一致し、init 互換とみなせるか */
  compatible: boolean;
  /** 連結再生に使う共通 MIME(compatible のときのみ) */
  mimeType: string | null;
  /** この環境(ブラウザ)で mimeType が再生可能か */
  supported: boolean;
  /** 連結が破綻する致命的エラー(セット全体) */
  errors: string[];
  /** 注意喚起(セット全体) */
  warnings: string[];
  /** すべての条件を満たし、継ぎ目なし連結が成立する見込みか */
  ok: boolean;
};

/**
 * 複数フラグメントを検証し、継ぎ目なし連結が成立するかをレポートする。
 */
export async function validateFragments(inputs: FragmentInput[]): Promise<ValidationReport> {
  const fragments: FragmentValidation[] = [];

  for (const input of inputs) {
    const validation: FragmentValidation = { name: input.name, info: null, issues: [], warnings: [] };
    try {
      const buffer = await toArrayBuffer(input.data);
      const info = parseFragment(buffer);
      validation.info = info;

      if (!info.isFragmented) {
        validation.issues.push("fragmented MP4 ではありません(moof / mvex が見つかりません)");
      }
      if (!info.codec) {
        validation.issues.push("H.264(avc1)映像トラックが見つかりません");
      }
      if (info.startsWithKeyframe === false) {
        validation.issues.push("先頭がキーフレーム(IDR)ではありません。任意順での連結が破綻します");
      } else if (info.startsWithKeyframe === null) {
        validation.warnings.push("先頭サンプルの同期判定ができませんでした(キーフレーム始まりか不明)");
      }
      if (info.hasAudio) {
        validation.warnings.push("音声トラックを含みます。v1 は映像のみを想定しており、継ぎ目で問題が出る可能性があります");
      }
    } catch (e) {
      validation.issues.push(e instanceof Error ? e.message : "解析に失敗しました(MP4 として不正の可能性)");
    }
    fragments.push(validation);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // codec / 解像度の一致(= init 互換)をセット全体で確認
  const valid = fragments.filter((f) => f.info?.codec);
  const codecs = new Set(valid.map((f) => f.info!.codec));
  const resolutions = new Set(valid.map((f) => `${f.info!.width}x${f.info!.height}`));

  let compatible = false;
  let mimeType: string | null = null;

  if (valid.length === 0) {
    errors.push("有効な H.264 フラグメントが 1 つもありません");
  } else {
    if (codecs.size > 1) {
      errors.push(`フラグメント間でコーデックが一致しません(${[...codecs].join(", ")})。init が互換にならず継ぎ目で破綻します`);
    }
    if (resolutions.size > 1) {
      errors.push(`フラグメント間で解像度が一致しません(${[...resolutions].join(", ")})。アスペクト比のガタつき/破綻の原因になります`);
    }
    compatible = codecs.size === 1 && resolutions.size === 1 && valid.length === fragments.length;
    if (compatible) {
      mimeType = valid[0].info!.mimeType;
    }
  }

  const supported = mimeType ? isTypeSupported(mimeType) : false;
  if (mimeType && !supported) {
    errors.push(`この環境では未対応のコーデックです: ${mimeType}`);
  }

  const hasFragmentIssue = fragments.some((f) => f.issues.length > 0);
  const ok = compatible && supported && !hasFragmentIssue && errors.length === 0;

  return { fragments, compatible, mimeType, supported, errors, warnings, ok };
}
