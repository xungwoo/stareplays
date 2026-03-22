import type { PropsWithChildren } from "react";

export function PageContainer({ children }: PropsWithChildren) {
  return <div className="w-full">{children}</div>;
}
