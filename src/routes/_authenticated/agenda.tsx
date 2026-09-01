import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Flag, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ConfirmDialog,
  RecordPanel,
  type FieldDef,
  type FieldValue,
} from "@/components/detail-panel";
import {
  PeriodPicker,
  toISODate,
  usePeriodPicker,
  type Period,
} from "@/components/period-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRecords } from "@/hooks/use-records";
import { useOrgId, useUserId } from "@/hooks/use-org";
import { ITEM_COLORS, colorSwatch } from "@/lib/board";
import { formatDate, formatMoney } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda | EuroHub" },
      {
        name: "description",
        content:
          "Tarefas, prazos e recados da empresa em uma agenda só, junto com os prazos dos cartões e as saídas previstas.",
      },
      { property: "og:title", content: "Agenda | EuroHub" },
      {
        property: "og:description",
        content:
          "Tarefas, prazos e recados da empresa em uma agenda só, junto com os prazos dos cartões e as saídas previstas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Agenda,
});

type View = "lista" | "semana" | "mes";

type AgendaRow = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  kind: string;
  note: string;
  color: string;
  done: boolean;
  assignee_id: string | null;
  created_by?: string | null;
};

type CardRow = { id: string; board_id: string; title: string; due_date: string | null; done: boolean };
type BoardRow = { id: string; name: string };
type EntryRow = { id: string; entry_date: string; description: string; kind: string; amount: number };

type Values = Record<string, FieldValue>;

/** Item mostrado na agenda: da própria agenda (editável) ou de outro módulo (leitura). */
type AgendaDisplay = {
  id: string;
  date: string;
  time: string | null;
  title: string;
  meta: string;
  kind: "tarefa" | "prazo" | "recado";
  color: string;
  done: boolean;
  origin: "agenda" | "card" | "finance";
  sourceId: string;
};

const KIND_OPTIONS = [
  { value: "tarefa", label: "Tarefa" },
  { value: "prazo", label: "Prazo" },
  { value: "recado", label: "Recado" },
];

const KIND_ICON = { tarefa: CalendarDays, prazo: Flag, recado: Megaphone } as const;

const AGENDA_FIELDS: FieldDef[] = [
  { name: "title", label: "Título", type: "text" },
  { name: "kind", label: "Tipo", type: "choice", options: KIND_OPTIONS },
  { name: "date", label: "Data", type: "date" },
  { name: "time", label: "Hora (opcional)", type: "text", placeholder: "14:30" },
  { name: "note", label: "Observação", type: "textarea" },
  {
    name: "color",
    label: "Cor",
    type: "choice",
    options: ITEM_COLORS.map((c) => ({ value: c.value, label: c.label })),
  },
  { name: "done", label: "Concluído", type: "switch" },
];

function emptyValues(date: string): Values {
  return { title: "", kind: "tarefa", date, time: "", note: "", color: "principal", done: false };
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function weekRange(today: Date): Period {
  const day = (today.getDay() + 6) % 7; // segunda = 0
  const from = new Date(today);
  from.setDate(from.getDate() - day);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from: toISODate(from), to: toISODate(to) };
}

function monthRange(today: Date): Period {
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: toISODate(from), to: toISODate(to) };
}

function eachDay(period: Period) {
  const out: string[] = [];
  if (!period.from || !period.to || period.from > period.to) return out;
  let cursor = period.from;
  let guard = 0;
  while (cursor <= period.to && guard < 400) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

function Agenda() {
  const today = toISODate(new Date());
  const { data: orgId, isLoading: loadingOrg } = useOrgId();
  const perms = usePermissions();
  const { data: userId } = useUserId();
  const [view, setView] = useState<View>("lista");
  const listPeriod = usePeriodPicker("mes");

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(() => emptyValues(today));
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const period = useMemo<Period>(() => {
    const now = new Date();
    if (view === "semana") return weekRange(now);
    if (view === "mes") return monthRange(now);
    return listPeriod.period;
  }, [view, listPeriod.period]);

  const agenda = useRecords<AgendaRow>({
    table: "agenda_items",
    columns: "id, title, date, time, kind, note, color, done, assignee_id, created_by",
    orgId: orgId ?? null,
    orderBy: { column: "date", ascending: true },
    trackCreatedBy: true,
    label: "item",
  });

  const cards = useRecords<CardRow>({
    table: "cards",
    columns: "id, board_id, title, due_date, done",
    orgId: orgId ?? null,
    orderBy: { column: "due_date", ascending: true },
    label: "cartão",
  });

  const boards = useRecords<BoardRow>({
    table: "boards",
    columns: "id, name",
    orgId: orgId ?? null,
    orderBy: { column: "name", ascending: true },
    label: "quadro",
  });

  const entries = useRecords<EntryRow>({
    table: "finance_entries",
    columns: "id, entry_date, description, kind, amount",
    orgId: orgId ?? null,
    orderBy: { column: "entry_date", ascending: true },
    label: "lançamento",
  });

  const boardName = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of boards.rows) map.set(b.id, b.name);
    return map;
  }, [boards.rows]);

  const items = useMemo<AgendaDisplay[]>(() => {
    const inRange = (d: string | null) => !!d && d >= period.from && d <= period.to;
    const own: AgendaDisplay[] = agenda.rows.filter((r) => inRange(r.date)).map((r) => ({
      id: `agenda:${r.id}`,
      date: r.date,
      time: r.time,
      title: r.title,
      meta: r.note || "",
      kind: (r.kind === "prazo" ? "prazo" : r.kind === "recado" ? "recado" : "tarefa"),
      color: r.color,
      done: r.done,
      origin: "agenda",
      sourceId: r.id,
    }));

    const fromCards: AgendaDisplay[] = cards.rows
      .filter((c) => inRange(c.due_date))
      .map((c) => ({
        id: `card:${c.id}`,
        date: c.due_date as string,
        time: null,
        title: c.title,
        meta: `Trabalho · ${boardName.get(c.board_id) ?? "quadro"}`,
        kind: "prazo" as const,
        color: "principal",
        done: c.done,
        origin: "card" as const,
        sourceId: c.id,
      }));

    const fromFinance: AgendaDisplay[] = entries.rows
      .filter((e) => e.kind === "saida" && inRange(e.entry_date))
      .map((e) => ({
        id: `finance:${e.id}`,
        date: e.entry_date,
        time: null,
        title: e.description || "Saída",
        meta: `Dinheiro · ${formatMoney(Number(e.amount))}`,
        kind: "prazo" as const,
        color: "alerta",
        done: false,
        origin: "finance" as const,
        sourceId: e.id,
      }));

    return [...own, ...fromCards, ...fromFinance].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
    );
  }, [agenda.rows, cards.rows, entries.rows, boardName, period.from, period.to]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaDisplay[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const loading = loadingOrg || agenda.isLoading;
  const failed = agenda.error || cards.error || entries.error;

  function openNew(date: string) {
    setEditingId(undefined);
    setValues(emptyValues(date));
    setPanelOpen(true);
  }

  function openEdit(item: AgendaDisplay) {
    const row = agenda.rows.find((r) => r.id === item.sourceId);
    if (!row) return;
    setEditingId(row.id);
    setValues({
      title: row.title,
      kind: row.kind,
      date: row.date,
      time: row.time ?? "",
      note: row.note,
      color: row.color,
      done: row.done,
    });
    setPanelOpen(true);
  }

  function save() {
    const title = String(values['title'] ?? "").trim();
    if (!title) {
      toast.error("Informe o título do item.");
      return;
    }
    const time = String(values['time'] ?? "").trim();
    agenda.save.mutate(
      {
        id: editingId,
        values: {
          title,
          kind: String(values['kind'] ?? "tarefa"),
          date: String(values['date'] ?? today),
          time: time || null,
          note: String(values['note'] ?? ""),
          color: String(values['color'] ?? "principal"),
          done: Boolean(values['done']),
          assignee_id: userId ?? null,
        },
      },
      { onSuccess: () => setPanelOpen(false) },
    );
  }

  function toggleDone(item: AgendaDisplay, done: boolean) {
    if (item.origin !== "agenda") return;
    agenda.update.mutate({ id: item.sourceId, values: { done } });
  }

  function moveToDay(date: string) {
    if (!dragId) return;
    agenda.update.mutate({ id: dragId, values: { date } });
    setDragId(null);
  }

  function itemLink(item: AgendaDisplay) {
    if (item.origin === "card") {
      return (
        <Link
          to="/trabalho"
          search={{ cartao: item.sourceId }}
          className="text-label text-primary underline"
        >
          abrir no Trabalho
        </Link>
      );
    }
    if (item.origin === "finance") {
      return (
        <Link
          to="/dinheiro"
          search={{ periodo: "custom", de: item.date, ate: item.date }}
          className="text-label text-primary underline"
        >
          abrir no Dinheiro
        </Link>
      );
    }
    return null;
  }

  function renderItem(item: AgendaDisplay) {
    const Icon = KIND_ICON[item.kind];
    const own = agenda.rows.find((r) => r.id === item.sourceId);
    const editable = item.origin === "agenda" && perms.canWrite;
    return (
      <li
        key={item.id}
        draggable={editable}
        onDragStart={() => editable && setDragId(item.sourceId)}
        className="flex flex-wrap items-center gap-3 py-2"
      >
        <span className={cn("size-2 shrink-0 rounded-full", colorSwatch(item.color))} aria-hidden />
        <Checkbox
          checked={item.done}
          disabled={!editable}
          aria-label="Marcar concluído"
          onCheckedChange={(v) => toggleDone(item, Boolean(v))}
        />
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-40 flex-1">
          <p className={cn("text-body font-medium", item.done && "text-muted-foreground line-through")}>
            {item.title}
          </p>
          <p className="text-label text-muted-foreground">
            {[item.time ?? "", item.meta].filter(Boolean).join(" · ") || KIND_LABEL[item.kind]}
          </p>
        </div>
        {itemLink(item)}
        {item.origin === "agenda" && (
          <div className="flex items-center gap-1">
            {perms.canWrite && (
              <Button variant="ghost" size="icon" aria-label="Editar item" onClick={() => openEdit(item)}>
                <Pencil className="size-4" aria-hidden />
              </Button>
            )}
            {perms.canDelete(own?.created_by ?? null) && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir item"
                onClick={() => setToDelete(item.sourceId)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        )}
      </li>
    );
  }

  const days = eachDay(period);

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Tarefas, prazos e recados — junto com os prazos do Trabalho e as saídas do Dinheiro."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={() => openNew(today)}>
              <Plus className="size-4" aria-hidden /> Novo item
            </Button>
          ) : undefined
        }
      />

      <SelectPillGroup>
        <SelectPill active={view === "lista"} onClick={() => setView("lista")}>
          Lista
        </SelectPill>
        <SelectPill active={view === "semana"} onClick={() => setView("semana")}>
          Semana
        </SelectPill>
        <SelectPill active={view === "mes"} onClick={() => setView("mes")}>
          Mês
        </SelectPill>
      </SelectPillGroup>

      {view === "lista" && (
        <AppCard title="Período" subtitle="Escolha o intervalo dos itens abaixo.">
          <PeriodPicker
            value={listPeriod.key}
            onChange={listPeriod.setKey}
            custom={listPeriod.custom}
            onCustomChange={listPeriod.setCustom}
          />
        </AppCard>
      )}

      <AppCard
        title={
          view === "lista" ? "Itens do período" : view === "semana" ? "Esta semana" : "Este mês"
        }
        subtitle="Arraste um item da agenda para outro dia. Itens de outros módulos são só leitura."
      >
        {loading ? (
          <LoadingState />
        ) : failed ? (
          <ErrorState onRetry={agenda.refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nada na agenda"
            message="Ainda não há nada aqui neste período. Prazos de cartões e saídas do Dinheiro aparecem automaticamente."
            icon={<CalendarDays className="size-5" aria-hidden />}
            action={
              perms.canWrite ? (
                <Button className="text-body" onClick={() => openNew(today)}>
                  Novo item
                </Button>
              ) : undefined
            }
          />
        ) : view === "mes" ? (
          <div className="grid gap-2 sm:grid-cols-7">
            {days.map((day) => (
              <div
                key={day}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => moveToDay(day)}
                className={cn(
                  "min-h-24 rounded-md border border-border p-2",
                  day === today && "border-primary",
                )}
              >
                <button
                  type="button"
                  className="text-label w-full text-left text-muted-foreground"
                  onClick={() => openNew(day)}
                >
                  {day.slice(8, 10)}/{day.slice(5, 7)}
                </button>
                <ul className="mt-1 space-y-1">
                  {(byDay.get(day) ?? []).map((item) => (
                    <li
                      key={item.id}
                      draggable={item.origin === "agenda"}
                      onDragStart={() => item.origin === "agenda" && setDragId(item.sourceId)}
                      className="flex items-center gap-1"
                    >
                      <span
                        className={cn("size-2 shrink-0 rounded-full", colorSwatch(item.color))}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "text-label truncate",
                          item.done && "text-muted-foreground line-through",
                        )}
                      >
                        {item.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {days
              .filter((day) => view === "semana" || (byDay.get(day) ?? []).length > 0)
              .map((day) => (
                <div
                  key={day}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => moveToDay(day)}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className={cn("text-label font-semibold", day === today && "text-primary")}>
                      {formatDate(day)}
                      {day === today ? " · hoje" : ""}
                    </p>
                    {perms.canWrite && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-label"
                        onClick={() => openNew(day)}
                      >
                        <Plus className="size-4" aria-hidden /> Item
                      </Button>
                    )}
                  </div>
                  <ul className="divide-y divide-border">
                    {(byDay.get(day) ?? []).map((item) => renderItem(item))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </AppCard>

      <RecordPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={editingId ? "Editar item" : "Novo item da agenda"}
        description="Tarefa, prazo ou recado da empresa."
        fields={AGENDA_FIELDS}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        onSave={save}
        saving={agenda.save.isPending}
        idPrefix="ag"
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir item?"
        description="Ele sai da agenda, mas o histórico fica guardado."
        confirmLabel="Excluir"
        onConfirm={() =>
          toDelete && agenda.remove.mutate(toDelete, { onSuccess: () => setToDelete(null) })
        }
      />
    </>
  );
}

const KIND_LABEL: Record<string, string> = {
  tarefa: "Tarefa",
  prazo: "Prazo",
  recado: "Recado",
};
