// src/components/Admin/Elements/SearchBox.tsx

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Form/Button/Button";
import { Input } from "@/components/Form/Manual";
import { useState } from "react";

type Props = {
  searchKey?: string;
  makeHref: (params: URLSearchParams) => string;
  placeholder?: string;
  resetLabel?: string;
};

export default function SearchBox({
  searchKey = "searchQuery",
  makeHref,
  placeholder = "検索 (Enterで適用)",
  resetLabel = "リセット",
}: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const [value, setValue] = useState(params.get(searchKey) ?? "");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const search = new URLSearchParams(params.toString());
    if (value) {
      search.set(searchKey, value);
    } else {
      search.delete(searchKey);
    }
    search.delete("page");
    router.push(makeHref(search));
  };

  const handleReset = () => {
    setValue("");
    const search = new URLSearchParams(params.toString());
    search.delete(searchKey);
    search.delete("page");
    router.push(makeHref(search));
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1 min-w-48">

      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 flex-1"
      />
      <Button type="button" size="sm" variant="outline" onClick={handleReset}>

        {resetLabel}
      </Button>
    </form>
  );
}
