import { ReactNode } from "react";

export const PageHeader = ({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) => (
  <div className="flex flex-col gap-3 mb-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">{title}</h1>
      {description && (
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground text-pretty">{description}</p>
      )}
    </div>
    {actions && (
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none [&>a]:flex-1 sm:[&>a]:flex-none">
        {actions}
      </div>
    )}
  </div>
);
