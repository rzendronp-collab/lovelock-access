import type { ReactNode } from "react";
import { Inbox, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Estado VAZIO — único no sistema. */
export function EmptyState({
  title,
  message = "Ainda não há nada aqui.",
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <p className="text-highlight font-semibold">{title}</p>
      <p className="text-body max-w-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

/** Estado CARREGANDO — único no sistema. */
export function LoadingState({ message = "Carregando…" }: { message?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-6 py-14 text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="text-body">{message}</span>
    </div>
  );
}

/** Estado ERRO — único no sistema. */
export function ErrorState({
  title = "Algo deu errado",
  message = "Não foi possível carregar estas informações.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" aria-hidden />
      </div>
      <p className="text-highlight font-semibold">{title}</p>
      <p className="text-body max-w-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="text-body" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
