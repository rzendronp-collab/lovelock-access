import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CircleCheck, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TotalCard, type Delta } from "@/components/total-card";
import { LinkList, type LinkListItem } from "@/components/link-list";
import { useFinanceTotals } from "@/hooks/use-finance-totals";
import { useRecords } from "@/hooks/use-records";
import { useOrgId } from "@/hooks/use-org";
import { colorSwatch, formatDateBR, inDays, todayISO } from "@/lib/board";
import { formatMoney } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel de hoje | EuroHub" },
      {
        name: "description",
        content:
          "Resumo do dia no EuroHub: números do mês, prazos da semana e o que está travado.",
      },
      { property: "og:title", content: "Painel de hoje | EuroHub" },
      {
        property: "og:description",
        content:
          "Resumo do dia no EuroHub: números do mês, prazos da semana e o que está travado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

type BoardRow = { id: string; name: string; folder: string };

type CardRow = {
  id: string;
  board_id: string;
  title: string;
  due_date: string | null;
  color: string;
  done: boolean;
  archived: boolean;
};

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = todayISO();
  const to = iso(end);
  return { from: iso(start), to: offset === 0 && today < to ? today : to };
}

function pctDelta(current: number, previous: number, hint: string): Delta | undefined {
  if (!previous) return undefined;
  const value = ((current - previous) / Math.abs(previous)) * 100;
  return { value, text: `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`, hint };
}

function ppDelta(current: number, previous: number, hint: string): Delta {
  const value = current - previous;
  return { value, text: `${value >= 0 ? "+" : ""}${value.toFixed(1)} p.p.`, hint };
}

function Painel() {
  const thisMonth = useMemo(() => monthRange(0), []);
  const lastMonth = useMemo(() => monthRange(-1), []);

  const current = useFinanceTotals(thisMonth);
  const previous = useFinanceTotals(lastMonth);

  const { data: orgId } = useOrgId();

  const membership = useQuery({
    queryKey: ["membership"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const id = userData.user?.id;
      if (!id) return null;
      const { data, error } = await supabase
        .from("memberships")
        .select("role, organizations(name)")
        .eq("user_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const boards = useRecords<BoardRow>({
    table: "boards",
    columns: "id, name, folder",
    orgId: orgId ?? null,
    orderBy: { column: "name", ascending: true },
    label: "quadro",
  });

  const cards = useRecords<CardRow>({
    table: "cards",
    columns: "id, board_id, title, due_date, color, done, archived",
    orgId: orgId ?? null,
    orderBy: { column: "due_date", ascending: true },
    label: "cartão",
  });

  const boardName = (id: string) => boards.rows.find((b) => b.id === id)?.name ?? "sem quadro";

  const today = todayISO();
  const weekEnd = inDays(7);

  const upcoming = useMemo<LinkListItem[]>(
    () =>
      cards.rows
        .filter(
          (c) =>
            !c.archived &&
            !c.done &&
            c.due_date &&
            c.due_date >= today &&
            c.due_date <= weekEnd,
        )
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
        .map((c) => ({
          id: c.id,
          title: c.title,
          meta: boardName(c.board_id),
          trailing: c.due_date === today ? "hoje" : formatDateBR(c.due_date),
          markerClassName: colorSwatch(c.color),
          link: { to: "/trabalho", search: { cartao: c.id } },
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards.rows, boards.rows, today, weekEnd],
  );

  const stuck = useMemo<LinkListItem[]>(() => {
    const lateCards: LinkListItem[] = cards.rows
      .filter((c) => !c.archived && !c.done && c.due_date && c.due_date < today)
      .map((c) => ({
        id: `card-${c.id}`,
        title: c.title,
        meta: `Cartão atrasado · ${boardName(c.board_id)}`,
        trailing: formatDateBR(c.due_date),
        markerClassName: "bg-destructive",
        link: { to: "/trabalho", search: { cartao: c.id } },
      }));

    const lateReceivables: LinkListItem[] = current.allEntries
      .filter((e) => e.kind === "entrada" && !e.received && e.entry_date < today)
      .map((e) => ({
        id: `entry-${e.id}`,
        title: e.description || "Lançamento a receber",
        meta: `A receber vencido · ${e.category || "sem categoria"}`,
        trailing: `${formatMoney(e.amount)} · ${formatDateBR(e.entry_date)}`,
        markerClassName: "bg-destructive",
        link: {
          to: "/dinheiro",
          search: {
            periodo: "custom" as const,
            de: e.entry_date,
            ate: today,
            busca: e.description,
          },
        },
      }));

    return [...lateCards, ...lateReceivables].sort((a, b) => a.title.localeCompare(b.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.rows, boards.rows, current.allEntries, today]);

  const t = current.totals;
  const p = previous.totals;
  const hint = "vs. mês anterior";
  const boardLoading = cards.isLoading || boards.isLoading;

  return (
    <>
      <PageHeader
        title="Painel de hoje"
        subtitle="Os números do mês, os prazos da semana e o que está travado."
      />

      <AppCard title="Sua empresa" subtitle="Dados do seu vínculo atual">
        {membership.isLoading ? (
          <LoadingState />
        ) : membership.error ? (
          <ErrorState
            message="Não foi possível carregar sua empresa."
            onRetry={() => void membership.refetch()}
          />
        ) : membership.data ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-highlight font-semibold">
              {membership.data.organizations?.name}
            </span>
            <span className="text-label rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
              {membership.data.role}
            </span>
          </div>
        ) : (
          <EmptyState
            title="Sem empresa vinculada"
            message="Ainda não há nada aqui. Nenhuma empresa está ligada à sua conta."
          />
        )}
      </AppCard>

      <AppCard
        title="Este mês"
        subtitle="Mesmos números do módulo Dinheiro, comparados ao mês anterior."
      >
        {current.isLoading ? (
          <LoadingState />
        ) : current.error ? (
          <ErrorState onRetry={current.refetch} />
        ) : (
          <Link
            to="/dinheiro"
            search={{ periodo: "mes" as const }}
            aria-label="Abrir o módulo Dinheiro no mês atual"
            className="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TotalCard
                label="Entrou"
                value={formatMoney(t.entrou)}
                delta={pctDelta(t.entrou, p.entrou, hint)}
              />
              <TotalCard
                label="Saiu"
                value={formatMoney(t.saiu)}
                delta={pctDelta(t.saiu, p.saiu, hint)}
              />
              <TotalCard
                label="Sobrou"
                value={formatMoney(t.sobrou)}
                delta={pctDelta(t.sobrou, p.sobrou, hint)}
              />
              <TotalCard
                label="Margem"
                value={`${t.margem.toFixed(1)}%`}
                delta={ppDelta(t.margem, p.margem, hint)}
              />
            </div>
          </Link>
        )}
      </AppCard>

      <AppCard
        title="Prazos de hoje e da semana"
        subtitle="Cartões com prazo nos próximos 7 dias."
      >
        {boardLoading ? (
          <LoadingState />
        ) : cards.error || boards.error ? (
          <ErrorState onRetry={cards.refetch} />
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="Nenhum prazo por aqui"
            message="Ainda não há nada aqui. Prazos de cartões do módulo Trabalho aparecem nesta lista automaticamente."
            icon={<CalendarClock className="size-5" aria-hidden />}
          />
        ) : (
          <LinkList items={upcoming} />
        )}
      </AppCard>

      <AppCard
        title="O que está travado"
        subtitle="Cartões atrasados e lançamentos a receber vencidos."
      >
        {boardLoading || current.isLoading ? (
          <LoadingState />
        ) : cards.error || current.error ? (
          <ErrorState onRetry={cards.refetch} />
        ) : stuck.length === 0 ? (
          <EmptyState
            title="Nada travado — tudo em dia"
            message="Nenhum cartão atrasado e nenhum valor a receber vencido."
            icon={<CircleCheck className="size-5" aria-hidden />}
          />
        ) : (
          <LinkList items={stuck} />
        )}
      </AppCard>

      <AppCard>
        <p className="text-label text-muted-foreground">Atalho</p>
        <Link
          to="/dinheiro"
          search={{ periodo: "mes" as const }}
          className="text-body flex items-center gap-2 font-medium hover:underline"
        >
          <Wallet className="size-4" aria-hidden /> Abrir o módulo Dinheiro no mês atual
        </Link>
      </AppCard>
    </>
  );
}
