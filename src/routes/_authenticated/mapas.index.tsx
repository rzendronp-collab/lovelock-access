import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, MoreVertical, Network, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ConfirmDialog, RecordPanel, type FieldDef, type FieldValue } from "@/components/detail-panel";
import { ProjectFilter } from "@/components/project-select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecords } from "@/hooks/use-records";
import { useOrgId, usePermissions } from "@/hooks/use-org";
import { useCurrentProject } from "@/hooks/use-projects";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/mapas/")({
  head: () => ({
    meta: [
      { title: "Mapas mentais | EuroHub" },
      {
        name: "description",
        content: "Mapas mentais visuais da empresa: nós arrastáveis, conexões, zoom e pan.",
      },
      { property: "og:title", content: "Mapas mentais | EuroHub" },
      {
        property: "og:description",
        content: "Mapas mentais visuais da empresa: nós arrastáveis, conexões, zoom e pan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapasLista,
});

type MapRow = {
  id: string;
  project_id: string | null;
  title: string;
  nodes: unknown;
  updated_at: string;
  created_by?: string | null;
};

function MapasLista() {
  const navigate = useNavigate();
  const { data: orgId } = useOrgId();
  const perms = usePermissions();
  const { activeProjects, projectId: currentProjectId } = useCurrentProject();

  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<Record<string, FieldValue>>({ title: "", project_id: "" });
  const [toDelete, setToDelete] = useState<MapRow | null>(null);

  const maps = useRecords<MapRow>({
    table: "mindmaps",
    columns: "id, project_id, title, nodes, updated_at, created_by",
    orgId: orgId ?? null,
    orderBy: { column: "updated_at", ascending: false },
    trackCreatedBy: true,
    label: "mapa",
  });

  const fields = useMemo<FieldDef[]>(
    () => [
      { name: "title", label: "Título do mapa", type: "text", placeholder: "Novo mapa" },
      {
        name: "project_id",
        label: "Projeto",
        type: "choice",
        options: [
          { value: "", label: "Global" },
          ...activeProjects.map((p) => ({ value: p.id, label: p.name })),
        ],
      },
    ],
    [activeProjects],
  );

  const visible = useMemo(
    () =>
      maps.rows.filter(
        (m) => !projectFilter || !m.project_id || m.project_id === projectFilter,
      ),
    [maps.rows, projectFilter],
  );

  async function createMap() {
    if (!orgId) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("mindmaps")
      .insert({
        org_id: orgId,
        project_id: currentProjectId ?? null,
        title: "Novo mapa",
        created_by: userData.user?.id ?? undefined,
      })
      .select("id")
      .single();
    if (error || !data) return;
    maps.invalidate();
    navigate({ to: "/mapas/$id", params: { id: data.id } });
  }

  function openRename(row: MapRow) {
    setEditId(row.id);
    setValues({ title: row.title, project_id: row.project_id ?? "" });
    setPanel(true);
  }

  const projectName = (id: string | null) =>
    id ? (activeProjects.find((p) => p.id === id)?.name ?? "Projeto") : "Global";

  const nodeCount = (nodes: unknown) => (Array.isArray(nodes) ? nodes.length : 0);

  return (
    <>
      <PageHeader
        title="Mapas mentais"
        subtitle="Organize ideias em nós conectados, com zoom e navegação livre."
        actions={
          perms.canWrite ? (
            <Button className="text-body" onClick={createMap}>
              <Plus className="size-4" aria-hidden />
              Novo mapa
            </Button>
          ) : undefined
        }
      />

      <ProjectFilter value={projectFilter} onChange={setProjectFilter} />

      {maps.isLoading ? (
        <LoadingState />
      ) : maps.error ? (
        <ErrorState onRetry={maps.refetch} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nenhum mapa ainda"
          message="Crie um mapa para desenhar ideias, processos e conexões."
          icon={<Network className="size-5" aria-hidden />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <AppCard key={m.id}>
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 space-y-1 text-left"
                  onClick={() => navigate({ to: "/mapas/$id", params: { id: m.id } })}
                >
                  <h2 className="text-highlight truncate font-semibold">
                    {m.title || "Sem título"}
                  </h2>
                  <p className="text-label text-muted-foreground">
                    {projectName(m.project_id)} · {nodeCount(m.nodes)} nós
                  </p>
                  <p className="text-label text-muted-foreground">
                    Atualizado em {new Date(m.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </button>
                {(perms.canWrite || perms.canDelete(m.created_by)) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Ações do mapa">
                        <MoreVertical className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {perms.canWrite && (
                        <>
                          <DropdownMenuItem className="text-body" onClick={() => openRename(m)}>
                            <Pencil className="size-4" aria-hidden />
                            Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-body"
                            onClick={() => maps.duplicate.mutate({ ...m })}
                          >
                            <Copy className="size-4" aria-hidden />
                            Duplicar
                          </DropdownMenuItem>
                        </>
                      )}
                      {perms.canDelete(m.created_by) && (
                        <DropdownMenuItem className="text-body" onClick={() => setToDelete(m)}>
                          <Trash2 className="size-4" aria-hidden />
                          Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-body"
                  onClick={() => navigate({ to: "/mapas/$id", params: { id: m.id } })}
                >
                  Abrir mapa
                </Button>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      <RecordPanel
        open={panel}
        onOpenChange={setPanel}
        title="Renomear mapa"
        fields={fields}
        values={values}
        onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
        onSave={() =>
          maps.save.mutate(
            {
              id: editId,
              values: {
                title: String(values['title'] ?? "") || "Novo mapa",
                project_id: String(values['project_id'] ?? "") || null,
              },
            },
            { onSuccess: () => setPanel(false) },
          )
        }
        saving={maps.save.isPending}
        idPrefix="mapa"
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir este mapa?"
        description="O mapa sai da lista com todos os seus nós e conexões."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (toDelete) maps.remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
        }}
      />
    </>
  );
}
