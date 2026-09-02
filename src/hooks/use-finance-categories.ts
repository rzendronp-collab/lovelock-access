import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

  /** Cria a categoria e devolve o id — usada pelo "+ Nova categoria" do formulário. */
  const quickCreate = useMutation({
    mutationFn: async (name: string) => {
      if (!orgId || !projectId) throw new Error("sem projeto");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("finance_categories")
        .insert({
          org_id: orgId,
          project_id: projectId,
          name,
          color: "neutra",
          kind: "ambos",
          position: rows.length,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      records.invalidate();
      toast.success("Categoria salva.");
    },
    onError: () => toast.error("Não foi possível salvar a categoria."),
  });

  return { ...records, rows, byId, forKind, swatchOf, nameOf, quickCreate };
}
