import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ConfirmDialog,
  Field,
  RecordPanel,
  type FieldDef,
  type FieldValue,
} from "@/components/detail-panel";
import { RecordList } from "@/components/record-list";
import { TotalCard } from "@/components/total-card";
import {
  PeriodPicker,
  toISODate,
  usePeriodPicker,
  type PeriodKey,
} from "@/components/period-picker";
import { useRecords } from "@/hooks/use-records";
import { usePermissions } from "@/hooks/use-org";
import { useCurrentProject } from "@/hooks/use-projects";
import { NoProjectState } from "@/components/project-select";

import { useContactField } from "@/hooks/use-contacts";
import {
  CATEGORY_KINDS,
  categoryKindLabel,
  useFinanceCategories,
  type FinanceCategoryRow,
} from "@/hooks/use-finance-categories";
import { ITEM_COLORS, colorSwatch } from "@/lib/board";
import { cn } from "@/lib/utils";
import { entriesInRange, useFinanceTotals } from "@/hooks/use-finance-totals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  formatDate,
  formatMoney,
  totals,
  type DisplayEntry,
  type EntryKind,
  type FixedCostRow,
} from "@/lib/finance";

const PERIOD_KEYS: PeriodKey[] = ["7d", "mes", "trimestre", "custom"];

/** Filtros que podem chegar por link (ex.: do Painel de hoje). */
type DinheiroSearch = {
  periodo?: PeriodKey;
  de?: string;
  ate?: string;
  busca?: string;
};

export const Route = createFileRoute("/_authenticated/dinheiro")({
  validateSearch: (search: Record<string, unknown>): DinheiroSearch => {
    const periodo = String(search['periodo'] ?? "");
    const out: DinheiroSearch = {};
    if (PERIOD_KEYS.includes(periodo as PeriodKey)) out.periodo = periodo as PeriodKey;
    if (search['de']) out.de = String(search['de']);
    if (search['ate']) out.ate = String(search['ate']);
    if (search['busca']) out.busca = String(search['busca']);
    return out;
  },
  head: () => ({
    meta: [
      { title: "Dinheiro | EuroHub" },
      {
        name: "description",
        content:
          "Controle o dinheiro da empresa no EuroHub: entradas, saídas, despesas fixas e saldo.",
      },
      { property: "og:title", content: "Dinheiro | EuroHub" },
      {
        property: "og:description",
        content:
          "Controle o dinheiro da empresa no EuroHub: entradas, saídas, despesas fixas e saldo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dinheiro,
});

type Tab = "lancamentos" | "orcamento" | "fixas" | "categorias" | "saldo";

type Values = Record<string, FieldValue>;

function emptyEntryValues(): Values {
  return {
    entry_date: toISODate(new Date()),
    description: "",
    category_id: "",
    account: "",
    kind: "saida",
    amount: "",
    received: true,
    contact_id: "",
  };
}

const ENTRY_FIELDS_BASE: FieldDef[] = [
  {
    name: "kind",
    label: "Tipo",
    type: "choice",
    options: [
      { value: "entrada", label: "Entrada" },
      { value: "saida", label: "Saída" },
    ],
  },
  { name: "entry_date", label: "Data", type: "date" },
  { name: "description", label: "Descrição", type: "text" },
  { name: "account", label: "Conta", type: "text" },
  { name: "amount", label: "Valor", type: "decimal" },
  {
    name: "received",
    label: "Recebido",
    type: "switch",
    showWhen: (v) => v['kind'] === "entrada",
  },
];


function toNumber(value: FieldValue | undefined) {
  return Number(String(value ?? "").replace(",", ".")) || 0;
}

function Dinheiro() {
  const perms = usePermissions();
  const { projectId } = useCurrentProject();
  const urlSearch = Route.useSearch();
  const [tab, setTab] = useState<Tab>("lancamentos");
  const { key, setKey, custom, setCustom, period } = usePeriodPicker(urlSearch.periodo ?? "mes", {
    ...(urlSearch.de && urlSearch.ate ? { from: urlSearch.de, to: urlSearch.ate } : {}),
  });
  const [search, setSearch] = useState(urlSearch.busca ?? "");
  const [category, setCategory] = useState("");
  const { field: contactField } = useContactField();
  const categories = useFinanceCategories(projectId);
  const [newCategory, setNewCategory] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(emptyEntryValues);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const finance = useFinanceTotals(period, { projectId, projectRequired: true });
  const orgId = finance.orgId;
  const entries = finance.entries;
  const fixed = finance.fixed;
  const allEntries = finance.allEntries;
  const fixedRows = finance.fixedRows;
  const periodEntries = finance.periodEntries;
  const periodTotals = finance.totals;

  const openingQuery = useQuery({
    queryKey: ["cash-opening", orgId, projectId],
    enabled: !!orgId && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_opening")
        .select("id, amount, opening_date, note")
        .eq("org_id", orgId!)
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });


  const accumulated = useMemo(() => {
    const opening = openingQuery.data;
    const start = opening?.opening_date ?? "1900-01-01";
    const t = totals(entriesInRange(allEntries, fixedRows, start, period.to));
    return Number(opening?.amount ?? 0) + t.sobrou;
  }, [allEntries, fixedRows, openingQuery.data, period.to]);


  const entryKind = (values['kind'] === "entrada" ? "entrada" : "saida") as EntryKind;
  const categoryField = useMemo<FieldDef>(
    () => ({
      name: "category_id",
      label: "Categoria",
      type: "select",
      placeholder: "Sem categoria",
      options: [
        { value: "", label: "Sem categoria" },
        ...categories.forKind(entryKind).map((c) => ({
          value: c.id,
          label: c.name,
          swatchClassName: colorSwatch(c.color),
        })),
      ],
      extra: perms.canWrite ? (
        <div className="flex items-center gap-2 pt-1">
          <Input
            className="text-body"
            placeholder="+ Nova categoria"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <Button
            variant="secondary"
            className="text-body"
            disabled={!newCategory.trim() || categories.quickCreate.isPending}
            onClick={() =>
              categories.quickCreate.mutate(newCategory.trim(), {
                onSuccess: (id) => {
                  setNewCategory("");
                  setValues((prev) => ({ ...prev, category_id: id }));
                },
              })
            }
          >
            Criar
          </Button>
        </div>
      ) : undefined,
    }),
    [categories, entryKind, newCategory, perms.canWrite],
  );
  const entryFields = useMemo<FieldDef[]>(
    () => [...ENTRY_FIELDS_BASE, categoryField, contactField],
    [categoryField, contactField],
  );

  function setValue(name: string, value: FieldValue) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "kind" && value === "saida") next['received'] = true;
      return next;
    });
  }

  function openNew() {
    setEditingId(undefined);
    setValues(emptyEntryValues());
    setPanelOpen(true);
  }

  function openEdit(entry: DisplayEntry) {
    setEditingId(entry.id);
    setValues({
      entry_date: entry.entry_date,
      description: entry.description,
      category_id: entry.category_id ?? "",
      account: entry.account,
      kind: entry.kind,
      amount: String(entry.amount),
      received: entry.received,
      contact_id: entry.contact_id ?? "",
    });
    setPanelOpen(true);
  }

  function duplicate(entry: DisplayEntry) {
    setEditingId(undefined);
    setValues({
      entry_date: toISODate(new Date()),
      description: entry.description,
      category_id: entry.category_id ?? "",
      account: entry.account,
      kind: entry.kind,
      amount: String(entry.amount),
      received: entry.received,
      contact_id: entry.contact_id ?? "",
    });
    setPanelOpen(true);
  }

  function saveEntry() {
    const kind = (values['kind'] === "entrada" ? "entrada" : "saida") as EntryKind;
    entries.save.mutate(
      {
        id: editingId,
        values: {
          entry_date: String(values['entry_date'] ?? ""),
          description: String(values['description'] ?? "").trim(),
          category_id: String(values['category_id'] ?? "") || null,
          account: String(values['account'] ?? "").trim(),
          kind,
          amount: toNumber(values['amount']),
          received: kind === "saida" ? true : Boolean(values['received']),
          contact_id: String(values['contact_id'] ?? "") || null,
          origin: "manual",
        },
      },
      { onSuccess: () => setPanelOpen(false) },
    );
  }

  const loading = finance.isLoading;
  const failed = finance.error || openingQuery.error;

  if (!projectId) {
    return (
      <>
        <PageHeader
          title="Dinheiro"
          subtitle="Entradas, saídas, despesas fixas e saldo do projeto."
        />
        <AppCard>
          <NoProjectState />
        </AppCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dinheiro"
        subtitle="Entradas, saídas, despesas fixas e saldo do projeto."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={openNew}>
              <Plus className="size-4" aria-hidden /> Novo lançamento
            </Button>
          ) : undefined
        }
      />



      <SelectPillGroup>
        <SelectPill active={tab === "lancamentos"} onClick={() => setTab("lancamentos")}>
          Lançamentos
        </SelectPill>
        <SelectPill active={tab === "fixas"} onClick={() => setTab("fixas")}>
          Despesas fixas
        </SelectPill>
        <SelectPill active={tab === "categorias"} onClick={() => setTab("categorias")}>
          Categorias
        </SelectPill>
        <SelectPill active={tab === "saldo"} onClick={() => setTab("saldo")}>
          Saldo inicial
        </SelectPill>
      </SelectPillGroup>

      {tab === "lancamentos" && (
        <>
          <AppCard title="Período" subtitle="Escolha o intervalo dos números abaixo.">
            <PeriodPicker
              value={key}
              onChange={setKey}
              custom={custom}
              onCustomChange={setCustom}
            />
          </AppCard>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TotalCard label="Entrou" value={formatMoney(periodTotals.entrou)} />
            <TotalCard label="Saiu" value={formatMoney(periodTotals.saiu)} />
            <TotalCard label="Sobrou" value={formatMoney(periodTotals.sobrou)} />
            <TotalCard label="Margem" value={`${periodTotals.margem.toFixed(1)}%`} />
          </div>

          <AppCard
            title="Lançamentos do período"
            subtitle={`Saldo acumulado até ${formatDate(period.to)}: ${formatMoney(accumulated)}`}
          >
            <RecordList<DisplayEntry>
              items={periodEntries}
              getKey={(e) => e.id}
              getSearchText={(e) => e.description}
              getGroup={(e) => categories.nameOf(e.category_id, e.category)}
              search={search}
              onSearchChange={setSearch}
              searchId="busca"
              searchLabel="Buscar descrição"
              searchPlaceholder="Ex.: aluguel"
              group={category}
              onGroupChange={setCategory}
              groupAllLabel="Todas"
              loading={loading}
              error={failed}
              onRetry={entries.refetch}
              empty={{
                title: "Nenhum lançamento",
                message: "Ainda não há nada aqui neste período.",
                icon: <Wallet className="size-5" aria-hidden />,
                action: (
                  <Button className="text-body" onClick={openNew}>
                    Novo lançamento
                  </Button>
                ),
              }}
              renderItem={(e) => (
                <>
                  <span className="text-label w-20 text-muted-foreground">
                    {formatDate(e.entry_date)}
                  </span>
                  <div className="min-w-40 flex-1">
                    <p className="text-body font-medium">
                      {e.description}
                      {e.virtual && (
                        <span className="text-label ml-2 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                          fixa
                        </span>
                      )}
                      {!e.received && (
                        <span className="text-label ml-2 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                          a receber
                        </span>
                      )}
                    </p>
                    <p className="text-label flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          categories.swatchOf(e.category_id),
                        )}
                        aria-hidden
                      />
                      {categories.nameOf(e.category_id, e.category)} · {e.account || "—"}
                    </p>
                  </div>
                  <span
                    className={
                      e.kind === "entrada"
                        ? "text-body font-semibold text-primary"
                        : "text-body font-semibold text-destructive"
                    }
                  >
                    {e.kind === "entrada" ? "+" : "−"} {formatMoney(e.amount)}
                  </span>
                  <div className="flex items-center gap-1">
                    {perms.canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Duplicar lançamento"
                          onClick={() => duplicate(e)}
                        >
                          <Copy className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar lançamento"
                          disabled={e.virtual}
                          onClick={() => openEdit(e)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                      </>
                    )}
                    {!e.virtual && perms.canDelete(e.created_by) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir lançamento"
                        onClick={() => setToDelete(e.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </>
              )}
            />
          </AppCard>
        </>
      )}

      {tab === "fixas" && <FixedCostsSection records={fixed} />}
      {tab === "categorias" && <CategoriesSection categories={categories} />}
      {tab === "saldo" && (
        <OpeningSection orgId={orgId ?? null} projectId={projectId} query={openingQuery} />
      )}


      <RecordPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={editingId ? "Editar lançamento" : "Novo lançamento"}
        description="Registre uma entrada ou saída de dinheiro."
        fields={entryFields}
        values={values}
        onChange={setValue}
        onSave={saveEntry}
        saving={entries.save.isPending}
        idPrefix="f"
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir lançamento?"
        description="Ele sai da lista, mas o histórico fica guardado."
        confirmLabel="Excluir"
        onConfirm={() =>
          toDelete &&
          entries.remove.mutate(toDelete, { onSuccess: () => setToDelete(null) })
        }
      />
    </>
  );
}



const FIXED_FIELDS: FieldDef[] = [
  { name: "label", label: "Rótulo", type: "text" },
  { name: "category", label: "Categoria", type: "text" },
  { name: "amount", label: "Valor", type: "decimal" },
  { name: "day_of_month", label: "Dia do mês", type: "number", min: 1, max: 31 },
  { name: "start_month", label: "Mês de início", type: "month" },
  { name: "end_month", label: "Mês de fim (opcional)", type: "month" },
];

function emptyFixedValues(): Values {
  const now = new Date();
  return {
    label: "",
    category: "",
    amount: "",
    day_of_month: "1",
    start_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    end_month: "",
  };
}

function FixedCostsSection({
  records,
}: {
  records: ReturnType<typeof useRecords<FixedCostRow & { id: string }>>;
}) {
  const perms = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(emptyFixedValues);

  function save() {
    records.save.mutate(
      {
        id: editingId,
        values: {
          label: String(values['label'] ?? "").trim(),
          category: String(values['category'] ?? "").trim(),
          amount: toNumber(values['amount']),
          day_of_month: Math.min(31, Math.max(1, Number(values['day_of_month']) || 1)),
          start_month: `${String(values['start_month'] ?? "")}-01`,
          end_month: values['end_month'] ? `${String(values['end_month'])}-01` : null,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  const rows = records.rows;

  return (
    <>
      <AppCard
        title="Despesas fixas"
        subtitle="Cadastre uma vez e ela entra automaticamente em cada mês do período."
        actions={
          perms.canWrite ? (
            <Button
              className="text-body"
              onClick={() => {
                setEditingId(undefined);
                setValues(emptyFixedValues());
                setOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden /> Nova despesa fixa
            </Button>
          ) : undefined
        }
      >
        {records.isLoading ? (
          <LoadingState />
        ) : records.error ? (
          <ErrorState onRetry={records.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhuma despesa fixa"
            message="Ainda não há nada aqui. Cadastre uma para ela repetir todo mês."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-40 flex-1">
                  <p className="text-body font-medium">{c.label}</p>
                  <p className="text-label text-muted-foreground">
                    {c.category || "sem categoria"} · dia {c.day_of_month} · de{" "}
                    {c.start_month.slice(0, 7)}
                    {c.end_month ? ` até ${c.end_month.slice(0, 7)}` : ""}
                  </p>
                </div>
                <span className="text-body font-semibold">{formatMoney(Number(c.amount))}</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`ativa-${c.id}`} className="text-label text-muted-foreground">
                    {c.active ? "Ativa" : "Inativa"}
                  </Label>
                  <Switch
                    id={`ativa-${c.id}`}
                    checked={c.active}
                    disabled={!perms.canWrite}
                    onCheckedChange={(v) =>
                      records.update.mutate({ id: c.id, values: { active: v } })
                    }
                  />
                  {perms.canWrite && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar despesa fixa"
                    onClick={() => {
                      setEditingId(c.id);
                      setValues({
                        label: c.label,
                        category: c.category,
                        amount: String(c.amount),
                        day_of_month: String(c.day_of_month),
                        start_month: c.start_month.slice(0, 7),
                        end_month: c.end_month ? c.end_month.slice(0, 7) : "",
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <RecordPanel
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar despesa fixa" : "Nova despesa fixa"}
        description="Ela aparece como lançamento em cada mês do período."
        fields={FIXED_FIELDS}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        onSave={save}
        saving={records.save.isPending}
        idPrefix="fc"
      />
    </>
  );
}

const CATEGORY_FIELDS: FieldDef[] = [
  { name: "name", label: "Nome", type: "text" },
  {
    name: "color",
    label: "Cor",
    type: "choice",
    options: ITEM_COLORS.map((c) => ({ value: c.value, label: c.label })),
  },
  {
    name: "kind",
    label: "Tipo",
    type: "choice",
    options: CATEGORY_KINDS.map((k) => ({ value: k.value, label: k.label })),
  },
  { name: "archived", label: "Arquivada", type: "switch" },
];

function CategoriesSection({
  categories,
}: {
  categories: ReturnType<typeof useFinanceCategories>;
}) {
  const perms = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>({
    name: "",
    color: "neutra",
    kind: "ambos",
    archived: false,
  });

  function openNew() {
    setEditingId(undefined);
    setValues({ name: "", color: "neutra", kind: "ambos", archived: false });
    setOpen(true);
  }

  function openEdit(c: FinanceCategoryRow) {
    setEditingId(c.id);
    setValues({ name: c.name, color: c.color, kind: c.kind, archived: c.archived });
    setOpen(true);
  }

  function save() {
    categories.save.mutate(
      {
        id: editingId,
        values: {
          name: String(values['name'] ?? "").trim(),
          color: String(values['color'] ?? "neutra"),
          kind: String(values['kind'] ?? "ambos"),
          archived: Boolean(values['archived']),
          position: categories.rows.length,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <AppCard
        title="Categorias do projeto"
        subtitle="Cada projeto tem suas categorias, com cor e tipo."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={openNew}>
              <Plus className="size-4" aria-hidden /> Nova categoria
            </Button>
          ) : undefined
        }
      >
        {categories.isLoading ? (
          <LoadingState />
        ) : categories.error ? (
          <ErrorState onRetry={categories.refetch} />
        ) : categories.rows.length === 0 ? (
          <EmptyState
            title="Nenhuma categoria"
            message="Cadastre categorias para classificar os lançamentos deste projeto."
          />
        ) : (
          <ul className="divide-y divide-border">
            {categories.rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  className={cn("size-3 shrink-0 rounded-full", colorSwatch(c.color))}
                  aria-hidden
                />
                <div className="min-w-40 flex-1">
                  <p className="text-body font-medium">{c.name}</p>
                  <p className="text-label text-muted-foreground">
                    {categoryKindLabel(c.kind)}
                    {c.archived ? " · arquivada" : ""}
                  </p>
                </div>
                {perms.canWrite && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar categoria"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <RecordPanel
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar categoria" : "Nova categoria"}
        description="Nome, cor e em quais lançamentos ela aparece."
        fields={CATEGORY_FIELDS}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        onSave={save}
        saving={categories.save.isPending}
        idPrefix="cat"
      />
    </>
  );
}

function OpeningSection({
  orgId,
  projectId,
  query,
}: {
  orgId: string | null;
  projectId: string | null;
  query: {
    data: { id: string; amount: number; opening_date: string; note: string } | null | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => unknown;
  };
}) {
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const current = query.data;
  const [amount, setAmount] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const amountValue = amount ?? (current ? String(current.amount) : "");
  const dateValue = date ?? current?.opening_date ?? toISODate(new Date());
  const noteValue = note ?? current?.note ?? "";

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("sem empresa");
      if (!projectId) throw new Error("sem projeto");
      const values = {
        amount: Number(amountValue.replace(",", ".")) || 0,
        opening_date: dateValue,
        note: noteValue,
      };
      if (current?.id) {
        const { error } = await supabase
          .from("cash_opening")
          .update(values)
          .eq("id", current.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("cash_opening")
        .insert({ ...values, org_id: orgId, project_id: projectId });
      if (error) throw error;
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-opening"] });
      toast.success("Saldo inicial salvo.");
    },
    onError: () => toast.error("Não foi possível salvar o saldo inicial."),
  });

  return (
    <AppCard
      title="Saldo inicial"
      subtitle="Ponto de partida usado para calcular o saldo acumulado."
    >
      {query.isLoading ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-4">
          <Field label="Valor" id="op-valor">
            <Input
              id="op-valor"
              inputMode="decimal"
              className="text-body"
              value={amountValue}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Data" id="op-data">
            <Input
              id="op-data"
              type="date"
              className="text-body"
              value={dateValue}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Nota" id="op-nota">
            <Input
              id="op-nota"
              className="text-body"
              value={noteValue}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {perms.canWrite && (
            <Button className="text-body" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Salvando..." : "Salvar saldo inicial"}
            </Button>
          )}
        </div>
      )}
    </AppCard>
  );
}
