import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BookOpen,
  Copy,
  FolderPlus,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ConfirmDialog,
  RecordPanel,
  type FieldDef,
  type FieldValue,
} from "@/components/detail-panel";
import { RichText, RichTextEditor } from "@/components/rich-text";
import { ProjectFilter } from "@/components/project-select";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecords } from "@/hooks/use-records";
import { useOrgId, usePermissions } from "@/hooks/use-org";
import { useCurrentProject } from "@/hooks/use-projects";
import { ITEM_COLORS, colorSwatch } from "@/lib/board";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/base")({
  head: () => ({
    meta: [
      { title: "Base de conhecimento | EuroHub" },
      {
        name: "description",
        content: "Processos, playbooks e documentos duradouros da empresa, organizados por coleção.",
      },
      { property: "og:title", content: "Base de conhecimento | EuroHub" },
      {
        property: "og:description",
        content: "Processos, playbooks e documentos duradouros da empresa, organizados por coleção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Base,
});

type CollectionRow = {
  id: string;
  project_id: string | null;
  name: string;
  color: string;
  position: number;
  created_by?: string | null;
};

type ArticleRow = {
  id: string;
  project_id: string | null;
  collection_id: string | null;
  title: string;
  content: string;
  tags: string[] | null;
  pinned: boolean;
  created_by?: string | null;
};

type Values = Record<string, FieldValue>;

const NO_COLLECTION = "sem-colecao";

function Base() {
  const { data: orgId } = useOrgId();
  const perms = usePermissions();
  const { activeProjects, projectId: currentProjectId } = useCurrentProject();

  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);

  const [colPanel, setColPanel] = useState(false);
  const [colId, setColId] = useState<string | undefined>(undefined);
  const [colValues, setColValues] = useState<Values>({ name: "", color: "principal", project_id: "" });
  const [colToDelete, setColToDelete] = useState<CollectionRow | null>(null);

  const [artPanel, setArtPanel] = useState(false);
  const [artId, setArtId] = useState<string | undefined>(undefined);
  const [artValues, setArtValues] = useState<Values>({
    title: "",
    tags: "",
    pinned: false,
    collection_id: "",
    project_id: "",
  });
  const [artContent, setArtContent] = useState("");
  const [artToDelete, setArtToDelete] = useState<ArticleRow | null>(null);

  const collections = useRecords<CollectionRow>({
    table: "kb_collections",
    columns: "id, project_id, name, color, position, created_by",
    orgId: orgId ?? null,
    orderBy: { column: "position", ascending: true },
    softDelete: false,
    trackCreatedBy: true,
    label: "coleção",
  });

  const articles = useRecords<ArticleRow>({
    table: "kb_articles",
    columns: "id, project_id, collection_id, title, content, tags, pinned, created_by",
    orgId: orgId ?? null,
    orderBy: { column: "updated_at", ascending: false },
    trackCreatedBy: true,
    label: "artigo",
  });

  const inProject = <T extends { project_id: string | null }>(row: T) =>
    !projectFilter || !row.project_id || row.project_id === projectFilter;

  const visibleCollections = useMemo(
    () => collections.rows.filter(inProject),
    [collections.rows, projectFilter],
  );

  const projectOptions = useMemo(
    () => [
      { value: "", label: "Global" },
      ...activeProjects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [activeProjects],
  );

  const colFields = useMemo<FieldDef[]>(
    () => [
      { name: "name", label: "Nome da coleção", type: "text", placeholder: "Ex.: Processos" },
      {
        name: "color",
        label: "Cor",
        type: "choice",
        options: ITEM_COLORS.map((c) => ({ value: c.value, label: c.label })),
      },
      { name: "project_id", label: "Projeto", type: "choice", options: projectOptions },
    ],
    [projectOptions],
  );

  const artFields = useMemo<FieldDef[]>(
    () => [
      { name: "title", label: "Título", type: "text" },
      {
        name: "collection_id",
        label: "Coleção",
        type: "choice",
        options: [
          { value: "", label: "Sem coleção" },
          ...visibleCollections.map((c) => ({ value: c.id, label: c.name })),
        ],
      },
      { name: "tags", label: "Etiquetas (separadas por vírgula)", type: "text" },
      { name: "project_id", label: "Projeto", type: "choice", options: projectOptions },
      { name: "pinned", label: "Fixar no topo", type: "switch" },
    ],
    [visibleCollections, projectOptions],
  );

  const visibleArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.rows
      .filter((a) => {
        if (!inProject(a)) return false;
        if (collectionId === NO_COLLECTION && a.collection_id) return false;
        if (collectionId && collectionId !== NO_COLLECTION && a.collection_id !== collectionId)
          return false;
        if (!q) return true;
        const tags = (a.tags ?? []).join(" ");
        return `${a.title} ${a.content} ${tags}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [articles.rows, collectionId, projectFilter, search]);

  function openNewCollection() {
    setColId(undefined);
    setColValues({ name: "", color: "principal", project_id: currentProjectId ?? "" });
    setColPanel(true);
  }

  function openEditCollection(row: CollectionRow) {
    setColId(row.id);
    setColValues({ name: row.name, color: row.color, project_id: row.project_id ?? "" });
    setColPanel(true);
  }

  function saveCollection() {
    const name = String(colValues['name'] ?? "").trim();
    if (!name) {
      toast.error("Informe o nome da coleção.");
      return;
    }
    collections.save.mutate(
      {
        id: colId,
        values: {
          name,
          color: String(colValues['color'] ?? "principal"),
          project_id: String(colValues['project_id'] ?? "") || null,
        },
      },
      { onSuccess: () => setColPanel(false) },
    );
  }

  function deleteCollection(row: CollectionRow) {
    collections.remove.mutate(row.id, {
      onSuccess: () => {
        setColToDelete(null);
        if (collectionId === row.id) setCollectionId("");
        articles.invalidate();
      },
    });
  }

  function openNewArticle() {
    setArtId(undefined);
    setArtValues({
      title: "",
      tags: "",
      pinned: false,
      collection_id: collectionId === NO_COLLECTION ? "" : collectionId,
      project_id: currentProjectId ?? "",
    });
    setArtContent("");
    setArtPanel(true);
  }

  function openEditArticle(row: ArticleRow) {
    setArtId(row.id);
    setArtValues({
      title: row.title,
      tags: (row.tags ?? []).join(", "),
      pinned: row.pinned,
      collection_id: row.collection_id ?? "",
      project_id: row.project_id ?? "",
    });
    setArtContent(row.content);
    setArtPanel(true);
  }

  function saveArticle() {
    const title = String(artValues['title'] ?? "").trim();
    if (!title) {
      toast.error("Informe o título do artigo.");
      return;
    }
    const tags = String(artValues['tags'] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    articles.save.mutate(
      {
        id: artId,
        values: {
          title,
          content: artContent,
          tags,
          pinned: Boolean(artValues['pinned']),
          collection_id: String(artValues['collection_id'] ?? "") || null,
          project_id: String(artValues['project_id'] ?? "") || null,
        },
      },
      { onSuccess: () => setArtPanel(false) },
    );
  }

  function moveArticle(row: ArticleRow, target: string | null) {
    articles.update.mutate({ id: row.id, values: { collection_id: target } });
  }

  return (
    <>
      <PageHeader
        title="Base de conhecimento"
        subtitle="Processos, playbooks e documentos feitos para consulta."
        actions={
          perms.canWrite ? (
            <>
              <Button variant="outline" className="text-body" onClick={openNewCollection}>
                <FolderPlus className="size-4" aria-hidden />
                Nova coleção
              </Button>
              <Button className="text-body" onClick={openNewArticle}>
                <Plus className="size-4" aria-hidden />
                Novo artigo
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <div className="max-w-sm space-y-1">
          <Label htmlFor="base-busca" className="text-label">
            Buscar
          </Label>
          <Input
            id="base-busca"
            className="text-body"
            placeholder="Buscar por título, conteúdo ou etiqueta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ProjectFilter value={projectFilter} onChange={setProjectFilter} />
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <AppCard title="Coleções">
          <ul className="space-y-1">
            <li>
              <CollectionButton
                active={collectionId === ""}
                label="Todos os artigos"
                onClick={() => setCollectionId("")}
              />
            </li>
            {visibleCollections.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <CollectionButton
                  active={collectionId === c.id}
                  label={c.name}
                  swatch={colorSwatch(c.color)}
                  onClick={() => setCollectionId(c.id)}
                />
                {(perms.canWrite || perms.canDelete(c.created_by)) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Ações de ${c.name}`}>
                        <MoreVertical className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {perms.canWrite && (
                        <DropdownMenuItem
                          className="text-body"
                          onClick={() => openEditCollection(c)}
                        >
                          <Pencil className="size-4" aria-hidden />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {perms.canDelete(c.created_by) && (
                        <DropdownMenuItem className="text-body" onClick={() => setColToDelete(c)}>
                          <Trash2 className="size-4" aria-hidden />
                          Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
            <li>
              <CollectionButton
                active={collectionId === NO_COLLECTION}
                label="Sem coleção"
                onClick={() => setCollectionId(NO_COLLECTION)}
              />
            </li>
          </ul>
        </AppCard>

        <div className="min-w-0 space-y-4">
          {articles.isLoading ? (
            <LoadingState />
          ) : articles.error ? (
            <ErrorState onRetry={articles.refetch} />
          ) : visibleArticles.length === 0 ? (
            <EmptyState
              title="Nenhum artigo por aqui"
              message="Crie coleções como “Processos” e escreva os documentos que a equipe consulta."
              icon={<BookOpen className="size-5" aria-hidden />}
            />
          ) : (
            visibleArticles.map((a) => {
              const open = openArticleId === a.id;
              const collection = collections.rows.find((c) => c.id === a.collection_id);
              return (
                <AppCard key={a.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setOpenArticleId(open ? null : a.id)}
                    >
                      <h2 className="text-highlight font-semibold">{a.title}</h2>
                      <p className="text-label text-muted-foreground">
                        {collection?.name ?? "Sem coleção"}
                        {a.pinned && " · fixado"}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {perms.canWrite && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={a.pinned ? "Desafixar artigo" : "Fixar artigo"}
                          onClick={() =>
                            articles.update.mutate({ id: a.id, values: { pinned: !a.pinned } })
                          }
                        >
                          {a.pinned ? (
                            <PinOff className="size-4" aria-hidden />
                          ) : (
                            <Pin className="size-4" aria-hidden />
                          )}
                        </Button>
                      )}
                      {(perms.canWrite || perms.canDelete(a.created_by)) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Ações do artigo">
                              <MoreVertical className="size-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {perms.canWrite && (
                              <>
                                <DropdownMenuItem
                                  className="text-body"
                                  onClick={() => openEditArticle(a)}
                                >
                                  <Pencil className="size-4" aria-hidden />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-body"
                                  onClick={() => articles.duplicate.mutate({ ...a })}
                                >
                                  <Copy className="size-4" aria-hidden />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-label">
                                  Mover para
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  className="text-body"
                                  onClick={() => moveArticle(a, null)}
                                >
                                  Sem coleção
                                </DropdownMenuItem>
                                {visibleCollections.map((c) => (
                                  <DropdownMenuItem
                                    key={c.id}
                                    className="text-body"
                                    onClick={() => moveArticle(a, c.id)}
                                  >
                                    {c.name}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            {perms.canDelete(a.created_by) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-body"
                                  onClick={() => setArtToDelete(a)}
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {(a.tags ?? []).length > 0 && (
                    <div className="mt-3">
                      <SelectPillGroup>
                        {(a.tags ?? []).map((t) => (
                          <SelectPill key={t} onClick={() => setSearch(t)}>
                            {t}
                          </SelectPill>
                        ))}
                      </SelectPillGroup>
                    </div>
                  )}

                  {open && (
                    <div className="mt-4 max-w-2xl leading-relaxed">
                      <RichText value={a.content} />
                    </div>
                  )}
                </AppCard>
              );
            })
          )}
        </div>
      </div>

      <RecordPanel
        open={colPanel}
        onOpenChange={setColPanel}
        title={colId ? "Editar coleção" : "Nova coleção"}
        fields={colFields}
        values={colValues}
        onChange={(name, value) => setColValues((v) => ({ ...v, [name]: value }))}
        onSave={saveCollection}
        saving={collections.save.isPending}
        idPrefix="kbcol"
      />

      <RecordPanel
        open={artPanel}
        onOpenChange={setArtPanel}
        title={artId ? "Editar artigo" : "Novo artigo"}
        description="Conteúdo aceita títulos, listas, citações, links e código."
        fields={artFields}
        values={artValues}
        onChange={(name, value) => setArtValues((v) => ({ ...v, [name]: value }))}
        onSave={saveArticle}
        saving={articles.save.isPending}
        idPrefix="kbart"
      >
        <RichTextEditor
          id="kbart-conteudo"
          label="Conteúdo"
          level="completo"
          rows={12}
          value={artContent}
          onChange={setArtContent}
          disabled={!perms.canWrite}
        />
      </RecordPanel>

      <ConfirmDialog
        open={!!colToDelete}
        onOpenChange={(o) => !o && setColToDelete(null)}
        title="Excluir esta coleção?"
        description="Os artigos dela continuam existindo e ficam em “Sem coleção”."
        confirmLabel="Excluir"
        onConfirm={() => colToDelete && deleteCollection(colToDelete)}
      />

      <ConfirmDialog
        open={!!artToDelete}
        onOpenChange={(o) => !o && setArtToDelete(null)}
        title="Excluir este artigo?"
        description="O artigo não aparece mais na base de conhecimento."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (artToDelete)
            articles.remove.mutate(artToDelete.id, { onSuccess: () => setArtToDelete(null) });
        }}
      />
    </>
  );
}

function CollectionButton({
  active,
  label,
  swatch,
  onClick,
}: {
  active: boolean;
  label: string;
  swatch?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "text-body flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {swatch && (
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-full border border-border", swatch)}
        />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}
