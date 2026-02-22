"use client";

import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";

type Props<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyText?: string;
  pageSize?: number;
};

export function DataTable<TData>({ columns, data, emptyText = "NO_DATA", pageSize = 10 }: Props<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize
      }
    }
  });

  return (
    <div className="space-y-2">
      <TableWrap>
        <Table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-white/30">
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <Td className="py-5 text-center text-fg/70" colSpan={columns.length}>
                  {emptyText}
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Prev
        </Button>
        <span className="min-w-20 text-center text-xs font-semibold uppercase text-fg/70">
          Page {table.getState().pagination.pageIndex + 1}/{table.getPageCount() || 1}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
