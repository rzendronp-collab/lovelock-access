import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, CreditCard, Pencil, Plug, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState } from "@/components/states";
import {
  ConfirmDialog,
  RecordPanel,
  type FieldDef,
  type FieldValue,
} from "@/components/detail-panel";
import { RecordList } from "@/components/record-list";
import { TotalCard } from "@/components/total-card";
import { PeriodPicker, toISODate, usePeriodPicker } from "@/components/period-picker";
import { useRecords } from "@/hooks/use-records";
import { useOrgId, useOrgRole, usePermissions } from "@/hooks/use-org";
import { useCurrentProject } from "@/hooks/use-projects";
import { NoProjectState } from "@/components/project-select";
import { StripeSection, StripeSummary } from "@/components/stripe-accounts";


import { Button } from "@/components/ui/button";
import { approxBrl, formatDate, formatEuro } from "@/lib/finance";
import { useEurRate } from "@/hooks/use-eur-rate";
import {
  deleteReceipt,
  maskKey,
  netAmount,
  payoutDate,
  saveReceipt,
  type ConnectionRow,
  type PaymentAccountRow,
  type PaymentReceiptRow,
} from "@/lib/receipts";

const TITLE = "Recebimentos | EuroHub";
const DESCRIPTION =
  "Contas de recebimento, conexões e recebimentos da empresa, com previsão de repasse.";

export const Route = createFileRoute("/_authenticated/recebimentos")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Recebimentos,
});

type Tab = "recebimentos" | "contas" | "conexoes";
type Values = Record<string, FieldValue>;

function toNumber(value: FieldValue | undefined) {
  return Number(String(value ?? "").replace(",", ".")) || 0;
}

function Recebimentos() {
  const [tab, setTab] = useState<Tab>("recebimentos");
  const { data: orgId } = useOrgId();
  const { projectId } = useCurrentProject();
  const { data: role } = useOrgRole();
  const isAdmin = role === "dono" || role === "admin";

  // Controles da barra compacta (apresentação): período, busca e filtro por conta.
  const { key, setKey, custom, setCustom, period } = usePeriodPicker("mes");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptGroup, setReceiptGroup] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [connectionSearch, setConnectionSearch] = useState("");

  const accounts = useRecords<PaymentAccountRow & { id: string }>({
    table: "payment_accounts",
    columns: "id, name, provider, fee_percent, payout_days, color, created_by",
    orgId: orgId ?? null,
    projectId,
    projectRequired: true,
    orderBy: { column: "name" },
    softDelete: false,
    label: "conta",
  });

  if (!projectId) {
    return (
      <>
        <PageHeader title="Recebimentos" subtitle={DESCRIPTION} />
        <AppCard>
          <NoProjectState />
        </AppCard>
      </>
    );
  }

  const searchProps =
    tab === "recebimentos"
      ? {
          value: receiptSearch,
          onChange: setReceiptSearch,
          label: "Buscar descrição",
          placeholder: "Ex.: venda site",
          id: "busca-recebimentos",
        }
      : tab === "contas"
        ? {
            value: accountSearch,
            onChange: setAccountSearch,
            label: "Buscar conta",
            placeholder: "Ex.: Stripe",
            id: "busca-contas",
          }
        : {
            value: connectionSearch,
            onChange: setConnectionSearch,
            label: "Buscar conexão",
            placeholder: "Ex.: stripe",
            id: "busca-conexoes",
          };

  return (
    <>
      <PageHeader title="Recebimentos" subtitle={DESCRIPTION} />

      <Toolbar>
        <ToolbarTabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "recebimentos", label: "Recebimentos" },
            { value: "contas", label: "Contas de recebimento" },
            { value: "conexoes", label: "Conexões" },
          ]}
        />

        {tab === "recebimentos" && (
          <PeriodPicker value={key} onChange={setKey} custom={custom} onCustomChange={setCustom} />
        )}

        <ToolbarSearch {...searchProps} />

        {tab === "recebimentos" && (
          <ToolbarFilters activeCount={receiptGroup ? 1 : 0}>
            <div>
              <p className="text-label mb-2 font-medium text-muted-foreground">Conta</p>
              <SelectPillGroup>
                <SelectPill active={!receiptGroup} onClick={() => setReceiptGroup("")}>
                  Todas as contas
                </SelectPill>
                {accounts.rows.map((a) => (
                  <SelectPill
                    key={a.id}
                    active={receiptGroup === a.name}
                    onClick={() => setReceiptGroup(a.name)}
                  >
                    {a.name}
                  </SelectPill>
                ))}
              </SelectPillGroup>
            </div>
          </ToolbarFilters>
        )}
      </Toolbar>

      <StripeSummary orgId={orgId ?? null} projectId={projectId} />

      {tab === "recebimentos" && (
        <ReceiptsSection
          orgId={orgId ?? null}
          projectId={projectId}
          accounts={accounts.rows}
          period={period}
          search={receiptSearch}
          group={receiptGroup}
        />
      )}
      {tab === "contas" && <AccountsSection records={accounts} search={accountSearch} />}
      {tab === "conexoes" && (
        <>
          <StripeSection orgId={orgId ?? null} projectId={projectId} isAdmin={isAdmin} />
          <ConnectionsSection orgId={orgId ?? null} isAdmin={isAdmin} search={connectionSearch} />
        </>
      )}
    </>
  );
}




/* ------------------------------- Recebimentos ------------------------------ */

function emptyReceiptValues(accountId: string): Values {
  return {
    date: toISODate(new Date()),
    description: "",
    account_id: accountId,
    gross: "",
    fee_percent: "",
    paid_out: false,
    external_id: "",
  };
}

function ReceiptsSection({
  orgId,
  projectId,
  accounts,
  period,
  search,
  group,
}: {
  orgId: string | null;
  projectId: string | null;
  accounts: (PaymentAccountRow & { id: string })[];
  period: Period;
  search: string;
  group: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(() => emptyReceiptValues(""));
  const [toDelete, setToDelete] = useState<PaymentReceiptRow | null>(null);
  const perms = usePermissions();
  const { rate } = useEurRate();


  const receipts = useRecords<PaymentReceiptRow & { id: string }>({
    table: "payment_receipts",
    columns:
      "id, account_id, date, description, gross, fee_percent, paid_out, external_id, finance_entry_id, created_by",
    orgId: orgId ?? null,
    projectId,
    projectRequired: true,
    orderBy: { column: "date", ascending: false },
    label: "recebimento",
  });


  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const fields: FieldDef[] = useMemo(
    () => [
      { name: "date", label: "Data", type: "date" },
      { name: "description", label: "Descrição", type: "text" },
      {
        name: "account_id",
        label: "Conta de recebimento",
        type: "choice",
        options: accounts.map((a) => ({ value: a.id, label: a.name })),
      },
      { name: "gross", label: "Valor bruto", type: "decimal" },
      { name: "fee_percent", label: "Taxa (%)", type: "decimal" },
      { name: "paid_out", label: "Já caiu na conta", type: "switch" },
      { name: "external_id", label: "Identificador externo (opcional)", type: "text" },
    ],
    [accounts],
  );

  const inPeriod = useMemo(
    () => receipts.rows.filter((r) => r.date >= period.from && r.date <= period.to),
    [receipts.rows, period.from, period.to],
  );

  const summary = useMemo(() => {
    let gross = 0;
    let net = 0;
    let pending = 0;
    for (const r of inPeriod) {
      gross += Number(r.gross);
      const n = netAmount(Number(r.gross), Number(r.fee_percent));
      net += n;
      if (!r.paid_out) pending += n;
    }
    return { gross, net, fee: gross - net, pending };
  }, [inPeriod]);

  /** Previsão: recebimentos ainda não repassados, agrupados pela data prevista. */
  const forecast = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receipts.rows) {
      if (r.paid_out) continue;
      const days = r.account_id ? (accountById.get(r.account_id)?.payout_days ?? 0) : 0;
      const when = payoutDate(r.date, days);
      map.set(when, (map.get(when) ?? 0) + netAmount(Number(r.gross), Number(r.fee_percent)));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [receipts.rows, accountById]);

  function setValue(name: string, value: FieldValue) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // Ao escolher a conta, sugere a taxa padrão dela.
      if (name === "account_id") {
        const acc = accountById.get(String(value));
        if (acc && !String(prev['fee_percent'] ?? "").trim()) {
          next['fee_percent'] = String(acc.fee_percent);
        }
      }
      return next;
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sem empresa");
      const accountId = String(values['account_id'] ?? "") || null;
      await saveReceipt({
        orgId,
        projectId,
        id: editingId,

        input: {
          account_id: accountId,
          date: String(values['date'] ?? ""),
          description: String(values['description'] ?? "").trim(),
          gross: toNumber(values['gross']),
          fee_percent: toNumber(values['fee_percent']),
          paid_out: Boolean(values['paid_out']),
          external_id: String(values['external_id'] ?? "").trim() || null,
        },
        accountName: accountId ? (accountById.get(accountId)?.name ?? "") : "",
      });
    },
    onSuccess: () => {
      setOpen(false);
      receipts.invalidate();
      void queryClient.invalidateQueries({ queryKey: ["records", "finance_entries"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Recebimento salvo e lançado no Dinheiro.");
    },
    onError: () => toast.error("Não foi possível salvar o recebimento."),
  });

  const remove = useMutation({
    mutationFn: (receipt: PaymentReceiptRow) => deleteReceipt(receipt),
    onSuccess: () => {
      setToDelete(null);
      receipts.invalidate();
      void queryClient.invalidateQueries({ queryKey: ["records", "finance_entries"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Recebimento excluído.");
    },
    onError: () => toast.error("Não foi possível excluir."),
  });

  function openNew() {
    setEditingId(undefined);
    setValues(emptyReceiptValues(accounts[0]?.id ?? ""));
    setOpen(true);
  }

  function fill(r: PaymentReceiptRow, keepId: boolean) {
    setEditingId(keepId ? r.id : undefined);
    setValues({
      date: keepId ? r.date : toISODate(new Date()),
      description: r.description,
      account_id: r.account_id ?? "",
      gross: String(r.gross),
      fee_percent: String(r.fee_percent),
      paid_out: keepId ? r.paid_out : false,
      external_id: keepId ? (r.external_id ?? "") : "",
    });
    setOpen(true);
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalCard label="Bruto" value={formatEuro(summary.gross)} sub={approxBrl(summary.gross, rate)} />
        <TotalCard label="Taxas" value={formatEuro(summary.fee)} sub={approxBrl(summary.fee, rate)} />
        <TotalCard label="Líquido" value={formatEuro(summary.net)} sub={approxBrl(summary.net, rate)} />
        <TotalCard label="A cair" value={formatEuro(summary.pending)} sub={approxBrl(summary.pending, rate)} />
      </div>

      <AppCard
        title="Recebimentos do período"
        subtitle="Cada recebimento salvo cria automaticamente uma entrada no Dinheiro."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={openNew} disabled={!orgId}>
              <Plus className="size-4" aria-hidden /> Novo recebimento manual
            </Button>
          ) : undefined
        }
      >
        <RecordList<PaymentReceiptRow & { id: string }>
          items={inPeriod}
          getKey={(r) => r.id}
          getSearchText={(r) => `${r.description} ${r.external_id ?? ""}`}
          getGroup={(r) => (r.account_id ? (accountById.get(r.account_id)?.name ?? "") : "")}
          search={search}
          onSearchChange={() => undefined}
          group={group}
          hideControls

          loading={receipts.isLoading}
          error={receipts.error}
          onRetry={receipts.refetch}
          empty={{
            title: "Nenhum recebimento",
            message: "Ainda não há nada aqui neste período.",
            icon: <CreditCard className="size-5" aria-hidden />,
            ...(perms.canWrite
              ? {
                  action: (
                    <Button className="text-body" onClick={openNew} disabled={!orgId}>
                      Novo recebimento manual
                    </Button>
                  ),
                }
              : {}),
          }}
          renderItem={(r) => (
            <>
              <span className="text-label w-20 text-muted-foreground">{formatDate(r.date)}</span>
              <div className="min-w-40 flex-1">
                <p className="text-body font-medium">
                  {r.description || "Recebimento"}
                  {!r.paid_out && (
                    <span className="text-label ml-2 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                      a cair
                    </span>
                  )}
                </p>
                <p className="text-label text-muted-foreground">
                  {[
                    r.account_id ? (accountById.get(r.account_id)?.name ?? "conta removida") : "sem conta",
                    `bruto ${formatEuro(Number(r.gross))}`,
                    `taxa ${Number(r.fee_percent)}%`,
                  ].join(" · ")}
                </p>
              </div>
              <span className="text-body font-semibold text-primary">
                {formatEuro(netAmount(Number(r.gross), Number(r.fee_percent)))}
              </span>
              <div className="flex items-center gap-1">
                {perms.canWrite && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Duplicar recebimento"
                      onClick={() => fill(r, false)}
                    >
                      <Copy className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar recebimento"
                      onClick={() => fill(r, true)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                  </>
                )}
                {perms.canDelete(r.created_by) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir recebimento"
                    onClick={() => setToDelete(r)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>
            </>
          )}
        />
      </AppCard>

      <AppCard
        title="Previsão de repasse"
        subtitle="Soma do que ainda não caiu, pela data prevista (data + dias de repasse da conta)."
      >
        {forecast.length === 0 ? (
          <EmptyState
            title="Nada a cair"
            message="Todos os recebimentos já foram repassados."
            icon={<CreditCard className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {forecast.map(([when, amount]) => (
              <li key={when} className="flex items-center justify-between py-2">
                <span className="text-body">{formatDate(when)}</span>
                <span className="text-body font-semibold text-primary">
                  {formatEuro(amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <RecordPanel
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar recebimento" : "Novo recebimento manual"}
        description="O valor líquido é lançado como entrada no Dinheiro."
        fields={fields}
        values={values}
        onChange={setValue}
        onSave={() => save.mutate()}
        saving={save.isPending}
        idPrefix="rec"
      >
        <p className="text-label text-muted-foreground">
          Líquido:{" "}
          {formatEuro(netAmount(toNumber(values['gross']), toNumber(values['fee_percent'])))}
        </p>
      </RecordPanel>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir recebimento?"
        description="O lançamento criado no Dinheiro também sai da lista."
        confirmLabel="Excluir"
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </>
  );
}

/* --------------------------- Contas de recebimento -------------------------- */

const ACCOUNT_FIELDS: FieldDef[] = [
  { name: "name", label: "Nome", type: "text" },
  { name: "provider", label: "Provedor", type: "text", placeholder: "Ex.: Stripe" },
  { name: "fee_percent", label: "Taxa (%)", type: "decimal" },
  { name: "payout_days", label: "Dias de repasse", type: "number", min: 0 },
  {
    name: "color",
    label: "Cor",
    type: "choice",
    options: [
      { value: "#64748b", label: "Cinza" },
      { value: "#0ea5e9", label: "Azul" },
      { value: "#14b8a6", label: "Verde" },
      { value: "#f59e0b", label: "Âmbar" },
      { value: "#ef4444", label: "Vermelho" },
    ],
  },
];

function emptyAccountValues(): Values {
  return { name: "", provider: "", fee_percent: "", payout_days: "0", color: "#64748b" };
}

function AccountsSection({
  records,
  search,
}: {
  records: ReturnType<typeof useRecords<PaymentAccountRow & { id: string }>>;
  search: string;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(emptyAccountValues);

  const [toDelete, setToDelete] = useState<string | null>(null);

  function openNew() {
    setEditingId(undefined);
    setValues(emptyAccountValues());
    setOpen(true);
  }

  const perms = usePermissions();

  return (
    <>
      <AppCard
        title="Contas de recebimento"
        subtitle="Onde o dinheiro entra: provedor, taxa e prazo de repasse."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={openNew}>
              <Plus className="size-4" aria-hidden /> Nova conta
            </Button>
          ) : undefined
        }
      >
        <RecordList<PaymentAccountRow & { id: string }>
          items={records.rows}
          getKey={(a) => a.id}
          getSearchText={(a) => `${a.name} ${a.provider}`}
          search={search}
          onSearchChange={() => undefined}
          hideControls

          loading={records.isLoading}
          error={records.error}
          onRetry={records.refetch}
          empty={{
            title: "Nenhuma conta",
            message: "Cadastre a primeira conta de recebimento.",
            icon: <CreditCard className="size-5" aria-hidden />,
            ...(perms.canWrite
              ? {
                  action: (
                    <Button className="text-body" onClick={openNew}>
                      Nova conta
                    </Button>
                  ),
                }
              : {}),
          }}
          renderItem={(a) => (
            <>
              <span
                aria-hidden
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: a.color }}
              />
              <div className="min-w-40 flex-1">
                <p className="text-body font-medium">{a.name}</p>
                <p className="text-label text-muted-foreground">
                  {[
                    a.provider || "sem provedor",
                    `taxa ${Number(a.fee_percent)}%`,
                    `repasse em ${a.payout_days} dia(s)`,
                  ].join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {perms.canWrite && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Editar conta"
                  onClick={() => {
                    setEditingId(a.id);
                    setValues({
                      name: a.name,
                      provider: a.provider,
                      fee_percent: String(a.fee_percent),
                      payout_days: String(a.payout_days),
                      color: a.color,
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                )}
                {perms.canDelete(a.created_by) && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir conta"
                  onClick={() => setToDelete(a.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
                )}
              </div>
            </>
          )}
        />
      </AppCard>

      <RecordPanel
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar conta" : "Nova conta de recebimento"}
        fields={ACCOUNT_FIELDS}
        values={values}
        onChange={(name, value) => setValues((p) => ({ ...p, [name]: value }))}
        onSave={() =>
          records.save.mutate(
            {
              id: editingId,
              values: {
                name: String(values['name'] ?? "").trim(),
                provider: String(values['provider'] ?? "").trim(),
                fee_percent: toNumber(values['fee_percent']),
                payout_days: Math.max(0, Number(values['payout_days']) || 0),
                color: String(values['color'] ?? "#64748b"),
              },
            },
            { onSuccess: () => setOpen(false) },
          )
        }
        saving={records.save.isPending}
        idPrefix="pa"
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir conta?"
        description="Os recebimentos ligados a ela ficam sem conta."
        confirmLabel="Excluir"
        onConfirm={() =>
          toDelete && records.remove.mutate(toDelete, { onSuccess: () => setToDelete(null) })
        }
      />
    </>
  );
}

/* --------------------------------- Conexões -------------------------------- */

const STATUS_LABEL: Record<ConnectionRow["status"], string> = {
  desconectado: "desconectado",
  conectado: "conectado",
  erro: "erro",
};

const CONNECTION_FIELDS: FieldDef[] = [
  { name: "provider", label: "Provedor", type: "text", placeholder: "Ex.: stripe" },
  { name: "label", label: "Rótulo", type: "text", placeholder: "Ex.: Conta principal" },
  {
    name: "secret_ref",
    label: "Nome da variável no servidor",
    type: "text",
    placeholder: "Ex.: STRIPE_SECRET_KEY",
  },
  {
    name: "key_last4",
    label: "Últimos 4 dígitos da chave (só para exibir)",
    type: "text",
    placeholder: "4242",
  },
  {
    name: "status",
    label: "Situação",
    type: "choice",
    options: [
      { value: "desconectado", label: "Desconectado" },
      { value: "conectado", label: "Conectado" },
      { value: "erro", label: "Erro" },
    ],
  },
];

function emptyConnectionValues(): Values {
  return { provider: "", label: "", secret_ref: "", key_last4: "", status: "desconectado" };
}

function ConnectionsSection({
  orgId,
  isAdmin,
  search,
}: {
  orgId: string | null;
  isAdmin: boolean;
  search: string;
}) {
  const records = useRecords<ConnectionRow & { id: string }>({
    table: "connections",
    columns: "id, provider, label, secret_ref, key_mask, status, last_sync_at",
    orgId: orgId ?? null,
    orderBy: { column: "provider" },
    softDelete: false,
    label: "conexão",
  });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(emptyConnectionValues);

  const [toDelete, setToDelete] = useState<string | null>(null);

  return (
    <>
      <AppCard
        title="Conexões"
        subtitle="A chave em si nunca é guardada aqui: só o nome da variável no servidor e os últimos dígitos."
        actions={
          isAdmin ? (
            <Button
              className="text-body"
              onClick={() => {
                setEditingId(undefined);
                setValues(emptyConnectionValues());
                setOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden /> Nova conexão
            </Button>
          ) : undefined
        }
      >
        <RecordList<ConnectionRow & { id: string }>
          items={records.rows}
          getKey={(c) => c.id}
          getSearchText={(c) => `${c.provider} ${c.label}`}
          search={search}
          onSearchChange={() => undefined}
          hideControls

          loading={records.isLoading}
          error={records.error}
          onRetry={records.refetch}
          empty={{
            title: "Nenhuma conexão",
            message: isAdmin
              ? "Cadastre uma conexão apontando para a variável de ambiente do servidor."
              : "Só o dono ou administradores podem cadastrar conexões.",
            icon: <Plug className="size-5" aria-hidden />,
          }}
          renderItem={(c) => (
            <>
              <div className="min-w-40 flex-1">
                <p className="text-body font-medium">
                  {c.label || c.provider}
                  <span
                    className={
                      c.status === "conectado"
                        ? "text-label ml-2 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary"
                        : c.status === "erro"
                          ? "text-label ml-2 rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive"
                          : "text-label ml-2 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground"
                    }
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                </p>
                <p className="text-label text-muted-foreground">
                  {[c.provider, c.key_mask || "sem chave", c.secret_ref || "sem variável"].join(
                    " · ",
                  )}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar conexão"
                    onClick={() => {
                      setEditingId(c.id);
                      setValues({
                        provider: c.provider,
                        label: c.label,
                        secret_ref: c.secret_ref ?? "",
                        key_last4: "",
                        status: c.status,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover conexão"
                    onClick={() => setToDelete(c.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              )}
            </>
          )}
        />
      </AppCard>

      <RecordPanel
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar conexão" : "Nova conexão"}
        description="Guarde apenas a referência da chave — nunca a chave inteira."
        fields={CONNECTION_FIELDS}
        values={values}
        onChange={(name, value) => setValues((p) => ({ ...p, [name]: value }))}
        onSave={() => {
          const last4 = String(values['key_last4'] ?? "").trim();
          const mask = last4 ? maskKey(last4) : editingId ? undefined : null;
          records.save.mutate(
            {
              id: editingId,
              values: {
                provider: String(values['provider'] ?? "").trim(),
                label: String(values['label'] ?? "").trim(),
                secret_ref: String(values['secret_ref'] ?? "").trim() || null,
                status: String(values['status'] ?? "desconectado"),
                ...(mask === undefined ? {} : { key_mask: mask }),
              },
            },
            { onSuccess: () => setOpen(false) },
          );
        }}
        saving={records.save.isPending}
        idPrefix="conn"
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remover conexão?"
        description="A chave no servidor continua intacta; só o registro sai daqui."
        confirmLabel="Remover"
        onConfirm={() =>
          toDelete && records.remove.mutate(toDelete, { onSuccess: () => setToDelete(null) })
        }
      />
    </>
  );
}
