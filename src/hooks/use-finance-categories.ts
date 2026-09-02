import { useMemo } from "react";
import { useRecords } from "@/hooks/use-records";
import { useOrgId } from "@/hooks/use-org";
import { colorSwatch } from "@/lib/board";
import type { EntryKind } from "@/lib/finance";

export type FinanceCategoryRow = {
  id: string;
  name: string;
  color: string;
  kind: string;
  position: number;
  archived: boolean;
  created_by: string | null;
};

export const CATEGORY_KINDS = [
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
  { value: "ambos", label: "Ambos" },
] as const;

export function categoryKindLabel(kind: string) {
  return CATEGORY_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/** Cadastro ÚNICO de categorias do Dinheiro — sempre por projeto. */
export function useFinanceCategories(projectId: string | null) {
  const { data: orgId } = useOrgId();
  const records = useRecords<FinanceCategoryRow & { id: string }>({
    table: "finance_categories",
    columns: "id, name, color, kind, position, archived, created_by",
    orgId: orgId ?? null,
    projectId,
    projectRequired: true,
    orderBy: { column: "position", ascending: true },
    softDelete: false,
    trackCreatedBy: true,
    label: "categoria",
  });

  const rows = records.rows;

  const byId = useMemo(
    () => new Map(rows.map((c) => [c.id, c] as const)),
    [rows],
  );

  /** Categorias disponíveis para um tipo de lançamento (inclui "ambos"). */
  function forKind(kind: EntryKind) {
    return rows.filter((c) => !c.archived && (c.kind === "ambos" || c.kind === kind));
  }

  function swatchOf(categoryId: string | null) {
    const cat = categoryId ? byId.get(categoryId) : undefined;
    return colorSwatch(cat?.color ?? "neutra");
  }

  function nameOf(categoryId: string | null, fallback = "") {
    const cat = categoryId ? byId.get(categoryId) : undefined;
    return cat?.name || fallback || "Sem categoria";
  }

  return { ...records, rows, byId, forKind, swatchOf, nameOf };
}
