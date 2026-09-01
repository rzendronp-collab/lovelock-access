import type { ReactNode } from "react";
import { Link, type LinkComponentProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export type LinkListItem = {
  id: string;
  /** Texto principal da linha. */
  title: string;
  /** Linha secundária (origem, categoria, etc.). */
  meta?: string;
  /** Valor/prazo mostrado à direita. */
  trailing?: ReactNode;
  /** Marcador colorido à esquerda (classe de cor do tema). */
  markerClassName?: string;
  /** Destino da navegação (mesma tipagem do Link do roteador). */
  link: LinkComponentProps;
};

/** Lista clicável ÚNICA do sistema para blocos de resumo (Painel de hoje e afins). */
export function LinkList({ items }: { items: LinkListItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            {...item.link}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 hover:bg-muted/50 sm:flex sm:justify-between"
          >
            <span className="flex min-w-0 items-center gap-3">
              {item.markerClassName && (
                <span
                  className={`size-2 shrink-0 rounded-full ${item.markerClassName}`}
                  aria-hidden
                />
              )}
              <span className="min-w-0">
                <span className="text-body block truncate font-medium">{item.title}</span>
                {item.meta && (
                  <span className="text-label block truncate text-muted-foreground">
                    {item.meta}
                  </span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {item.trailing && <span className="text-label">{item.trailing}</span>}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
