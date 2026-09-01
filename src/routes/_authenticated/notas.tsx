import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, MoreVertical, Pencil, Pin, PinOff, Plus, StickyNote, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ConfirmDialog, RecordPanel, type FieldDef, type FieldValue } from "@/components/detail-panel";
import { RichText, RichTextEditor } from "@/components/rich-text";
import { ProjectFilter } from "@/components/project-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecords } from "@/hooks/use-records";
import { useOrgId, usePermissions } from "@/hooks/use-org";
import { useCurrentProject } from "@/hooks/use-projects";
import { ITEM_COLORS, colorSwatch } from "@/lib/board";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Notas | EuroHub" },
      {
        name: "description",
        content: "Mural de notas rápidas da empresa, com cores, fixação e busca no EuroHub.",
      },
      { property: "og:title", content: "Notas | EuroHub" },
      {
        property: "og:description",
        content: "Mural de notas rápidas da empresa, com cores, fixação e busca no EuroHub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Notas,
});

type NoteRow = {
  id: string;
  project_id: string | null;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  created_by?: string | null;
};

type Values = Record<string, FieldValue>;

const EMPTY: Values = { title: "", color: "principal", pinned: false, project_id: "" };

function Notas() {
  const { data: orgId } = useOrgId();
  const perms = usePermissions();
  const { activeProjects, projectId: currentProjectId } = useCurrentProject();

  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Values>(EMPTY);
  const [content, setContent] = useState("");
  const [toDelete, setToDelete] = useState<NoteRow | null>(null);

  const notes = useRecords<NoteRow>({
    table: "notes",
    columns: "id, project_id, title, content, color, pinned, created_by",
    orgId: orgId ?? null,
    orderBy: { column: "updated_at", ascending: false },
    trackCreatedBy: true,
    label: "nota",
  });

  const fields = useMemo<FieldDef[]>(
    () => [
      { name: "title", label: "Título (opcional)", type: "text", placeholder: "Sem título" },
      {
        name: "color",
        label: "Cor",
        type: "choice",
        options: ITEM_COLORS.map((c) => ({ value: c.value, label: c.label })),
      },
      {
        name: "project_id",
        label: "Projeto",
        type: "choice",
        options: [
          { value: "", label: "Global" },
          ...activeProjects.map((p) => ({ value: p.id, label: p.name })),
        ],
      },
      { name: "pinned", label: "Fixar no topo", type: "switch" },
    ],
    [activeProjects],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.rows
      .filter((n) => {
        if (projectFilter && n.project_id && n.project_id !== projectFilter) return false;
        if (!q) return true;
        return `${n.title} ${n.content}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [notes.rows, projectFilter, search]);

  function openNew() {
    setEditId(undefined);
    setValues({ ...EMPTY, project_id: currentProjectId ?? "" });
    setContent("");
    setPanel(true);
  }

  function openEdit(row: NoteRow) {
    setEditId(row.id);
    setValues({
      title: row.title,
      color: row.color,
      pinned: row.pinned,
      project_id: row.project_id ?? "",
    });
    setContent(row.content);
    setPanel(true);
  }

  function save() {
    notes.save.mutate(
      {
        id: editId,
        values: {
          title: String(values['title'] ?? ""),
          content,
          color: String(values['color'] ?? "principal"),
          pinned: Boolean(values['pinned']),
          project_id: String(values['project_id'] ?? "") || null,
        },
      },
      { onSuccess: () => setPanel(false) },
    );
  }

  function togglePin(row: NoteRow) {
    notes.update.mutate({ id: row.id, values: { pinned: !row.pinned } });
  }

  function setColor(row: NoteRow, color: string) {
    notes.update.mutate({ id: row.id, values: { color } });
  }

  const projectName = (id: string | null) =>
    id ? (activeProjects.find((p) => p.id === id)?.name ?? "Projeto") : "Global";

  return (
    <>
      <PageHeader
        title="Notas"
        subtitle="Anotações rápidas do dia a dia, em mural."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={openNew}>
              <Plus className="size-4" aria-hidden />
              Nova nota
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <div className="max-w-sm space-y-1">
          <Label htmlFor="notas-busca" className="text-label">
            Buscar
          </Label>
          <Input
            id="notas-busca"
            className="text-body"
            placeholder="Buscar por título ou conteúdo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ProjectFilter value={projectFilter} onChange={setProjectFilter} />
      </div>

      {notes.isLoading ? (
        <LoadingState />
      ) : notes.error ? (
        <ErrorState onRetry={notes.refetch} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nenhuma nota por aqui"
          message="Crie uma nota rápida para guardar ideias e recados do dia."
          icon={<StickyNote className="size-5" aria-hidden />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((n) => (
            <AppCard key={n.id} className="overflow-hidden">
              <div
                aria-hidden
                className={cn("-mx-5 -mt-4 mb-3 h-1.5", colorSwatch(n.color))}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-highlight truncate font-semibold">
                    {n.title || "Sem título"}
                  </h2>
                  <p className="text-label text-muted-foreground">
                    {projectName(n.project_id)}
                    {n.pinned && " · fixada"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {perms.canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={n.pinned ? "Desafixar nota" : "Fixar nota"}
                      onClick={() => togglePin(n)}
                    >
                      {n.pinned ? (
                        <PinOff className="size-4" aria-hidden />
                      ) : (
                        <Pin className="size-4" aria-hidden />
                      )}
                    </Button>
                  )}
                  {(perms.canWrite || perms.canDelete(n.created_by)) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações da nota">
                          <MoreVertical className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {perms.canWrite && (
                          <>
                            <DropdownMenuItem className="text-body" onClick={() => openEdit(n)}>
                              <Pencil className="size-4" aria-hidden />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-body"
                              onClick={() => notes.duplicate.mutate({ ...n })}
                            >
                              <Copy className="size-4" aria-hidden />
                              Duplicar
                            </DropdownMenuItem>
                            {ITEM_COLORS.map((c) => (
                              <DropdownMenuItem
                                key={c.value}
                                className="text-body"
                                onClick={() => setColor(n, c.value)}
                              >
                                <span
                                  aria-hidden
                                  className={cn(
                                    "size-2.5 rounded-full border border-border",
                                    c.swatchClassName,
                                  )}
                                />
                                Cor {c.label.toLowerCase()}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        {perms.canDelete(n.created_by) && (
                          <DropdownMenuItem className="text-body" onClick={() => setToDelete(n)}>
                            <Trash2 className="size-4" aria-hidden />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <div className="mt-2">
                <RichText value={n.content} clamp />
              </div>
            </AppCard>
          ))}
        </div>
      )}

      <RecordPanel
        open={panel}
        onOpenChange={setPanel}
        title={editId ? "Editar nota" : "Nova nota"}
        description="Conteúdo aceita negrito, listas e links."
        fields={fields}
        values={values}
        onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
        onSave={save}
        saving={notes.save.isPending}
        idPrefix="nota"
      >
        <RichTextEditor
          id="nota-conteudo"
          label="Conteúdo"
          value={content}
          onChange={setContent}
          disabled={!perms.canWrite}
        />
      </RecordPanel>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir esta nota?"
        description="A nota sai do mural e não aparece mais na lista."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (toDelete) notes.remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
    </>
  );
}
