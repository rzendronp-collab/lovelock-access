import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import { usePermissions } from "@/hooks/use-org";

/** Cabeçalho de página: título, subtítulo opcional e área de ações à direita. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { isReadOnly } = usePermissions();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-title font-semibold">{title}</h1>
          {isReadOnly && (
            <span className="text-label inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              <Eye className="size-3" aria-hidden /> somente leitura
            </span>
          )}
        </div>
        {subtitle && <p className="text-body text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
