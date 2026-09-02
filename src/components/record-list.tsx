import type { ReactNode } from "react";
import { useMemo } from "react";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ColorOption = {
  /** Valor guardado no registro. */
  value: string;
  label: string;
  /** Classe de fundo vinda das variáveis de tema (nunca cor solta). */
  swatchClassName: string;
};

export type RecordListProps<T> = {
  items: T[];
  /** Chave estável de cada item. */
  getKey: (item: T) => string;
  /** Texto usado pela busca. */
  getSearchText: (item: T) => string;
  /** Categoria ou pasta do item (para o filtro de grupos). */
  getGroup?: (item: T) => string;
  /** Cor do item (para o seletor de cor). */
  getColor?: (item: T) => string;
  renderItem: (item: T) => ReactNode;

  search: string;
  onSearchChange: (value: string) => void;
  searchLabel?: string;
  searchPlaceholder?: string;
  searchId?: string;

  group?: string;
  onGroupChange?: (value: string) => void;
  groupAllLabel?: string;

  colorOptions?: ColorOption[];
  color?: string;
  onColorChange?: (value: string) => void;

  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: { title: string; message?: string; icon?: ReactNode; action?: ReactNode };
  toolbarExtra?: ReactNode;
  /** Esconde busca/filtros internos quando o módulo já os mostra na barra do topo. */
  hideControls?: boolean;
};


/**
 * Lista ÚNICA de registros do sistema: busca, filtro por categoria/pasta e
 * seletor de cor. Serve para qualquer módulo que liste registros.
 */
export function RecordList<T>({
  items,
  getKey,
  getSearchText,
  getGroup,
  getColor,
  renderItem,
  search,
  onSearchChange,
  searchLabel = "Buscar",
  searchPlaceholder = "Buscar…",
  searchId = "record-list-busca",
  group = "",
  onGroupChange,
  groupAllLabel = "Todas",
  colorOptions,
  color = "",
  onColorChange,
  loading,
  error,
  onRetry,
  empty,
  toolbarExtra,
}: RecordListProps<T>) {
  const groups = useMemo(() => {
    if (!getGroup) return [];
    const set = new Set<string>();
    for (const item of items) {
      const g = getGroup(item);
      if (g) set.add(g);
    }
    return [...set].sort();
  }, [items, getGroup]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !getSearchText(item).toLowerCase().includes(q)) return false;
      if (group && getGroup && getGroup(item) !== group) return false;
      if (color && getColor && getColor(item) !== color) return false;
      return true;
    });
  }, [items, search, group, color, getSearchText, getGroup, getColor]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor={searchId} className="text-label">
            {searchLabel}
          </Label>
          <Input
            id={searchId}
            className="text-body"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {toolbarExtra}
      </div>

      {getGroup && onGroupChange && (
        <div className="mb-4">
          <SelectPillGroup>
            <SelectPill active={!group} onClick={() => onGroupChange("")}>
              {groupAllLabel}
            </SelectPill>
            {groups.map((g) => (
              <SelectPill key={g} active={group === g} onClick={() => onGroupChange(g)}>
                {g}
              </SelectPill>
            ))}
          </SelectPillGroup>
        </div>
      )}

      {colorOptions && colorOptions.length > 0 && onColorChange && (
        <div className="mb-4">
          <SelectPillGroup>
            <SelectPill active={!color} onClick={() => onColorChange("")}>
              Todas as cores
            </SelectPill>
            {colorOptions.map((c) => (
              <SelectPill
                key={c.value}
                active={color === c.value}
                onClick={() => onColorChange(c.value)}
              >
                <span
                  aria-hidden
                  className={cn("size-2.5 rounded-full border border-border", c.swatchClassName)}
                />
                {c.label}
              </SelectPill>
            ))}
          </SelectPillGroup>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={onRetry} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={empty?.title ?? "Nada por aqui"}
          message={empty?.message}
          icon={empty?.icon}
          action={empty?.action}
        />
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((item) => (
            <li key={getKey(item)} className="flex flex-wrap items-center gap-3 py-3">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
