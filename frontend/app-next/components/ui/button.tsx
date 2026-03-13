import { ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClasses: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:opacity-90",
  outline: "border border-line bg-white/40 text-fg hover:bg-white/70",
  ghost: "text-fg hover:bg-white/30"
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm"
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-45",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});
