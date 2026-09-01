import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TotalCard, type Delta } from "@/components/total-card";
import { PeriodPicker, usePeriodPicker, type Period } from "@/components/period-picker";
import { Progress } from "@/components/ui/progress";
import { useFinanceTotals, entriesInRange } from "@/hooks/use-finance-totals";
import { useRecords } from "@/hooks/use-records";
import { useOrgId } from "@/hooks/use-org";
import { useCurrentProject } from "@/hooks/use-projects";
import {
  formatMoney,
  lastMonths,
  monthlySeries,
  totals,
  type DisplayEntry,
} from "@/lib/finance";
import { goalPercent } from "@/lib/goals";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios | EuroHub" },
      {
        name: "description",
        content:
          "Visão de cima do EuroHub: 12 meses de entradas e saídas, comparativo entre projetos e panorama operacional.",
      },
      { property: "og:title", content: "Relatórios | EuroHub" },
      {
        property: "og:description",
        content:
          "Visão de cima do EuroHub: 12 meses de entradas e saídas, comparativo entre projetos e panorama operacional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Relatorios,
});

type CardRow = {
  id: string;
  done: boolean;
  archived: boolean;
  created_at: string;
  due_date: string | null;
  board_id: string;
};

type BoardRow = { id: string; project_id: string | null };

type GoalRow = {
  id: string;
  title: string;
  target: number;
  current_source: string;
  note: string;
  period_start: string;
  due_date: string | null;
  project_id?: string | null;
};

type Scope = "atual" | "todos";

type SortKey = "name" | "entrou" | "saiu" | "sobrou" | "margem";

/** Período imediatamente anterior, do mesmo tamanho (para as comparações). */
function previousPeriod(period: Period): Period {
  const from = new Date(`${period.from}T00:00:00`);
  const to = new Date(`${period.to}T00:00:00`);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(prevFrom), to: iso(prevTo) };
}

function pctDelta(current: number, previous: number, hint: string): Delta | undefined {
  if (!previous) return undefined;
  const value = ((current - previous) / Math.abs(previous)) * 100;
  return { value, text: `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`, hint };
}

function ppDelta(current: number, previous: number, hint: string): Delta {
  const value = current - previous;
  return {
    value,
    text: `${value >= 0 ? "+" : ""}${value.toFixed(1)} p.p.`,
    hint,
  };
}

function Relatorios() {
  const { data: orgId, isLoading: loadingOrg } = useOrgId();
  const { projectId, activeProjects, project } = useCurrentProject();
  const [scope, setScope] = useState<Scope>("todos");
  const { key, setKey, custom, setCustom, period } = usePeriodPicker("mes");
  const [sort, setSort] = useState<{ column: SortKey; asc: boolean }>({
    column: "entrou",
    asc: false,
  });

  const scopedProject = scope === "atual" ? projectId : null;

  // Lê SEM filtro de projeto e filtra na memória: um único conjunto serve
  // tanto para o consolidado quanto para o comparativo entre projetos.
  const finance = useFinanceTotals(period);

  const cards = useRecords<CardRow>({
    table: "cards",
    columns: "id, done, archived, created_at, due_date, board_id",
    orgId: orgId ?? null,
    orderBy: { column: "created_at", ascending: false },
    label: "cartão",
  });

  const boards = useRecords<BoardRow>({
    table: "boards",
    columns: "id, project_id",
    orgId: orgId ?? null,
    label: "quadro",
  });

  const goals = useRecords<GoalRow>({
    table: "goals",
    columns: "id, title, target, current_source, note, period_start, due_date, project_id",
    orgId: orgId ?? null,
    orderBy: { column: "title", ascending: true },
    label: "meta",
  });

  const byScope = <T extends { project_id?: string | null }>(rows: T[]): T[] =>
    scopedProject ? rows.filter((r) => r.project_id === scopedProject) : rows;

  const months = useMemo(() => lastMonths(12), []);
  const yearRange = useMemo<Period>(
    () => ({ from: `${months[0]}-01`, to: `${months[months.length - 1]}-31` }),
    [months],
  );

  const yearEntries = useMemo(
    () =>
      entriesInRange(finance.allEntries, finance.fixedRows, yearRange.from, yearRange.to).filter(
        (e) => (scopedProject ? e.project_id === scopedProject : true),
      ),
    [finance.allEntries, finance.fixedRows, yearRange, scopedProject],
  );

  const chartData = useMemo(() => monthlySeries(yearEntries, months), [yearEntries, months]);

  const periodEntries = useMemo(
    () =>
      finance.periodEntries.filter((e) => (scopedProject ? e.project_id === scopedProject : true)),
    [finance.periodEntries, scopedProject],
  );

  const prev = useMemo(() => previousPeriod(period), [period]);
  const prevEntries = useMemo(
    () =>
      entriesInRange(finance.allEntries, finance.fixedRows, prev.from, prev.to).filter((e) =>
        scopedProject ? e.project_id === scopedProject : true,
      ),
    [finance.allEntries, finance.fixedRows, prev, scopedProject],
  );

  const current = useMemo(() => totals(periodEntries), [periodEntries]);
  const previous = useMemo(() => totals(prevEntries), [prevEntries]);

  const hint = "vs. período anterior";

  const perProject = useMemo(() => {
    const bucket = new Map<string, DisplayEntry[]>();
    for (const e of finance.periodEntries) {
      const id = e.project_id ?? "sem";
      bucket.set(id, [...(bucket.get(id) ?? []), e]);
    }
    const rows = activeProjects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      ...totals(bucket.get(p.id) ?? []),
    }));
    const loose = bucket.get("sem") ?? [];
    if (loose.length > 0) {
      rows.push({ id: "sem", name: "Sem projeto", color: "var(--muted-foreground)", ...totals(loose) });
    }
    return rows;
  }, [finance.periodEntries, activeProjects]);

  const sortedProjects = useMemo(() => {
    const rows = [...perProject];
    rows.sort((a, b) => {
      const av = sort.column === "name" ? a.name : a[sort.column];
      const bv = sort.column === "name" ? b.name : b[sort.column];
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : Number(av) - Number(bv);
      return sort.asc ? cmp : -cmp;
    });
    return rows;
  }, [perProject, sort]);

  const projectsTotal = useMemo(() => totals(finance.periodEntries), [finance.periodEntries]);

  const cardStats = useMemo(() => {
    // Cartão herda o projeto do quadro (cards não tem project_id).
    const boardProject = new Map(boards.rows.map((b) => [b.id, b.project_id ?? null]));
    const rows = cards.rows
      .filter((c) => !c.archived)
      .filter((c) => (scopedProject ? boardProject.get(c.board_id) === scopedProject : true));
    const inPeriod = rows.filter(
      (c) => c.created_at.slice(0, 10) >= period.from && c.created_at.slice(0, 10) <= period.to,
    );
    const done = inPeriod.filter((c) => c.done).length;
    return { done, open: inPeriod.length - done, total: inPeriod.length };
  }, [cards.rows, boards.rows, scopedProject, period]);

  const goalStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = byScope(goals.rows).filter(
      (g) => !g.due_date || g.due_date >= today,
    );
    if (rows.length === 0) return { count: 0, average: 0 };
    const sum = rows.reduce(
      (acc, g) => acc + goalPercent({ ...g, target: Number(g.target) }, finance.entries.rows),
      0,
    );
    return { count: rows.length, average: sum / rows.length };
  }, [goals.rows, scopedProject, finance.entries.rows]);

  const navigate = useNavigate();
  const { setProjectId } = useCurrentProject();

  function openProject(id: string) {
    if (id !== "sem") setProjectId(id);
    void navigate({ to: "/dinheiro" });
  }

  const loading = loadingOrg || finance.isLoading || cards.isLoading || boards.isLoading || goals.isLoading;
  const error = finance.error || cards.error || boards.error || goals.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="A visão de cima: 12 meses de dinheiro, comparativo entre projetos e panorama operacional."
      />

      <div className="space-y-3">
        <SelectPillGroup>
          <SelectPill active={scope === "atual"} onClick={() => setScope("atual")}>
            {project ? `Projeto: ${project.name}` : "Projeto atual"}
          </SelectPill>
          <SelectPill active={scope === "todos"} onClick={() => setScope("todos")}>
            Todos os projetos (consolidado)
          </SelectPill>
        </SelectPillGroup>
        <PeriodPicker
          value={key}
          onChange={setKey}
          custom={custom}
          onCustomChange={setCustom}
          options={["mes", "trimestre", "ano", "custom"]}
        />
      </div>

      {loading ? (
        <LoadingState message="Somando os números do período…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => void finance.refetch()} />
      ) : (
        <>
          <AppCard className="space-y-4">
            <div>
              <h2 className="text-highlight font-semibold">Últimos 12 meses</h2>
              <p className="text-label text-muted-foreground">
                Entradas, saídas e líquido por mês. Toque na legenda para ligar ou desligar uma série.
              </p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    width={72}
                    tickFormatter={(v: number) => formatMoney(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                      fontSize: 14,
                    }}
                    formatter={(v: number | string) => formatMoney(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="liquido"
                    name="Líquido"
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </AppCard>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TotalCard
              label="Entrou"
              value={formatMoney(current.entrou)}
              delta={pctDelta(current.entrou, previous.entrou, hint)}
            />
            <TotalCard
              label="Saiu"
              value={formatMoney(current.saiu)}
              delta={pctDelta(current.saiu, previous.saiu, hint)}
            />
            <TotalCard
              label="Sobrou"
              value={formatMoney(current.sobrou)}
              delta={pctDelta(current.sobrou, previous.sobrou, hint)}
            />
            <TotalCard
              label="Margem"
              value={`${current.margem.toFixed(1)}%`}
              delta={ppDelta(current.margem, previous.margem, hint)}
            />
          </div>

          {scope === "todos" && (
            <AppCard className="space-y-3">
              <div>
                <h2 className="text-highlight font-semibold">Comparativo entre projetos</h2>
                <p className="text-label text-muted-foreground">
                  Toque no cabeçalho para ordenar; toque na linha para abrir o Dinheiro do projeto.
                </p>
              </div>
              {perProject.length === 0 ? (
                <EmptyState
                  title="Nenhum projeto para comparar"
                  message="Crie projetos e lance movimentos para ver o comparativo aqui."
                  icon={<BarChart3 className="size-5" aria-hidden />}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-body">
                    <thead>
                      <tr className="text-label text-muted-foreground">
                        {(
                          [
                            ["name", "Projeto", "left"],
                            ["entrou", "Entrou", "right"],
                            ["saiu", "Saiu", "right"],
                            ["sobrou", "Sobrou", "right"],
                            ["margem", "Margem", "right"],
                          ] as [SortKey, string, "left" | "right"][]
                        ).map(([col, label, align]) => (
                          <th key={col} className={align === "left" ? "py-2 text-left" : "py-2 text-right"}>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={() =>
                                setSort((s) =>
                                  s.column === col ? { column: col, asc: !s.asc } : { column: col, asc: false },
                                )
                              }
                            >
                              {label}
                              {sort.column === col &&
                                (sort.asc ? (
                                  <ArrowUp className="size-3" aria-hidden />
                                ) : (
                                  <ArrowDown className="size-3" aria-hidden />
                                ))}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProjects.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-t border-border hover:bg-muted/50"
                          onClick={() => openProject(row.id)}
                        >
                          <td className="py-2">
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: row.color }}
                                aria-hidden
                              />
                              <span className="truncate">{row.name}</span>
                            </span>
                          </td>
                          <td className="py-2 text-right">{formatMoney(row.entrou)}</td>
                          <td className="py-2 text-right">{formatMoney(row.saiu)}</td>
                          <td className="py-2 text-right">{formatMoney(row.sobrou)}</td>
                          <td className="py-2 text-right">{row.margem.toFixed(1)}%</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border font-semibold">
                        <td className="py-2">Total</td>
                        <td className="py-2 text-right">{formatMoney(projectsTotal.entrou)}</td>
                        <td className="py-2 text-right">{formatMoney(projectsTotal.saiu)}</td>
                        <td className="py-2 text-right">{formatMoney(projectsTotal.sobrou)}</td>
                        <td className="py-2 text-right">{projectsTotal.margem.toFixed(1)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </AppCard>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <AppCard className="space-y-3">
              <h2 className="text-highlight font-semibold">Cartões do período</h2>
              {cardStats.total === 0 ? (
                <p className="text-body text-muted-foreground">
                  Nenhum cartão criado neste período.
                </p>
              ) : (
                <>
                  <p className="text-body text-muted-foreground">
                    <span className="text-title font-semibold text-foreground">{cardStats.done}</span>{" "}
                    concluídos de {cardStats.total} — {cardStats.open} em aberto
                  </p>
                  <Progress value={(cardStats.done / cardStats.total) * 100} />
                </>
              )}
              <p className="text-label text-muted-foreground">
                <Link to="/trabalho" className="underline">
                  Ver no Trabalho
                </Link>
              </p>
            </AppCard>

            <AppCard className="space-y-3">
              <h2 className="text-highlight font-semibold">Metas ativas</h2>
              {goalStats.count === 0 ? (
                <p className="text-body text-muted-foreground">Nenhuma meta ativa por aqui.</p>
              ) : (
                <>
                  <p className="text-body text-muted-foreground">
                    <span className="text-title font-semibold text-foreground">
                      {goalStats.average.toFixed(0)}%
                    </span>{" "}
                    de progresso médio em {goalStats.count} meta(s)
                  </p>
                  <Progress value={goalStats.average} />
                </>
              )}
              <p className="text-label text-muted-foreground">
                <Link to="/metas" className="underline">
                  Ver nas Metas
                </Link>
              </p>
            </AppCard>
          </div>
        </>
      )}
    </div>
  );
}
