import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/use-org";
import { useCurrentProject, useProjects, type ProjectRow } from "@/hooks/use-projects";

export const Route = createFileRoute("/_authenticated/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos | EuroHub" },
      {
        name: "description",
        content: "Crie, renomeie, colora e arquive os projetos da sua empresa no EuroHub.",
      },
      { property: "og:title", content: "Projetos | EuroHub" },
      {
        property: "og:description",
        content: "Crie, renomeie, colora e arquive os projetos da sua empresa no EuroHub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Projetos,
});

const COLORS = ["#0E6B45", "#1D4ED8", "#B45309", "#9333EA", "#DC2626", "#0F766E"];

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nome", type: "text", placeholder: "Ex.: Ecom" },
  {
    name: "color",
    label: "Cor",
    type: "choice",
    options: COLORS.map((c) => ({ value: c, label: c })),
  },
  { name: "archived", label: "Arquivado", type: "switch" },
];

function Projetos() {
  const perms = usePermissions();
  const records = useProjects();
  const { setProjectId, projectId } = useCurrentProject();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Record<string, FieldValue>>({
    name: "",
    color: COLORS[0]!,
    archived: false,
  });
  const [toDelete, setToDelete] = useState<ProjectRow | null>(null);

  function openNew() {
    setEditingId(undefined);
    setValues({ name: "", color: COLORS[0]!, archived: false });
    setOpen(true);
  }

  function openEdit(p: ProjectRow) {
    setEditingId(p.id);
    setValues({ name: p.name, color: p.color, archived: p.archived });
    setOpen(true);
  }

  function save() {
    const name = String(values['name'] ?? "").trim();
    if (!name) return;
    records.save.mutate(
      {
        id: editingId,
        values: {
          name,
          color: String(values['color'] ?? COLORS[0]),
          archived: Boolean(values['archived']),
          position: records.rows.length,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          records.refetch();
        },
      },
    );
  }

  const rows = records.rows;

  return (
    <>
      <PageHeader
        title="Projetos"
        subtitle="Cada projeto tem seu próprio Dinheiro, Trabalho, Recebimentos e Metas."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={openNew}>
              <Plus className="size-4" aria-hidden /> Novo projeto
            </Button>
          ) : undefined
        }
      />

      <AppCard title="Seus projetos" subtitle="Escolha qual usar no seletor do cabeçalho.">
        {records.isLoading ? (
          <LoadingState />
        ) : records.error ? (
          <ErrorState onRetry={records.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhum projeto"
            message="Ainda não há nada aqui. Crie o primeiro projeto para começar."
            icon={<FolderKanban className="size-5" aria-hidden />}
            action={
              perms.canWrite ? (
                <Button className="text-body" onClick={openNew}>
                  Novo projeto
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                />
                <div className="min-w-40 flex-1">
                  <p className="text-body font-medium">{p.name}</p>
                  <p className="text-label text-muted-foreground">
                    {p.archived ? "Arquivado" : p.id === projectId ? "Em uso agora" : "Ativo"}
                  </p>
                </div>
                {!p.archived && p.id !== projectId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-label"
                    onClick={() => setProjectId(p.id)}
                  >
                    Usar
                  </Button>
                )}
                {perms.canWrite && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`arq-${p.id}`} className="text-label text-muted-foreground">
                      Arquivado
                    </Label>
                    <Switch
                      id={`arq-${p.id}`}
                      checked={p.archived}
                      onCheckedChange={(v) =>
                        records.update.mutate({ id: p.id, values: { archived: v } })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar projeto"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    {perms.canDelete(p.created_by) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir projeto"
                        onClick={() => setToDelete(p)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <RecordPanel
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Editar projeto" : "Novo projeto"}
        description="Nome, cor e se ele fica arquivado."
        fields={FIELDS}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        onSave={save}
        saving={records.save.isPending}
        idPrefix="pj"
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir projeto?"
        description="Todo o Dinheiro, Trabalho, Recebimentos e Metas deste projeto vão junto. Para guardar o histórico, prefira arquivar."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!toDelete) return;
          records.remove.mutate(toDelete.id, {
            onSuccess: () => {
              if (toDelete.id === projectId) setProjectId(null);
              setToDelete(null);
            },
          });
        }}
      />
    </>
  );
}
