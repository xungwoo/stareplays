import { ReactNode } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ChartCard({ title, description, children }: Props) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
      <div className="mt-3 h-72">{children}</div>
    </Card>
  );
}
