import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ConfirmDialog,
  RecordPanel,
  type FieldDef,
  type FieldValue,
} from "@/components/detail-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRecords } from "@/hooks/use-records";
import { useOrgId, usePermissions } from "@/hooks/use-org";
import { ITEM_COLORS, colorSwatch, formatDateBR } from "@/lib/board";
import { formatMoney } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas | EuroHub" },
      {
        name: "description",
        content:
          "Metas da empresa por trimestre ou frente, com progresso automático puxado do financeiro.",
      },
      { property: "og:title", content: "Metas | EuroHub" },
      {
        property: "og:description",
        content:
          "Metas da empresa por trimestre ou frente, com progresso automático puxado do financeiro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Metas,
});

type GoalRow = {
  id: string;
  title: string;
  group_name: string;
  target: number;
  current_source: string;
  unit: string;
  due_date: string | null;
  period_start: string;
  color: string;
  note: string;
  created_by?: string | null;
};

type GoalTaskRow = { id: string; goal_id: string; text: string; done: boolean; card_id: string | null };

type CardRow = { id: string; title: string };

type EntryRow = { id: string; entry_date: string; kind: string; amount: number; received: boolean };

type Values = Record<string, FieldValue>;

const GOAL_FIELDS: FieldDef[] = [
  { name: "title", label: "Título", type: "text" },
  { name: "group_name", label: "Agrupamento (trimestre / frente)", type: "text", placeholder: "Ex.: 3º trimestre" },
  { name: "target", label: "Número-alvo", type: "decimal" },
  {
    name: "unit",
    label: "Unidade",
    type: "choice",
    options: [
      { value: "R$", label: "R$" },
      { value: "%", label: "%" },
      { value: "unidade", label: "Unidade" },
    ],
  },
  {
    name: "current_source",
    label: "Progresso",
    type: "choice",
    options: [
      { value: "manual", label: "Digitado à mão" },
      { value: "finance_entries", label: "Puxar do financeiro" },
    ],
  },
  {
    name: "manual_current",
    label: "Progresso atual",
    type: "decimal",
    showWhen: (v) => v['current_source'] === "manual",
  },
  { name: "period_start", label: "Início do período", type: "date" },
  { name: "due_date", label: "Prazo", type: "date" },
  {
    name: "color",
    label: "Cor",
    type: "choice",
    options: ITEM_COLORS.map((c) => ({ value: c.value, label: c.label })),
  },
  { name: "note", label: "Observação", type: "textarea" },
];

function emptyValues(): Values {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: "",
    group_name: "",
    target: "",
    unit: "R$",
    current_source: "manual",
    manual_current: "0",
    period_start: today,
    due_date: "",
    color: "principal",
    note: "",
  };
}

function toNumber(value: FieldValue | undefined) {
  return Number(String(value ?? "").replace(",", ".")) || 0;
}

/** O progresso manual mora na observação em uma linha própria, para não exigir coluna nova. */
const MANUAL_TAG = "progresso:";

function readManual(note: string) {
  const line = note.split("\n").find((l) => l.startsWith(MANUAL_TAG));
  return line ? Number(line.slice(MANUAL_TAG.length)) || 0 : 0;
}

function writeManual(note: string, current: number) {
  const rest = note
    .split("\n")
    .filter((l) => !l.startsWith(MANUAL_TAG))
    .join("\n");
  return `${MANUAL_TAG}${current}${rest ? `\n${rest}` : ""}`;
}

function readNote(note: string) {
  return note
    .split("\n")
    .filter((l) => !l.startsWith(MANUAL_TAG))
    .join("\n");
}

function formatValue(value: number, unit: string) {
  if (unit === "R$") return formatMoney(value);
  if (unit === "%") return `${value.toFixed(1)}%`;
  return String(value);
}

function Metas() {
  const { data: orgId, isLoading: loadingOrg } = useOrgId();
  const perms = usePermissions();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(emptyValues);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const goals = useRecords<GoalRow>({
    table: "goals",
    columns:
      "id, title, group_name, target, current_source, unit, due_date, period_start, color, note, created_by",
    orgId: orgId ?? null,
    orderBy: { column: "created_at", ascending: false },
    trackCreatedBy: true,
    label: "meta",
  });

  const tasks = useRecords<GoalTaskRow>({
    table: "goal_tasks",
    columns: "id, goal_id, text, done, card_id",
    orderBy: { column: "created_at", ascending: true },
    softDelete: false,
    label: "tarefa",
  });

  const cards = useRecords<CardRow>({
    table: "cards",
    columns: "id, title",
    orgId: orgId ?? null,
    orderBy: { column: "title", ascending: true },
    label: "cartão",
  });

  const entries = useRecords<EntryRow>({
    table: "finance_entries",
    columns: "id, entry_date, kind, amount, received",
    orgId: orgId ?? null,
    orderBy: { column: "entry_date", ascending: false },
    label: "lançamento",
  });

  /** Progresso puxado do financeiro: entradas recebidas dentro do período da meta. */
  function financeProgress(goal: GoalRow) {
    return entries.rows
      .filter((e) => e.kind === "entrada" && e.received)
      .filter((e) => e.entry_date >= goal.period_start)
      .filter((e) => !goal.due_date || e.entry_date <= goal.due_date)
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }

  function currentOf(goal: GoalRow) {
    return goal.current_source === "finance_entries" ? financeProgress(goal) : readManual(goal.note);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, GoalRow[]>();
    for (const g of goals.rows) {
      const key = g.group_name || "Sem agrupamento";
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [goals.rows]);

  function openNew() {
    setEditingId(undefined);
    setValues(emptyValues());
    setPanelOpen(true);
  }

  function openEdit(goal: GoalRow) {
    setEditingId(goal.id);
    setValues({
      title: goal.title,
      group_name: goal.group_name,
      target: String(goal.target),
      unit: goal.unit,
      current_source: goal.current_source,
      manual_current: String(readManual(goal.note)),
      period_start: goal.period_start ?? "",
      due_date: goal.due_date ?? "",
      color: goal.color,
      note: readNote(goal.note),
    });
    setPanelOpen(true);
  }

  function save() {
    const title = String(values['title'] ?? "").trim();
    if (!title) {
      toast.error("Informe o título da meta.");
      return;
    }
    const source = String(values['current_source'] ?? "manual");
    const note = String(values['note'] ?? "");
    goals.save.mutate(
      {
        id: editingId,
        values: {
          title,
          group_name: String(values['group_name'] ?? "").trim(),
          target: toNumber(values['target']),
          unit: String(values['unit'] ?? "R$"),
          current_source: source,
          period_start: String(values['period_start'] ?? "") || null,
          due_date: String(values['due_date'] ?? "") || null,
          color: String(values['color'] ?? "principal"),
          note:
            source === "manual" ? writeManual(note, toNumber(values['manual_current'])) : note,
        },
      },
      { onSuccess: () => setPanelOpen(false) },
    );
  }

  function setManualProgress(goal: GoalRow, value: number) {
    goals.update.mutate({ id: goal.id, values: { note: writeManual(readNote(goal.note), value) } });
  }

  const loading = loadingOrg || goals.isLoading;

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle="Metas por trimestre ou frente, com progresso e tarefas."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={openNew}>
              <Plus className="size-4" aria-hidden /> Nova meta
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingState />
      ) : goals.error ? (
        <ErrorState onRetry={goals.refetch} />
      ) : goals.rows.length === 0 ? (
        <AppCard>
          <EmptyState
            title="Nenhuma meta"
            message="Ainda não há nada aqui. Crie uma meta e acompanhe o progresso."
            icon={<Target className="size-5" aria-hidden />}
            action={
              perms.canWrite ? (
                <Button className="text-body" onClick={openNew}>
                  Nova meta
                </Button>
              ) : undefined
            }
          />
        </AppCard>
      ) : (
        grouped.map(([group, list]) => (
          <AppCard key={group} title={group} subtitle={`${list.length} meta(s)`}>
            <div className="space-y-6">
              {list.map((goal) => {
                const current = currentOf(goal);
                const target = Number(goal.target) || 0;
                const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
                const goalTasks = tasks.rows.filter((t) => t.goal_id === goal.id);
                return (
                  <div key={goal.id} className="space-y-3 border-b border-border pb-5 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-40 flex-1">
                        <p className="text-body flex items-center gap-2 font-medium">
                          <span
                            className={cn("size-2.5 rounded-full", colorSwatch(goal.color))}
                            aria-hidden
                          />
                          {goal.title}
                        </p>
                        <p className="text-label text-muted-foreground">
                          {[
                            `${formatValue(current, goal.unit)} de ${formatValue(target, goal.unit)}`,
                            goal.current_source === "finance_entries"
                              ? "progresso automático do financeiro"
                              : "progresso manual",
                            goal.due_date
                              ? `período ${formatDateBR(goal.period_start)} até ${formatDateBR(goal.due_date)}`
                              : `a partir de ${formatDateBR(goal.period_start)}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {perms.canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar meta"
                            onClick={() => openEdit(goal)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        )}
                        {perms.canDelete(goal.created_by) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir meta"
                            onClick={() => setToDelete(goal.id)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Progress value={pct} />
                      <p className="text-label text-muted-foreground">{pct.toFixed(1)}% da meta</p>
                    </div>

                    {goal.current_source === "manual" && (
                      <div className="flex flex-wrap items-end gap-2">
                        <Input
                          className="text-body w-32"
                          inputMode="decimal"
                          aria-label="Progresso atual"
                          defaultValue={String(current)}
                          onBlur={(e) =>
                            setManualProgress(goal, Number(e.target.value.replace(",", ".")) || 0)
                          }
                        />
                        <span className="text-label text-muted-foreground">
                          atualize o número e saia do campo
                        </span>
                      </div>
                    )}

                    {readNote(goal.note) && (
                      <p className="text-label text-muted-foreground">{readNote(goal.note)}</p>
                    )}

                    <GoalTasks
                      goalId={goal.id}
                      rows={goalTasks}
                      cards={cards.rows}
                      onAdd={(text, cardId) =>
                        tasks.create.mutate({ goal_id: goal.id, text, card_id: cardId })
                      }
                      onToggle={(id, done) => tasks.update.mutate({ id, values: { done } })}
                      onRemove={(id) => tasks.remove.mutate(id)}
                    />
                  </div>
                );
              })}
            </div>
          </AppCard>
        ))
      )}

      <RecordPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={editingId ? "Editar meta" : "Nova meta"}
        description="Defina o alvo, a unidade e como o progresso é medido."
        fields={GOAL_FIELDS}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        onSave={save}
        saving={goals.save.isPending}
        idPrefix="meta"
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir meta?"
        description="A meta sai da lista, mas o histórico fica guardado."
        confirmLabel="Excluir"
        onConfirm={() =>
          toDelete && goals.remove.mutate(toDelete, { onSuccess: () => setToDelete(null) })
        }
      />
    </>
  );
}

function GoalTasks({
  goalId,
  rows,
  cards,
  onAdd,
  onToggle,
  onRemove,
}: {
  goalId: string;
  rows: GoalTaskRow[];
  cards: CardRow[];
  onAdd: (text: string, cardId: string | null) => void;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const perms = usePermissions();
  const [text, setText] = useState("");
  const [cardId, setCardId] = useState("");

  function add() {
    const value = text.trim();
    if (!value) return;
    onAdd(value, cardId || null);
    setText("");
    setCardId("");
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {rows.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <Checkbox
              checked={t.done}
              aria-label="Marcar tarefa"
              onCheckedChange={(v) => onToggle(t.id, Boolean(v))}
            />
            <span className={cn("text-body flex-1", t.done && "text-muted-foreground line-through")}>
              {t.text}
              {t.card_id && (
                <span className="text-label ml-2 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                  {cards.find((c) => c.id === t.card_id)?.title ?? "cartão"}
                </span>
              )}
            </span>
            {perms.canWrite && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir tarefa"
                onClick={() => onRemove(t.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {perms.canWrite && (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="text-body min-w-40 flex-1"
          placeholder="Nova tarefa da meta"
          aria-label={`Nova tarefa da meta ${goalId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Select value={cardId} onValueChange={setCardId}>
          <SelectTrigger className="text-body w-48" aria-label="Cartão do Trabalho">
            <SelectValue placeholder="Ligar a um cartão" />
          </SelectTrigger>
          <SelectContent>
            {cards.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-body">
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="text-body" onClick={add}>
          Adicionar
        </Button>
      </div>
      )}
    </div>
  );
}
