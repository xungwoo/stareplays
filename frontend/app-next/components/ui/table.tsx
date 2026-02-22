import { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-x-auto rounded-lg border border-line", className)} {...props} />;
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse", className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("border-b border-line bg-white/60 px-3 py-2 text-left text-[11px] font-bold uppercase", className)} {...props} />;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-line/40 px-3 py-2 text-sm", className)} {...props} />;
}
