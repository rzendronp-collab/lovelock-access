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

export const Route = createFileRoute("/_authenticated/dinheiro")({
  validateSearch: (search: Record<string, unknown>) => {
    const periodo = String(search['periodo'] ?? "");
    return {
      periodo: PERIOD_KEYS.includes(periodo as PeriodKey) ? (periodo as PeriodKey) : undefined,
      de: search['de'] ? String(search['de']) : undefined,
      ate: search['ate'] ? String(search['ate']) : undefined,
      busca: search['busca'] ? String(search['busca']) : undefined,
    };
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

type Tab = "lancamentos" | "fixas" | "saldo";

type Values = Record<string, FieldValue>;

function emptyEntryValues(): Values {
  return {
    entry_date: toISODate(new Date()),
    description: "",
    category: "",
    account: "",
    kind: "saida",
    amount: "",
    received: true,
  };
}

const ENTRY_FIELDS: FieldDef[] = [
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
  { name: "category", label: "Categoria", type: "text" },
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
  const urlSearch = Route.useSearch();
  const [tab, setTab] = useState<Tab>("lancamentos");
  const { key, setKey, custom, setCustom, period } = usePeriodPicker(urlSearch.periodo ?? "mes", {
    ...(urlSearch.de && urlSearch.ate ? { from: urlSearch.de, to: urlSearch.ate } : {}),
  });
  const [search, setSearch] = useState(urlSearch.busca ?? "");
  const [category, setCategory] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(emptyEntryValues);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const finance = useFinanceTotals(period);
  const orgId = finance.orgId;
  const entries = finance.entries;
  const fixed = finance.fixed;
  const allEntries = finance.allEntries;
  const fixedRows = finance.fixedRows;
  const periodEntries = finance.periodEntries;
  const periodTotals = finance.totals;

  const openingQuery = useQuery({
    queryKey: ["cash-opening", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_opening")
        .select("id, amount, opening_date, note")
        .eq("org_id", orgId!)
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
      category: entry.category,
      account: entry.account,
      kind: entry.kind,
      amount: String(entry.amount),
      received: entry.received,
    });
    setPanelOpen(true);
  }

  function duplicate(entry: DisplayEntry) {
    setEditingId(undefined);
    setValues({
      entry_date: toISODate(new Date()),
      description: entry.description,
      category: entry.category,
      account: entry.account,
      kind: entry.kind,
      amount: String(entry.amount),
      received: entry.received,
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
          category: String(values['category'] ?? "").trim(),
          account: String(values['account'] ?? "").trim(),
          kind,
          amount: toNumber(values['amount']),
          received: kind === "saida" ? true : Boolean(values['received']),
          origin: "manual",
        },
      },
      { onSuccess: () => setPanelOpen(false) },
    );
  }

  const loading = loadingOrg || entries.isLoading || fixed.isLoading;
  const failed = entries.error || fixed.error || openingQuery.error;

  return (
    <>
      <PageHeader
        title="Dinheiro"
        subtitle="Entradas, saídas, despesas fixas e saldo da empresa."
        actions={
          <Button className="text-body" onClick={openNew}>
            <Plus className="size-4" aria-hidden /> Novo lançamento
          </Button>
        }
      />

      <SelectPillGroup>
        <SelectPill active={tab === "lancamentos"} onClick={() => setTab("lancamentos")}>
          Lançamentos
        </SelectPill>
        <SelectPill active={tab === "fixas"} onClick={() => setTab("fixas")}>
          Despesas fixas
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
              getGroup={(e) => e.category}
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
                    <p className="text-label text-muted-foreground">
                      {[e.category || "sem categoria", e.account || "—"].join(" · ")}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir lançamento"
                      disabled={e.virtual}
                      onClick={() => setToDelete(e.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </>
              )}
            />
          </AppCard>
        </>
      )}

      {tab === "fixas" && <FixedCostsSection records={fixed} />}
      {tab === "saldo" && <OpeningSection orgId={orgId ?? null} query={openingQuery} />}

      <RecordPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={editingId ? "Editar lançamento" : "Novo lançamento"}
        description="Registre uma entrada ou saída de dinheiro."
        fields={ENTRY_FIELDS}
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

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <AppCard>
      <p className="text-label text-muted-foreground">{label}</p>
      <p className="text-title font-semibold">{value}</p>
    </AppCard>
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
                    onCheckedChange={(v) =>
                      records.update.mutate({ id: c.id, values: { active: v } })
                    }
                  />
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

function OpeningSection({
  orgId,
  query,
}: {
  orgId: string | null;
  query: {
    data: { id: string; amount: number; opening_date: string; note: string } | null | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => unknown;
  };
}) {
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
      const payload = {
        org_id: orgId,
        amount: Number(amountValue.replace(",", ".")) || 0,
        opening_date: dateValue,
        note: noteValue,
      };
      const { error } = await supabase
        .from("cash_opening")
        .upsert(payload, { onConflict: "org_id" });
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
          <Button className="text-body" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Salvando..." : "Salvar saldo inicial"}
          </Button>
        </div>
      )}
    </AppCard>
  );
}
