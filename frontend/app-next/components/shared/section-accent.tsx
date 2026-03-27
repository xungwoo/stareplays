import type { CSSProperties, HTMLAttributes } from "react";

import { CYAN_SECTION_ACCENT_STYLE } from "@/lib/constants/ui-styles";

export function SectionAccent({ className, style, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={["w-1.5 h-5 rounded-sm", className].filter(Boolean).join(" ")}
      style={{
        ...CYAN_SECTION_ACCENT_STYLE,
        ...(style as CSSProperties | undefined)
      }}
    />
  );
}
