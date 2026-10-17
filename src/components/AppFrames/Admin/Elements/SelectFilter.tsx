// src/components/AppFrames/Admin/Elements/SelectFilter.tsx

"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { SelectInput } from "@/components/Form/Input/Manual/Select";

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
    <SelectInput
      size="sm"
      className="min-w-32"
      placeholder={placeholder}
      options={[{ label: placeholder, value: ALL_VALUE }, ...options]}
      value={selected ?? ALL_VALUE}
      showPlaceholderOption={false}
      onChange={(value) => handleChange(value == null ? "" : String(value))}
    />
  );
}
