import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Pencil, Plus, Trash2, Users, Wallet, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { RecordList } from "@/components/record-list";
import { EmptyState } from "@/components/states";
import {
  ConfirmDialog,
  DetailPanel,
  RecordPanel,
  type FieldDef,
  type FieldValue,
} from "@/components/detail-panel";
import { Button } from "@/components/ui/button";
import { useRecords } from "@/hooks/use-records";
import { useOrgId } from "@/hooks/use-org";
import { CONTACT_KINDS, contactKindLabel, type ContactRow } from "@/hooks/use-contacts";
import { formatDateBR } from "@/lib/board";
import { formatMoney } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas | EuroHub" },
      {
        name: "description",
        content:
          "Clientes, fornecedores, parceiros e equipe da empresa, com a linha do tempo de tudo que está ligado a cada pessoa.",
      },
      { property: "og:title", content: "Pessoas | EuroHub" },
      {
        property: "og:description",
        content:
          "Clientes, fornecedores, parceiros e equipe da empresa, com a linha do tempo de tudo que está ligado a cada pessoa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pessoas,
});

type EntryRow = {
  id: string;
  entry_date: string;
  description: string;
  kind: string;
  amount: number;
  contact_id: string | null;
};

type CardRow = {
  id: string;
  title: string;
  due_date: string | null;
  created_at: string;
  contact_id: string | null;
};

type FileRow = {
  id: string;
  name: string;
  created_at: string;
  contact_id: string | null;
};

type Values = Record<string, FieldValue>;

const CONTACT_FIELDS: FieldDef[] = [
  {
    name: "kind",
    label: "Tipo",
    type: "choice",
    options: CONTACT_KINDS.map((k) => ({ value: k.value, label: k.label })),
  },
  { name: "name", label: "Nome", type: "text" },
  { name: "email", label: "E-mail", type: "text" },
  { name: "phone", label: "Telefone", type: "text" },
  { name: "doc", label: "Documento", type: "text" },
  { name: "note", label: "Observação", type: "textarea" },
];

function emptyValues(): Values {
  return { kind: "cliente", name: "", email: "", phone: "", doc: "", note: "" };
}

function Pessoas() {
  const { data: orgId } = useOrgId();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(emptyValues);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const contacts = useRecords<ContactRow>({
    table: "contacts",
    columns: "id, kind, name, email, phone, doc, note",
    orgId: orgId ?? null,
    orderBy: { column: "name", ascending: true },
    trackCreatedBy: true,
    label: "contato",
  });

  const entries = useRecords<EntryRow>({
    table: "finance_entries",
    columns: "id, entry_date, description, kind, amount, contact_id",
    orgId: orgId ?? null,
    orderBy: { column: "entry_date", ascending: false },
    label: "lançamento",
  });

  const cards = useRecords<CardRow>({
    table: "cards",
    columns: "id, title, due_date, created_at, contact_id",
    orgId: orgId ?? null,
    orderBy: { column: "created_at", ascending: false },
    label: "cartão",
  });

  const files = useRecords<FileRow>({
    table: "files",
    columns: "id, name, created_at, contact_id",
    orgId: orgId ?? null,
    orderBy: { column: "created_at", ascending: false },
    label: "arquivo",
  });

  const detail = useMemo(
    () => contacts.rows.find((c) => c.id === detailId) ?? null,
    [contacts.rows, detailId],
  );

  const timeline = useMemo(() => {
    if (!detailId) return [];
    const out: {
      id: string;
      date: string;
      title: string;
      meta: string;
      icon: typeof Wallet;
      to: "/dinheiro" | "/trabalho" | "/arquivos";
      search: Record<string, string>;
    }[] = [];

    for (const e of entries.rows.filter((r) => r.contact_id === detailId)) {
      out.push({
        id: `e:${e.id}`,
        date: e.entry_date,
        title: e.description || "Lançamento",
        meta: `Dinheiro · ${e.kind === "entrada" ? "+" : "−"} ${formatMoney(Number(e.amount))}`,
        icon: Wallet,
        to: "/dinheiro",
        search: { periodo: "custom", de: e.entry_date, ate: e.entry_date },
      });
    }
    for (const c of cards.rows.filter((r) => r.contact_id === detailId)) {
      out.push({
        id: `c:${c.id}`,
        date: (c.due_date ?? c.created_at).slice(0, 10),
        title: c.title,
        meta: "Trabalho · cartão",
        icon: ListChecks,
        to: "/trabalho",
        search: { cartao: c.id },
      });
    }
    for (const f of files.rows.filter((r) => r.contact_id === detailId)) {
      out.push({
        id: `f:${f.id}`,
        date: f.created_at.slice(0, 10),
        title: f.name,
        meta: "Arquivos",
        icon: FileText,
        to: "/arquivos",
        search: {},
      });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [detailId, entries.rows, cards.rows, files.rows]);

  function openNew() {
    setEditingId(undefined);
    setValues(emptyValues());
    setPanelOpen(true);
  }

  function openEdit(row: ContactRow) {
    setEditingId(row.id);
    setValues({
      kind: row.kind,
      name: row.name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      doc: row.doc ?? "",
      note: row.note,
    });
    setPanelOpen(true);
  }

  function save() {
    const name = String(values['name'] ?? "").trim();
    if (!name) {
      toast.error("Informe o nome da pessoa.");
      return;
    }
    contacts.save.mutate(
      {
        id: editingId,
        values: {
          kind: String(values['kind'] ?? "cliente"),
          name,
          email: String(values['email'] ?? "") || null,
          phone: String(values['phone'] ?? "") || null,
          doc: String(values['doc'] ?? "") || null,
          note: String(values['note'] ?? ""),
        },
      },
      { onSuccess: () => setPanelOpen(false) },
    );
  }

  return (
    <>
      <PageHeader
        title="Pessoas"
        subtitle="Clientes, fornecedores, parceiros e equipe em um cadastro só."
        actions={
          <Button className="text-body" onClick={openNew}>
            <Plus className="size-4" aria-hidden /> Nova pessoa
          </Button>
        }
      />

      <AppCard title="Cadastro" subtitle="Filtre por tipo e busque pelo nome.">
        <RecordList<ContactRow>
          items={contacts.rows}
          getKey={(c) => c.id}
          getSearchText={(c) => `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.doc ?? ""}`}
          getGroup={(c) => contactKindLabel(c.kind)}
          search={search}
          onSearchChange={setSearch}
          searchId="busca-pessoas"
          searchLabel="Buscar pessoa"
          searchPlaceholder="Ex.: Maria"
          group={group}
          onGroupChange={setGroup}
          groupAllLabel="Todos os tipos"
          loading={contacts.isLoading}
          error={contacts.error}
          onRetry={contacts.refetch}
          empty={{
            title: "Nenhuma pessoa",
            message: "Ainda não há nada aqui. Cadastre um cliente, fornecedor, parceiro ou alguém da equipe.",
            icon: <Users className="size-5" aria-hidden />,
            action: (
              <Button className="text-body" onClick={openNew}>
                Nova pessoa
              </Button>
            ),
          }}
          renderItem={(c) => (
            <>
              <button
                type="button"
                className="min-w-40 flex-1 text-left"
                onClick={() => setDetailId(c.id)}
              >
                <p className="text-body font-medium">{c.name}</p>
                <p className="text-label text-muted-foreground">
                  {[contactKindLabel(c.kind), c.email || "", c.phone || ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Editar pessoa" onClick={() => openEdit(c)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir pessoa"
                  onClick={() => setToDelete(c.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </>
          )}
        />
      </AppCard>

      <RecordPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={editingId ? "Editar pessoa" : "Nova pessoa"}
        description="Cadastro único de clientes, fornecedores, parceiros e equipe."
        fields={CONTACT_FIELDS}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        onSave={save}
        saving={contacts.save.isPending}
        idPrefix="pessoa"
      />

      <DetailPanel
        open={!!detail}
        onOpenChange={(o) => !o && setDetailId(null)}
        title={detail?.name ?? "Pessoa"}
        description={detail ? contactKindLabel(detail.kind) : undefined}
      >
        {detail && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-label text-muted-foreground">Contato</p>
              <p className="text-body">{detail.email || "sem e-mail"}</p>
              <p className="text-body">{detail.phone || "sem telefone"}</p>
              <p className="text-body">{detail.doc || "sem documento"}</p>
              {detail.note && <p className="text-label text-muted-foreground">{detail.note}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-label text-muted-foreground">Linha do tempo</p>
              {timeline.length === 0 ? (
                <EmptyState
                  title="Nada ligado ainda"
                  message="Lançamentos, cartões e arquivos vinculados a esta pessoa aparecem aqui automaticamente."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {timeline.map((t) => {
                    const Icon = t.icon;
                    return (
                      <li key={t.id} className="py-2">
                        <Link
                          to={t.to}
                          search={t.search as never}
                          className="flex items-center gap-3"
                          onClick={() => setDetailId(null)}
                        >
                          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="text-body block truncate font-medium">{t.title}</span>
                            <span className="text-label block text-muted-foreground">{t.meta}</span>
                          </span>
                          <span className="text-label text-muted-foreground">
                            {formatDateBR(t.date)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DetailPanel>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir pessoa?"
        description="Ela sai da lista, mas o histórico fica guardado."
        confirmLabel="Excluir"
        onConfirm={() =>
          toDelete && contacts.remove.mutate(toDelete, { onSuccess: () => setToDelete(null) })
        }
      />
    </>
  );
}
