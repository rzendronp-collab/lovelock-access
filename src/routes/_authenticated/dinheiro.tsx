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
import { ConfirmDialog, DetailPanel } from "@/components/detail-panel";
import { PeriodFilter, toISODate, usePeriodFilter } from "@/components/period-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  expandFixedCosts,
  formatDate,
  formatMoney,
  toDisplay,
  totals,
  type DisplayEntry,
  type EntryKind,
  type FinanceEntryRow,
  type FixedCostRow,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/dinheiro")({
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

type EntryForm = {
  id?: string;
  entry_date: string;
  description: string;
  category: string;
  account: string;
  kind: EntryKind;
  amount: string;
  received: boolean;
};

function emptyEntryForm(): EntryForm {
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

function useOrgId() {
  return useQuery({
    queryKey: ["org-id"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.org_id ?? null;
    },
  });
}

function Dinheiro() {
  const [tab, setTab] = useState<Tab>("lancamentos");
  const { key, setKey, custom, setCustom, period } = usePeriodFilter("mes");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<EntryForm>(emptyEntryForm);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: orgId, isLoading: loadingOrg } = useOrgId();

  const entriesQuery = useQuery({
    queryKey: ["finance-entries", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("id, entry_date, description, category, account, kind, amount, received, origin")
        .eq("org_id", orgId!)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceEntryRow[];
    },
  });

  const fixedQuery = useQuery({
    queryKey: ["fixed-costs", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_costs")
        .select("id, label, category, amount, day_of_month, start_month, end_month, active")
        .eq("org_id", orgId!)
        .order("label");
      if (error) throw error;
      return (data ?? []) as FixedCostRow[];
    },
  });

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

  const allEntries = useMemo(() => toDisplay(entriesQuery.data ?? []), [entriesQuery.data]);

  const periodEntries = useMemo(() => {
    const real = allEntries.filter(
      (e) => e.entry_date >= period.from && e.entry_date <= period.to,
    );
    const fixed = expandFixedCosts(fixedQuery.data ?? [], period.from, period.to);
    return [...real, ...fixed].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }, [allEntries, fixedQuery.data, period]);

  const periodTotals = useMemo(() => totals(periodEntries), [periodEntries]);

  const accumulated = useMemo(() => {
    const opening = openingQuery.data;
    const start = opening?.opening_date ?? "1900-01-01";
    const real = allEntries.filter((e) => e.entry_date >= start && e.entry_date <= period.to);
    const fixed = expandFixedCosts(fixedQuery.data ?? [], start, period.to);
    const t = totals([...real, ...fixed]);
    return Number(opening?.amount ?? 0) + t.sobrou;
  }, [allEntries, fixedQuery.data, openingQuery.data, period.to]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of periodEntries) if (e.category) set.add(e.category);
    return [...set].sort();
  }, [periodEntries]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodEntries.filter(
      (e) =>
        (!q || e.description.toLowerCase().includes(q)) && (!category || e.category === category),
    );
  }, [periodEntries, search, category]);

  const saveEntry = useMutation({
    mutationFn: async (values: EntryForm) => {
      if (!orgId) throw new Error("sem empresa");
      const payload = {
        org_id: orgId,
        entry_date: values.entry_date,
        description: values.description.trim(),
        category: values.category.trim(),
        account: values.account.trim(),
        kind: values.kind,
        amount: Number(values.amount.replace(",", ".")) || 0,
        received: values.kind === "saida" ? true : values.received,
        origin: "manual",
      };
      if (values.id) {
        const { error } = await supabase
          .from("finance_entries")
          .update(payload)
          .eq("id", values.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("finance_entries")
          .insert({ ...payload, created_by: userData.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance-entries"] });
      setPanelOpen(false);
      toast.success("Lançamento salvo.");
    },
    onError: () => toast.error("Não foi possível salvar o lançamento."),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("finance_entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance-entries"] });
      setToDelete(null);
      toast.success("Lançamento excluído.");
    },
    onError: () => toast.error("Não foi possível excluir."),
  });

  function openNew() {
    setForm(emptyEntryForm());
    setPanelOpen(true);
  }

  function openEdit(entry: DisplayEntry) {
    setForm({
      id: entry.id,
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
    setForm({
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

  const loading = loadingOrg || entriesQuery.isLoading || fixedQuery.isLoading;
  const failed = entriesQuery.error || fixedQuery.error || openingQuery.error;

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
            <PeriodFilter
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
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1 space-y-1">
                <Label htmlFor="busca" className="text-label">
                  Buscar descrição
                </Label>
                <Input
                  id="busca"
                  className="text-body"
                  placeholder="Ex.: aluguel"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="mb-4">
              <SelectPillGroup>
                <SelectPill active={!category} onClick={() => setCategory("")}>
                  Todas
                </SelectPill>
                {categories.map((c) => (
                  <SelectPill key={c} active={category === c} onClick={() => setCategory(c)}>
                    {c}
                  </SelectPill>
                ))}
              </SelectPillGroup>
            </div>

            {loading ? (
              <LoadingState />
            ) : failed ? (
              <ErrorState
                message="Não foi possível carregar os lançamentos."
                onRetry={() => void entriesQuery.refetch()}
              />
            ) : visible.length === 0 ? (
              <EmptyState
                title="Nenhum lançamento"
                message="Ainda não há nada aqui neste período."
                icon={<Wallet className="size-5" aria-hidden />}
                action={
                  <Button className="text-body" onClick={openNew}>
                    Novo lançamento
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
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
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        </>
      )}

      {tab === "fixas" && <FixedCostsSection orgId={orgId ?? null} query={fixedQuery} />}
      {tab === "saldo" && <OpeningSection orgId={orgId ?? null} query={openingQuery} />}

      <DetailPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={form.id ? "Editar lançamento" : "Novo lançamento"}
        description="Registre uma entrada ou saída de dinheiro."
        footer={
          <Button
            className="text-body w-full"
            disabled={saveEntry.isPending}
            onClick={() => saveEntry.mutate(form)}
          >
            {saveEntry.isPending ? "Salvando..." : "Salvar"}
          </Button>
        }
      >
        <div className="space-y-4">
          <SelectPillGroup>
            <SelectPill
              active={form.kind === "entrada"}
              onClick={() => setForm({ ...form, kind: "entrada" })}
            >
              Entrada
            </SelectPill>
            <SelectPill
              active={form.kind === "saida"}
              onClick={() => setForm({ ...form, kind: "saida", received: true })}
            >
              Saída
            </SelectPill>
          </SelectPillGroup>
          <Field label="Data" id="f-data">
            <Input
              id="f-data"
              type="date"
              className="text-body"
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            />
          </Field>
          <Field label="Descrição" id="f-desc">
            <Input
              id="f-desc"
              className="text-body"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Categoria" id="f-cat">
            <Input
              id="f-cat"
              className="text-body"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Conta" id="f-conta">
            <Input
              id="f-conta"
              className="text-body"
              value={form.account}
              onChange={(e) => setForm({ ...form, account: e.target.value })}
            />
          </Field>
          <Field label="Valor" id="f-valor">
            <Input
              id="f-valor"
              inputMode="decimal"
              className="text-body"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          {form.kind === "entrada" && (
            <div className="flex items-center justify-between">
              <Label htmlFor="f-recebido" className="text-body">
                Recebido
              </Label>
              <Switch
                id="f-recebido"
                checked={form.received}
                onCheckedChange={(v) => setForm({ ...form, received: v })}
              />
            </div>
          )}
        </div>
      </DetailPanel>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir lançamento?"
        description="Ele sai da lista, mas o histórico fica guardado."
        confirmLabel="Excluir"
        onConfirm={() => toDelete && deleteEntry.mutate(toDelete)}
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

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-label">
        {label}
      </Label>
      {children}
    </div>
  );
}

type FixedForm = {
  id?: string;
  label: string;
  category: string;
  amount: string;
  day_of_month: string;
  start_month: string;
  end_month: string;
};

function emptyFixedForm(): FixedForm {
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
  orgId,
  query,
}: {
  orgId: string | null;
  query: { data: FixedCostRow[] | undefined; isLoading: boolean; error: unknown; refetch: () => unknown };
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FixedForm>(emptyFixedForm);

  const save = useMutation({
    mutationFn: async (values: FixedForm) => {
      if (!orgId) throw new Error("sem empresa");
      const payload = {
        org_id: orgId,
        label: values.label.trim(),
        category: values.category.trim(),
        amount: Number(values.amount.replace(",", ".")) || 0,
        day_of_month: Math.min(31, Math.max(1, Number(values.day_of_month) || 1)),
        start_month: `${values.start_month}-01`,
        end_month: values.end_month ? `${values.end_month}-01` : null,
      };
      if (values.id) {
        const { error } = await supabase.from("fixed_costs").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fixed_costs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fixed-costs"] });
      setOpen(false);
      toast.success("Despesa fixa salva.");
    },
    onError: () => toast.error("Não foi possível salvar a despesa fixa."),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("fixed_costs").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fixed-costs"] }),
    onError: () => toast.error("Não foi possível atualizar."),
  });

  const rows = query.data ?? [];

  return (
    <>
      <AppCard
        title="Despesas fixas"
        subtitle="Cadastre uma vez e ela entra automaticamente em cada mês do período."
        actions={
          <Button
            className="text-body"
            onClick={() => {
              setForm(emptyFixedForm());
              setOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden /> Nova despesa fixa
          </Button>
        }
      >
        {query.isLoading ? (
          <LoadingState />
        ) : query.error ? (
          <ErrorState onRetry={() => void query.refetch()} />
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
                    onCheckedChange={(v) => toggleActive.mutate({ id: c.id, active: v })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar despesa fixa"
                    onClick={() => {
                      setForm({
                        id: c.id,
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

      <DetailPanel
        open={open}
        onOpenChange={setOpen}
        title={form.id ? "Editar despesa fixa" : "Nova despesa fixa"}
        description="Ela aparece como lançamento em cada mês do período."
        footer={
          <Button
            className="text-body w-full"
            disabled={save.isPending}
            onClick={() => save.mutate(form)}
          >
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Rótulo" id="fc-label">
            <Input
              id="fc-label"
              className="text-body"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </Field>
          <Field label="Categoria" id="fc-cat">
            <Input
              id="fc-cat"
              className="text-body"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Valor" id="fc-valor">
            <Input
              id="fc-valor"
              inputMode="decimal"
              className="text-body"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Dia do mês" id="fc-dia">
            <Input
              id="fc-dia"
              type="number"
              min={1}
              max={31}
              className="text-body"
              value={form.day_of_month}
              onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
            />
          </Field>
          <Field label="Mês de início" id="fc-inicio">
            <Input
              id="fc-inicio"
              type="month"
              className="text-body"
              value={form.start_month}
              onChange={(e) => setForm({ ...form, start_month: e.target.value })}
            />
          </Field>
          <Field label="Mês de fim (opcional)" id="fc-fim">
            <Input
              id="fc-fim"
              type="month"
              className="text-body"
              value={form.end_month}
              onChange={(e) => setForm({ ...form, end_month: e.target.value })}
            />
          </Field>
        </div>
      </DetailPanel>
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
          <Button
            className="text-body"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando..." : "Salvar saldo inicial"}
          </Button>
        </div>
      )}
    </AppCard>
  );
}
