import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppCard } from "@/components/app-card";
import { TotalCard } from "@/components/total-card";
import { EmptyState, LoadingState } from "@/components/states";
import { ConfirmDialog, Field, RecordPanel, type FieldDef, type FieldValue } from "@/components/detail-panel";
import { PeriodPicker, toISODate, usePeriodPicker } from "@/components/period-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-org";
import { entriesInRange } from "@/hooks/use-finance-totals";
import { formatDate, formatMoney, totals, type DisplayEntry, type FixedCostRow } from "@/lib/finance";
import { cn } from "@/lib/utils";

/** Selo visual da retirada, reutilizado pela lista do Dinheiro. */
export function WithdrawalBadge() {
  return (
    <span className="text-label ml-2 rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
      retirada
    </span>
  );
}

const WITHDRAWAL_FIELDS: FieldDef[] = [
  { name: "entry_date", label: "Data", type: "date" },
  { name: "description", label: "Descrição", type: "text" },
  { name: "amount", label: "Valor", type: "decimal" },
];

export function CashSection({
  orgId,
  projectId,
  allEntries,
  fixedRows,
  opening,
  onRegister,
  saving,
}: {
  orgId: string | null;
  projectId: string;
  allEntries: DisplayEntry[];
  fixedRows: FixedCostRow[];
  opening: { amount: number; opening_date: string } | null | undefined;
  /** Usa o mesmo caminho de gravação de lançamento do módulo Dinheiro. */
  onRegister: (values: { entry_date: string; description: string; amount: number }, done: () => void) => void;
  saving?: boolean;
}) {
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const { key, setKey, custom, setCustom, period } = usePeriodPicker("mes");
  const [panelOpen, setPanelOpen] = useState(false);
  const [values, setValues] = useState<Record<string, FieldValue>>({
    entry_date: toISODate(new Date()),
    description: "Pró-labore / Retirada",
    amount: "",
  });
  const [percentInput, setPercentInput] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const settings = useQuery({
    queryKey: ["withdrawal-settings", orgId, projectId],
    enabled: !!orgId && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_settings")
        .select("project_id, percent")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const percent = Number(settings.data?.percent ?? 40);
  const percentValue = percentInput ?? String(percent);

  const savePercent = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("sem empresa");
      const value = Math.min(100, Math.max(0, Number(percentValue.replace(",", ".")) || 0));
      const { error } = await supabase
        .from("withdrawal_settings")
        .upsert({ project_id: projectId, org_id: orgId, percent: value }, { onConflict: "project_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["withdrawal-settings"] });
      toast.success("Porcentagem retirável salva.");
    },
    onError: () => toast.error("Não foi possível salvar a porcentagem."),
  });

  const today = toISODate(new Date());

  /** Dinheiro que existe: saldo inicial + tudo (retiradas incluídas) até hoje. */
  const cashBalance = useMemo(() => {
    const start = opening?.opening_date ?? "1900-01-01";
    const t = totals(entriesInRange(allEntries, fixedRows, start, today), {
      includeWithdrawals: true,
    });
    return Number(opening?.amount ?? 0) + t.sobrou;
  }, [allEntries, fixedRows, opening, today]);

  const periodEntries = useMemo(
    () => entriesInRange(allEntries, fixedRows, period.from, period.to),
    [allEntries, fixedRows, period.from, period.to],
  );
  const periodTotals = useMemo(() => totals(periodEntries), [periodEntries]);
  const withdrawals = useMemo(
    () => periodEntries.filter((e) => e.kind === "saida" && e.is_withdrawal),
    [periodEntries],
  );

  const profit = periodTotals.sobrou;
  const allowed = (profit * percent) / 100;
  const already = periodTotals.retiradas;
  const available = allowed - already;

  return (
    <>
      <AppCard title="Período" subtitle="Escolha o intervalo do lucro e das retiradas.">
        <PeriodPicker value={key} onChange={setKey} custom={custom} onCustomChange={setCustom} />
      </AppCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalCard
          label="Saldo do caixa"
          value={formatMoney(cashBalance)}
          sub={`o que existe hoje (${formatDate(today)})`}
        />
        <TotalCard
          label="Lucro do período"
          value={formatMoney(profit)}
          sub="entradas − saídas operacionais"
        />
        <TotalCard label={`Retirável (${percent}%)`} value={formatMoney(allowed)} sub="do lucro do período" />
        <TotalCard label="Já retirado no período" value={formatMoney(already)} />
      </div>

      <AppCard
        title="Disponível para retirar agora"
        subtitle="Retirável do período menos o que já foi retirado nele."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={() => setPanelOpen(true)}>
              <Plus className="size-4" aria-hidden /> Registrar retirada
            </Button>
          ) : undefined
        }
      >
        <p className={cn("text-title font-semibold", available < 0 ? "text-destructive" : "text-primary")}>
          {formatMoney(available)}
        </p>
        {available < 0 && (
          <p className="text-label text-destructive">acima do retirável do período</p>
        )}
        <p className="text-label mt-2 text-muted-foreground">
          <strong>Saldo do caixa</strong> é o dinheiro que a empresa tem (a retirada sai dele).{" "}
          <strong>Disponível para retirar</strong> é quanto dá pra puxar de lucro sem comer o capital
          — a retirada é distribuição, então não muda o lucro.
        </p>
      </AppCard>

      <AppCard title="Porcentagem retirável" subtitle="Quanto do lucro do período pode virar retirada.">
        {settings.isLoading ? (
          <LoadingState />
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="% do lucro" id="ws-percent">
              <Input
                id="ws-percent"
                inputMode="decimal"
                className="text-body"
                value={percentValue}
                disabled={!perms.isAdminOrOwner}
                onChange={(e) => setPercentInput(e.target.value)}
              />
            </Field>
            {perms.isAdminOrOwner && (
              <Button
                className="text-body"
                disabled={savePercent.isPending}
                onClick={() => savePercent.mutate()}
              >
                {savePercent.isPending ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>
        )}
      </AppCard>

      <AppCard
        title="Retiradas do período"
        subtitle={`Total retirado: ${formatMoney(already)}`}
      >
        {withdrawals.length === 0 ? (
          <EmptyState
            title="Nenhuma retirada"
            message="Nada foi retirado neste período."
            icon={<HandCoins className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {withdrawals.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="text-label w-20 text-muted-foreground">{formatDate(w.entry_date)}</span>
                <p className="text-body min-w-40 flex-1 font-medium">
                  {w.description}
                  <WithdrawalBadge />
                </p>
                <span className="text-body font-semibold text-destructive">
                  − {formatMoney(w.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <RecordPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title="Registrar retirada"
        description="Sai do caixa como distribuição de lucro — não conta como gasto operacional."
        fields={WITHDRAWAL_FIELDS}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        onSave={() => {
          const amount = Number(String(values['amount'] ?? "").replace(",", ".")) || 0;
          if (amount > available) {
            setConfirmOpen(true);
            return;
          }
          register();
        }}
        saving={saving}
        idPrefix="wd"
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Retirar acima do disponível?"
        description="O valor passa do disponível para retirar neste período."
        confirmLabel="Registrar mesmo assim"
        onConfirm={() => {
          setConfirmOpen(false);
          register();
        }}
      />
    </>
  );

  function register() {
    onRegister(
      {
        entry_date: String(values['entry_date'] ?? toISODate(new Date())),
        description: String(values['description'] ?? "").trim() || "Pró-labore / Retirada",
        amount: Number(String(values['amount'] ?? "").replace(",", ".")) || 0,
      },
      () => {
        setPanelOpen(false);
        setValues({
          entry_date: toISODate(new Date()),
          description: "Pró-labore / Retirada",
          amount: "",
        });
      },
    );
  }
}
