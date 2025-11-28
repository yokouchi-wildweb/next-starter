"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/lib/tableSuite/DataTable/components";

export type UserInfoRow = {
  label: string;
  value: string;
};

type UserInfoTableProps = {
  rows: UserInfoRow[];
};

export function UserInfoTable({ rows }: UserInfoTableProps) {
  return (
    <Table aria-label="ユーザー情報" className="min-w-[320px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-40">項目</TableHead>
          <TableHead>内容</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableHead scope="row" className="font-medium text-muted-foreground">
              {row.label}
            </TableHead>
            <TableCell className="break-all">{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
