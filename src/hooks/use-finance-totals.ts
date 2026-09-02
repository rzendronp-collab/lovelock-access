import { useMemo } from "react";
import { useRecords } from "@/hooks/use-records";
import { useOrgId } from "@/hooks/use-org";
import type { Period } from "@/components/period-picker";
import {
  expandFixedCosts,
  toDisplay,
  totals,
  type DisplayEntry,
  type FinanceEntryRow,
  type FixedCostRow,
} from "@/lib/finance";

export type FinanceTotals = ReturnType<typeof totals>;

/**
 * Fonte ÚNICA dos quatro números (entrou, saiu, sobrou, margem) e da lista do período.
 * Usada pelo módulo Dinheiro e pelo Painel de hoje — o cálculo não é duplicado.
 */
export function useFinanceTotals(
  period: Period,
  options?: { projectId?: string | null; projectRequired?: boolean },
) {
  const { data: orgId, isLoading: loadingOrg } = useOrgId();
  const projectId = options?.projectId ?? null;
  const projectRequired = options?.projectRequired ?? false;

  const entries = useRecords<FinanceEntryRow & { id: string }>({
    table: "finance_entries",
    columns:
      "id, entry_date, description, category, category_id, account, kind, amount, received, origin, contact_id, created_by, project_id",
    orgId: orgId ?? null,
    projectId,
    projectRequired,
    orderBy: { column: "entry_date", ascending: false },
    trackCreatedBy: true,
    label: "lançamento",
  });

  const fixed = useRecords<FixedCostRow & { id: string }>({
    table: "fixed_costs",
    columns: "id, label, category, amount, day_of_month, start_month, end_month, active, created_by, project_id",
    orgId: orgId ?? null,
    projectId,
    projectRequired,
    orderBy: { column: "label", ascending: true },
    softDelete: false,
    label: "despesa fixa",
  });


  const allEntries = useMemo(() => toDisplay(entries.rows), [entries.rows]);
  const fixedRows = fixed.rows;

  const periodEntries = useMemo(
    () => entriesInRange(allEntries, fixedRows, period.from, period.to),
    [allEntries, fixedRows, period.from, period.to],
  );

  const periodTotals = useMemo(() => totals(periodEntries), [periodEntries]);

  return {
    orgId: orgId ?? null,
    entries,
    fixed,
    allEntries,
    fixedRows,
    periodEntries,
    totals: periodTotals,
    isLoading: loadingOrg || entries.isLoading || fixed.isLoading,
    error: entries.error || fixed.error,
    refetch: entries.refetch,
  };
}

/** Lançamentos reais + despesas fixas projetadas dentro do intervalo, mais recentes primeiro. */
export function entriesInRange(
  allEntries: DisplayEntry[],
  fixedRows: FixedCostRow[],
  from: string,
  to: string,
): DisplayEntry[] {
  const real = allEntries.filter((e) => e.entry_date >= from && e.entry_date <= to);
  const projected = expandFixedCosts(fixedRows, from, to);
  return [...real, ...projected].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
}
