import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Estilo ÚNICO de cartão do sistema. Todo bloco de conteúdo usa este componente.
 */
export function AppCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const hasHeader = Boolean(title || subtitle || actions);

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="space-y-1">
            {title && <h2 className="text-highlight font-semibold">{title}</h2>}
            {subtitle && <p className="text-label text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
