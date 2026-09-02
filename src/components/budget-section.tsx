import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppCard } from "@/components/app-card";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Field } from "@/components/detail-panel";
import { TotalCard } from "@/components/total-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecords } from "@/hooks/use-records";
import { usePermissions } from "@/hooks/use-org";
import type { useFinanceCategories } from "@/hooks/use-finance-categories";
import { entriesInRange } from "@/hooks/use-finance-totals";
import { colorSwatch } from "@/lib/board";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  monthBounds,
  monthLabel,
  totals,
  type DisplayEntry,
  type EntryKind,
  type FixedCostRow,
} from "@/lib/finance";

type BudgetRow = {
  id: string;
  category_id: string | null;
  month: string;
  planned: number;
  created_by: string | null;
};

/** "YYYY-MM" do mês atual. */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Mês anterior a "YYYY-MM". */
function previousMonth(ym: string) {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Cores da barra: dentro do orçado, perto do limite ou estourado. */
function barTone(pct: number, hasPlan: boolean) {
  if (!hasPlan) return { bar: "[&>div]:bg-muted-foreground", text: "text-muted-foreground" };
  if (pct > 100) return { bar: "[&>div]:bg-destructive", text: "text-destructive" };
  if (pct > 85) return { bar: "[&>div]:bg-warning", text: "text-warning" };
  return { bar: "[&>div]:bg-primary", text: "text-primary" };
}

/**
 * Orçado (tabela budgets) vs realizado (mesmo cálculo do resto do Dinheiro:
 * entriesInRange + totals, já com as despesas fixas projetadas).
 */
export function BudgetSection({
  orgId,
  projectId,
  categories,
  allEntries,
  fixedRows,
}: {
  orgId: string | null;
  projectId: string;
  categories: ReturnType<typeof useFinanceCategories>;
  allEntries: DisplayEntry[];
  fixedRows: FixedCostRow[];
}) {
  const perms = usePermissions();
  const [month, setMonth] = useState(currentMonth);
  const [kind, setKind] = useState<EntryKind>("saida");
  const [draft, setDraft] = useState<Record<string, string>>({});

  const budgets = useRecords<BudgetRow & { id: string }>({
    table: "budgets",
    columns: "id, category_id, month, planned, created_by",
    orgId: orgId ?? null,
    projectId,
    projectRequired: true,
    orderBy: { column: "month", ascending: false },
    softDelete: false,
    trackCreatedBy: true,
    label: "orçamento",
  });

  const bounds = useMemo(() => monthBounds(month), [month]);

  /** Lançamentos reais + fixas projetadas do mês — mesma fonte do módulo Dinheiro. */
  const monthEntries = useMemo(
    () => entriesInRange(allEntries, fixedRows, bounds.from, bounds.to),
    [allEntries, fixedRows, bounds.from, bounds.to],
  );

  const plannedByCategory = useMemo(() => {
    const map = new Map<string, BudgetRow>();
    for (const b of budgets.rows) {
      if (b.month.slice(0, 7) !== month) continue;
      map.set(b.category_id ?? "", b);
    }
    return map;
  }, [budgets.rows, month]);

  const rows = useMemo(() => {
    const cats = categories.rows.filter((c) => c.kind === "ambos" || c.kind === kind);
    const list = cats.map((c) => {
      const realizado = totals(
        monthEntries.filter((e) => e.kind === kind && e.category_id === c.id),
      );
      const budget = plannedByCategory.get(c.id);
      const planned = Number(budget?.planned ?? 0);
      const actual = kind === "entrada" ? realizado.entrou : realizado.saiu;
      return { id: c.id, name: c.name, color: c.color, planned, actual, budgetId: budget?.id };
    });

    /** Lançamentos sem categoria (inclui as despesas fixas projetadas). */
    const semCategoria = totals(
      monthEntries.filter((e) => e.kind === kind && !e.category_id),
    );
    const semActual = kind === "entrada" ? semCategoria.entrou : semCategoria.saiu;
    if (semActual > 0) {
      list.push({
        id: "",
        name: "Sem categoria",
        color: "neutra",
        planned: 0,
        actual: semActual,
        budgetId: plannedByCategory.get("")?.id,
      });
    }
    return list;
  }, [categories.rows, kind, monthEntries, plannedByCategory]);

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  const savePlanned = useMutation({
    mutationFn: async ({
      categoryId,
      budgetId,
      planned,
    }: {
      categoryId: string;
      budgetId?: string | undefined;
      planned: number;
    }) => {
      if (!orgId) throw new Error("sem empresa");
      if (budgetId) {
        const { error } = await supabase.from("budgets").update({ planned }).eq("id", budgetId);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("budgets").insert({
        org_id: orgId,
        project_id: projectId,
        category_id: categoryId || null,
        month: `${month}-01`,
        planned,
        ...(userData.user?.id ? { created_by: userData.user.id } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => budgets.invalidate(),
    onError: () => toast.error("Não foi possível salvar o orçamento."),
  });

  const copyPrevious = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("sem empresa");
      const prev = previousMonth(month);
      const source = budgets.rows.filter(
        (b) => b.month.slice(0, 7) === prev && Number(b.planned) !== 0,
      );
      if (source.length === 0) throw new Error("vazio");
      const { data: userData } = await supabase.auth.getUser();
      for (const b of source) {
        const existing = plannedByCategory.get(b.category_id ?? "");
        if (existing) {
          const { error } = await supabase
            .from("budgets")
            .update({ planned: Number(b.planned) })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("budgets").insert({
            org_id: orgId,
            project_id: projectId,
            category_id: b.category_id,
            month: `${month}-01`,
            planned: Number(b.planned),
            ...(userData.user?.id ? { created_by: userData.user.id } : {}),
          });
          if (error) throw error;
        }
      }
      return source.length;
    },
    onSuccess: (count) => {
      setDraft({});
      budgets.invalidate();
      toast.success(`${count} valor(es) copiados de ${monthLabel(previousMonth(month))}.`);
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "vazio"
          ? "O mês anterior não tem orçamento definido."
          : "Não foi possível copiar o orçamento.",
      ),
  });

  function commit(row: { id: string; budgetId?: string | undefined; planned: number }) {
    const raw = draft[row.id];
    if (raw === undefined) return;
    const planned = Number(raw.replace(",", ".")) || 0;
    setDraft((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    if (planned === row.planned) return;
    savePlanned.mutate({ categoryId: row.id, budgetId: row.budgetId, planned });
  }

  const diff = totalActual - totalPlanned;

  return (
    <>
      <AppCard
        title="Orçado vs realizado"
        subtitle="Defina o planejado por categoria no mês e compare com o que aconteceu."
        actions={
          perms.canWrite ? (
            <Button
              variant="secondary"
              className="text-body"
              disabled={copyPrevious.isPending}
              onClick={() => copyPrevious.mutate()}
            >
              <CopyPlus className="size-4" aria-hidden /> Copiar do mês anterior
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Mês" id="orc-mes">
            <Input
              id="orc-mes"
              type="month"
              className="text-body"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonth())}
            />
          </Field>
          <SelectPillGroup>
            <SelectPill active={kind === "saida"} onClick={() => setKind("saida")}>
              Saídas
            </SelectPill>
            <SelectPill active={kind === "entrada"} onClick={() => setKind("entrada")}>
              Entradas
            </SelectPill>
          </SelectPillGroup>
        </div>
      </AppCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <TotalCard label="Orçado" value={formatMoney(totalPlanned)} />
        <TotalCard label="Realizado" value={formatMoney(totalActual)} />
        <TotalCard
          label="Diferença"
          value={formatMoney(diff)}
          sub={
            totalPlanned > 0
              ? `${((totalActual / totalPlanned) * 100).toFixed(1)}% do orçado usado`
              : "sem orçamento definido"
          }
        />
      </div>

      <AppCard title={`${kind === "saida" ? "Gastos" : "Receitas"} de ${monthLabel(month)}`}>
        {categories.isLoading || budgets.isLoading ? (
          <LoadingState />
        ) : categories.error || budgets.error ? (
          <ErrorState onRetry={budgets.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhuma categoria"
            message="Cadastre categorias na aba Categorias para orçar este mês."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const pct = r.planned > 0 ? (r.actual / r.planned) * 100 : r.actual > 0 ? 100 : 0;
              const tone = barTone(pct, r.planned > 0);
              const rowDiff = r.actual - r.planned;
              return (
                <li key={r.id || "sem"} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn("size-3 shrink-0 rounded-full", colorSwatch(r.color))}
                      aria-hidden
                    />
                    <p className="text-body min-w-32 flex-1 font-medium">{r.name}</p>

                    {perms.canWrite && r.id ? (
                      <Input
                        aria-label={`Orçado de ${r.name}`}
                        inputMode="decimal"
                        className="text-body w-28"
                        value={draft[r.id] ?? (r.planned ? String(r.planned) : "")}
                        placeholder="0,00"
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        onBlur={() => commit(r)}
                        onKeyDown={(e) => e.key === "Enter" && commit(r)}
                      />
                    ) : (
                      <span className="text-body w-28 text-muted-foreground">
                        {formatMoney(r.planned)}
                      </span>
                    )}

                    <span className="text-body w-28 text-right font-semibold">
                      {formatMoney(r.actual)}
                    </span>
                    <span className={cn("text-label w-32 text-right", tone.text)}>
                      {rowDiff >= 0 ? "+" : "−"} {formatMoney(Math.abs(rowDiff))}
                      {r.planned > 0 ? ` · ${pct.toFixed(0)}%` : ""}
                    </span>
                  </div>
                  <Progress value={Math.min(100, pct)} className={cn("bg-muted", tone.bar)} />
                </li>
              );
            })}
            <li className="flex flex-wrap items-center gap-3 pt-3">
              <p className="text-body min-w-32 flex-1 font-semibold">Total</p>
              <span className="text-body w-28 font-semibold">{formatMoney(totalPlanned)}</span>
              <span className="text-body w-28 text-right font-semibold">
                {formatMoney(totalActual)}
              </span>
              <span
                className={cn(
                  "text-label w-32 text-right font-medium",
                  barTone(totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0, totalPlanned > 0)
                    .text,
                )}
              >
                {diff >= 0 ? "+" : "−"} {formatMoney(Math.abs(diff))}
              </span>
            </li>
          </ul>
        )}
      </AppCard>
    </>
  );
}
