import type { FieldPath, FieldValues } from "react-hook-form";
import type { ControlledInputProps } from "@/types/form";
import type { FileInputProps } from "../FileInput";

export type FileUrlOptions = {
  /** 画像アップロード処理。アップロード後のURLを返す */
  onUpload: (file: File) => Promise<string>;
  /** URL指定で削除する場合の処理 */
  onDelete?: (url: string) => Promise<void>;
  /** プレビューおよびhidden初期値 */
  initialUrl?: string | null;
  /** アップロードまたは削除中の状態を通知する */
  onPendingChange?: (pending: boolean) => void;
};

// ベースコンポーネントから除外したいプロパティ
export type OmittedFileInputProps = Omit<
  FileInputProps<FieldValues, FieldPath<FieldValues>>,
  "field" | "initialUrl" | "onSelect" | "onRemove"
>;

export type Props<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> &
  FileUrlOptions &
  OmittedFileInputProps;

