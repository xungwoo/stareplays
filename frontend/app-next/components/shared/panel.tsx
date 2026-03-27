import type { CSSProperties, ElementType, HTMLAttributes, PropsWithChildren } from "react";

import { CYAN_PANEL_STYLE, INNER_PANEL_STRONG_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";

const panelStyles = {
  cyan: CYAN_PANEL_STYLE,
  inner: INNER_PANEL_STYLE,
  innerStrong: INNER_PANEL_STRONG_STYLE
} as const;

export type PanelVariant = keyof typeof panelStyles;

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  as?: ElementType;
  variant: PanelVariant;
}

export function Panel({ as: Component = "div", variant, className, style, children, ...props }: PropsWithChildren<PanelProps>) {
  return (
    <Component
      {...props}
      className={className}
      style={{
        ...panelStyles[variant],
        ...(style as CSSProperties | undefined)
      }}
    >
      {children}
    </Component>
  );
}
