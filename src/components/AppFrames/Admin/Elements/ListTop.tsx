// src/components/Admin/Elements/ListTop.tsx

import SecTitle from "@/components/AppFrames/Admin/Elements/SecTitle";

type Props = {
  title: string;
  children?: React.ReactNode;
};

export default function ListTop({ title, children }: Props) {
  return (
    <div id="admin-list-top" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SecTitle>
        {title}
      </SecTitle>
      <div className="flex items-center gap-2 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
