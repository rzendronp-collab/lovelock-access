import type { ReactNode } from "react";
import { ChevronDown, Filter, Search } from "lucide-react";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Barra de ferramentas ÚNICA do sistema (Trabalho, Dinheiro, Recebimentos):
 * faixa fina no topo com os controles em linha.
 */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Abas/visões compactas da barra. */
export function ToolbarTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <SelectPillGroup>
      {options.map((o) => (
        <SelectPill
          key={o.value}
          active={value === o.value}
          onClick={() => onChange(o.value)}
          className="gap-1.5"
        >
          {o.icon}
          {o.label}
        </SelectPill>
      ))}
    </SelectPillGroup>
  );
}

/** Campo de busca enxuto da barra. */
export function ToolbarSearch({
  value,
  onChange,
  placeholder = "Buscar…",
  label = "Buscar",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
}) {
  return (
    <div className="relative min-w-[8rem] flex-1 sm:max-w-[14rem]">
      <Search
        className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        {...(id ? { id } : {})}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-body h-8 pl-8 transition-all focus:min-w-[12rem]"
      />
    </div>
  );
}

/** Filtros recolhidos atrás de "Filtros ▾", com indicador de quantos estão ativos. */
export function ToolbarFilters({
  activeCount = 0,
  children,
  label = "Filtros",
}: {
  activeCount?: number;
  children: ReactNode;
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-body h-8 gap-1">
          <Filter className="size-4" aria-hidden />
          {label}
          {activeCount > 0 && (
            <span className="text-label ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-medium text-primary-foreground">
              {activeCount}
            </span>
          )}
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        {children}
      </PopoverContent>
    </Popover>
  );
}
