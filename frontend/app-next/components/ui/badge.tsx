import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase",
        className
      )}
      {...props}
    />
  );
}
