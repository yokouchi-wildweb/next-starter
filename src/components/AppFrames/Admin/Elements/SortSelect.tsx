// src/components/AppFrames/Admin/Elements/SortSelect.tsx

"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { SelectInput } from "@/components/Form/Input/Manual/Select";

type SortOption = { label: string; value: string };

export type AdminSortSelectProps = {
  options: SortOption[];
  selected?: string;
  defaultValue: string;
  paramKey?: string;
  makeHref: (params: URLSearchParams) => string;
};

export default function SortSelect({
  options,
  selected,
  defaultValue,
  paramKey = "sortBy",
  makeHref,
}: AdminSortSelectProps) {
  const router = useRouter();
  const params = useSearchParams();

  const handleChange = (value: string) => {
    const search = new URLSearchParams(params.toString());
    if (value && value !== defaultValue) {
      search.set(paramKey, value);
    } else {
      search.delete(paramKey);
    }
    search.delete("page");
    router.push(makeHref(search));
  };

  return (
    <SelectInput
      size="sm"
      className="min-w-24"
      options={options}
      value={selected ?? defaultValue}
      showPlaceholderOption={false}
      onChange={(value) => handleChange(value == null ? "" : String(value))}
    />
  );
}
