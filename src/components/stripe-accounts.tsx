import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Plug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppCard } from "@/components/app-card";
import { DetailPanel, Field } from "@/components/detail-panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TotalCard } from "@/components/total-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approxBrl, formatEuro } from "@/lib/finance";
import { useEurRate } from "@/hooks/use-eur-rate";
import { useRecords } from "@/hooks/use-records";
import { stripeConnect, stripeSync } from "@/lib/stripe.functions";

export type StripeAccountRow = {
  id: string;
  name: string;
  provider: string;
  stripe_connection_id: string | null;
  balance_available: number;
  balance_pending: number;
  balance_reserved: number;
  gross_volume: number;
  fees_total: number;
  refunds_total: number;
  payouts_total: number;
  last_synced_at: string | null;
  sync_error: string | null;
};

type StripeConnectionRow = {
  id: string;
  label: string;
  key_mask: string | null;
  status: "desconectado" | "conectado" | "erro";
  last_sync_at: string | null;
};

/** Contas Stripe do projeto (fonte ÚNICA usada pela aba e pelo resumo). */
export function useStripeAccounts(orgId: string | null, projectId: string | null) {
  return useRecords<StripeAccountRow>({
    table: "payment_accounts",
    columns:
      "id, name, provider, stripe_connection_id, balance_available, balance_pending, balance_reserved, gross_volume, fees_total, refunds_total, payouts_total, last_synced_at, sync_error",
    orgId: orgId ?? null,
    projectId,
    projectRequired: true,
    orderBy: { column: "name" },
    softDelete: false,
    label: "conta Stripe",
  });
}

/** Resumo do topo do Financeiro do projeto, somando as contas Stripe. */
export function StripeSummary({
  orgId,
  projectId,
}: {
  orgId: string | null;
  projectId: string | null;
}) {
  const accounts = useStripeAccounts(orgId, projectId);
  const { rate } = useEurRate();
  const stripeRows = accounts.rows.filter((a) => a.stripe_connection_id);

  const totals = useMemo(() => {
    return stripeRows.reduce(
      (acc, a) => ({
        available: acc.available + Number(a.balance_available),
        pending: acc.pending + Number(a.balance_pending),
        gross: acc.gross + Number(a.gross_volume),
        fees: acc.fees + Number(a.fees_total),
      }),
      { available: 0, pending: 0, gross: 0, fees: 0 },
    );
  }, [stripeRows]);

  if (stripeRows.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <TotalCard label="Disponível na Stripe" value={formatEuro(totals.available)} sub={approxBrl(totals.available, rate)} />
      <TotalCard label="A receber (pendente)" value={formatEuro(totals.pending)} sub={approxBrl(totals.pending, rate)} />
      <TotalCard label="Receita bruta" value={formatEuro(totals.gross)} sub={approxBrl(totals.gross, rate)} />
      <TotalCard label="Taxas" value={formatEuro(totals.fees)} sub={approxBrl(totals.fees, rate)} />
    </div>
  );
}

function timeLabel(iso: string | null) {
  if (!iso) return "nunca sincronizado";
  const d = new Date(iso);
  return `Atualizado às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Contas Stripe conectadas do projeto: conectar, sincronizar e ver os números. */
export function StripeSection({
  orgId,
  projectId,
  isAdmin,
}: {
  orgId: string | null;
  projectId: string | null;
  isAdmin: boolean;
}) {
  const accounts = useStripeAccounts(orgId, projectId);
  const { rate } = useEurRate();
  const connections = useRecords<StripeConnectionRow>({
    table: "connections",
    columns: "id, label, key_mask, status, last_sync_at",
    orgId: orgId ?? null,
    projectId,
    projectRequired: true,
    orderBy: { column: "label" },
    softDelete: false,
    label: "conexão",
  });

  const connect = useServerFn(stripeConnect);
  const sync = useServerFn(stripeSync);

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [reconnectId, setReconnectId] = useState<string | null>(null);
  // A chave nunca entra em estado do React: fica só no input até o envio.
  const keyRef = useRef<HTMLInputElement>(null);

  const connectionById = useMemo(
    () => new Map(connections.rows.map((c) => [c.id, c])),
    [connections.rows],
  );
  const stripeRows = accounts.rows.filter(
    (a) => a.stripe_connection_id && connectionById.has(a.stripe_connection_id),
  );

  function clearKey() {
    if (keyRef.current) keyRef.current.value = "";
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Sem projeto");
      const secret = keyRef.current?.value.trim() ?? "";
      clearKey();
      if (!secret) throw new Error("Informe a Secret Key.");
      return connect({
        data: {
          project_id: projectId,
          label: label.trim(),
          secret_key: secret,
          connection_id: reconnectId,
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error || "A Stripe recusou a chave.");
        return;
      }
      setOpen(false);
      setLabel("");
      setReconnectId(null);
      connections.invalidate();
      accounts.invalidate();
      toast.success("Conta Stripe conectada.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível conectar."),
  });

  const runSync = useMutation({
    mutationFn: async (connectionId: string) => sync({ data: { connection_id: connectionId } }),
    onSuccess: (result) => {
      connections.invalidate();
      accounts.invalidate();
      if (!result.ok) toast.error(result.error || "A Stripe recusou a sincronização.");
      else toast.success("Números atualizados.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível sincronizar."),
  });

  const syncAll = useMutation({
    mutationFn: async () => {
      for (const account of stripeRows) {
        if (account.stripe_connection_id) {
          await sync({ data: { connection_id: account.stripe_connection_id } });
        }
      }
    },
    onSuccess: () => {
      connections.invalidate();
      accounts.invalidate();
      toast.success("Todas as contas sincronizadas.");
    },
    onError: () => toast.error("Não foi possível sincronizar todas."),
  });

  function openConnect(connectionId: string | null, name: string) {
    setReconnectId(connectionId);
    setLabel(name);
    clearKey();
    setOpen(true);
  }

  return (
    <>
      <AppCard
        title="Contas Stripe"
        subtitle="A chave secreta fica guardada criptografada no cofre do servidor: aqui só aparecem os 4 últimos dígitos."
        actions={
          <div className="flex items-center gap-2">
            {stripeRows.length > 0 && (
              <Button
                variant="secondary"
                className="text-body"
                onClick={() => syncAll.mutate()}
                disabled={syncAll.isPending}
              >
                <RefreshCw className="size-4" aria-hidden /> Sincronizar todas
              </Button>
            )}
            {isAdmin && (
              <Button className="text-body" onClick={() => openConnect(null, "")}>
                <Plug className="size-4" aria-hidden /> Conectar conta Stripe
              </Button>
            )}
          </div>
        }
      >
        {accounts.isLoading || connections.isLoading ? (
          <LoadingState />
        ) : accounts.error || connections.error ? (
          <ErrorState onRetry={accounts.refetch} />
        ) : stripeRows.length === 0 ? (
          <EmptyState
            title="Nenhuma conta Stripe"
            message={
              isAdmin
                ? "Conecte a primeira conta para puxar saldos e vendas."
                : "Só o dono ou administradores podem conectar contas Stripe."
            }
            icon={<CreditCard className="size-5" aria-hidden />}
          />
        ) : (
          <div className="space-y-4">
            {stripeRows.map((account) => {
              const connection = connectionById.get(account.stripe_connection_id!)!;
              const isError = connection.status === "erro" || !!account.sync_error;
              return (
                <div key={account.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-body font-medium">
                        {account.name}
                        <span
                          className={
                            isError
                              ? "text-label ml-2 rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive"
                              : "text-label ml-2 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary"
                          }
                        >
                          {isError ? "erro" : "conectado"}
                        </span>
                      </p>
                      <p className="text-label text-muted-foreground">
                        {[connection.key_mask || "sem chave", timeLabel(account.last_synced_at)].join(
                          " · ",
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        className="text-body"
                        onClick={() => runSync.mutate(account.stripe_connection_id!)}
                        disabled={runSync.isPending}
                      >
                        <RefreshCw className="size-4" aria-hidden /> Sincronizar
                      </Button>
                      {isAdmin && isError && (
                        <Button
                          className="text-body"
                          onClick={() =>
                            openConnect(account.stripe_connection_id!, account.name)
                          }
                        >
                          Reconectar
                        </Button>
                      )}
                    </div>
                  </div>

                  {account.sync_error && (
                    <p className="text-label mt-2 text-destructive">
                      A Stripe respondeu: {account.sync_error}
                    </p>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <TotalCard label="Disponível" value={formatEuro(Number(account.balance_available))} sub={approxBrl(Number(account.balance_available), rate)} />
                    <TotalCard label="Pendente" value={formatEuro(Number(account.balance_pending))} sub={approxBrl(Number(account.balance_pending), rate)} />
                    <TotalCard label="Reserva" value={formatEuro(Number(account.balance_reserved))} sub={approxBrl(Number(account.balance_reserved), rate)} />
                    <TotalCard label="Receita bruta" value={formatEuro(Number(account.gross_volume))} sub={approxBrl(Number(account.gross_volume), rate)} />
                    <TotalCard label="Taxas" value={formatEuro(Number(account.fees_total))} sub={approxBrl(Number(account.fees_total), rate)} />
                    <TotalCard label="Reembolsos" value={formatEuro(Number(account.refunds_total))} sub={approxBrl(Number(account.refunds_total), rate)} />
                    <TotalCard label="Repasses" value={formatEuro(Number(account.payouts_total))} sub={approxBrl(Number(account.payouts_total), rate)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AppCard>

      <DetailPanel
        open={open}
        onOpenChange={(next) => {
          if (!next) clearKey();
          setOpen(next);
        }}
        title={reconnectId ? "Reconectar conta Stripe" : "Conectar conta Stripe"}
        description="A chave é enviada uma única vez ao servidor e guardada criptografada no cofre."
        footer={
          <Button className="text-body" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Validando…" : "Salvar"}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Nome da conta" id="stripe-label">
            <Input
              id="stripe-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Stripe Loja Principal"
              className="text-body"
            />
          </Field>
          <Field label="Secret Key" id="stripe-secret">
            <Input
              id="stripe-secret"
              ref={keyRef}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk_test_… ou sk_live_…"
              className="text-body"
            />
          </Field>
          <p className="text-label text-muted-foreground">
            A chave nunca é exibida de volta, guardada no navegador nem enviada em respostas.
          </p>
        </div>
      </DetailPanel>
    </>
  );
}
