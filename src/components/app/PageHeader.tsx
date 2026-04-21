import { ReactNode } from "react";

export const PageHeader = ({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);