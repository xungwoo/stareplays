import { InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-line bg-white/70 px-3 text-sm font-medium outline-none transition focus:border-fg",
        className
      )}
      {...props}
    />
  );
});
