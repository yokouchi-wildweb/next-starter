// src/components/Admin/Elements/SelectFilter.tsx

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/Shadcn/select";

type Option = { label: string; value: string };

export type AdminSelectFilterProps = {
  options: Option[];
  selected?: string;
  paramKey: string;
  makeHref: (params: URLSearchParams) => string;
  placeholder?: string;
};

const ALL_VALUE = "__all__";

export default function SelectFilter({
  options,
  selected,
  paramKey,
  makeHref,
  placeholder = "すべて",
}: AdminSelectFilterProps) {
  const router = useRouter();
  const params = useSearchParams();

  const handleChange = (value: string) => {
    const search = new URLSearchParams(params.toString());
    if (value && value !== ALL_VALUE) {
      search.set(paramKey, value);
    } else {
      search.delete(paramKey);
    }
    router.push(makeHref(search));
  };

  return (
    <Select onValueChange={handleChange} value={selected ?? ALL_VALUE}>
      <SelectTrigger size="sm" className="min-w-32">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
