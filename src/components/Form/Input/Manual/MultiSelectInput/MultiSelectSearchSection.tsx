// @/components/Form/Input/Manual/MultiSelectInput/MultiSelectSearchSection.tsx

import { CommandInput } from "@/components/_shadcn/command";

type Props = {
  placeholder?: string;
};

export function MultiSelectSearchSection({ placeholder }: Props) {
  return <CommandInput placeholder={placeholder ?? "キーワードで絞り込み"} />;
}
