import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Eye,
  FileText,
  FolderClosed,
  FolderPlus,
  Image as ImageIcon,
  Link as LinkIcon,
  MoreVertical,
  Plus,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { RecordList } from "@/components/record-list";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState } from "@/components/states";
import {
  ConfirmDialog,
  RecordPanel,
  type FieldDef,
  type FieldValue,
} from "@/components/detail-panel";
import {
  Attachments,
  formatSize,
  removeStoragePaths,
  signedUrl,
} from "@/components/attachments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecords } from "@/hooks/use-records";
import { useOrgId } from "@/hooks/use-org";
import { ITEM_COLORS, colorSwatch } from "@/lib/board";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/arquivos")({
  head: () => ({
    meta: [
      { title: "Arquivos | EuroHub" },
      {
        name: "description",
        content:
          "Pastas, arquivos, links, notas e imagens da empresa em um só lugar no EuroHub.",
      },
      { property: "og:title", content: "Arquivos | EuroHub" },
      {
        property: "og:description",
        content:
          "Pastas, arquivos, links, notas e imagens da empresa em um só lugar no EuroHub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Arquivos,
});

type FolderRow = {
  id: string;
  parent_id: string | null;
  name: string;
  color: string;
};

type FileRow = {
  id: string;
  folder_id: string | null;
  kind: string;
  name: string;
  path: string;
  url: string;
  content: string;
  mime_type: string;
  size_bytes: number;
};

type Values = Record<string, FieldValue>;

const FOLDER_FIELDS: FieldDef[] = [
  { name: "name", label: "Nome da pasta", type: "text" },
  {
    name: "color",
    label: "Cor",
    type: "choice",
    options: ITEM_COLORS.map((c) => ({ value: c.value, label: c.label })),
  },
];

const ITEM_FIELDS: FieldDef[] = [
  {
    name: "kind",
    label: "Tipo",
    type: "choice",
    options: [
      { value: "link", label: "Link" },
      { value: "texto", label: "Texto rico" },
    ],
  },
  { name: "name", label: "Nome", type: "text" },
  {
    name: "url",
    label: "Endereço",
    type: "text",
    placeholder: "https://…",
    showWhen: (v) => v['kind'] === "link",
  },
  {
    name: "content",
    label: "Conteúdo",
    type: "textarea",
    showWhen: (v) => v['kind'] === "texto",
  },
];

const KIND_ICON: Record<string, typeof FileText> = {
  arquivo: FileText,
  imagem: ImageIcon,
  link: LinkIcon,
  texto: StickyNote,
};

const KIND_LABEL: Record<string, string> = {
  arquivo: "Arquivo",
  imagem: "Imagem",
  link: "Link",
  texto: "Texto",
};

function Arquivos() {
  const { data: orgId, isLoading: loadingOrg } = useOrgId();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [color, setColor] = useState("");

  const [folderPanel, setFolderPanel] = useState(false);
  const [folderValues, setFolderValues] = useState<Values>({ name: "", color: "principal" });
  const [itemPanel, setItemPanel] = useState(false);
  const [itemId, setItemId] = useState<string | undefined>(undefined);
  const [itemValues, setItemValues] = useState<Values>({
    kind: "link",
    name: "",
    url: "",
    content: "",
  });
  const [toDelete, setToDelete] = useState<FileRow | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderRow | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string; mime: string } | null>(null);

  const folders = useRecords<FolderRow>({
    table: "folders",
    columns: "id, parent_id, name, color",
    orgId: orgId ?? null,
    orderBy: { column: "name", ascending: true },
    trackCreatedBy: true,
    label: "pasta",
  });

  const files = useRecords<FileRow>({
    table: "files",
    columns: "id, folder_id, kind, name, path, url, content, mime_type, size_bytes",
    orgId: orgId ?? null,
    orderBy: { column: "created_at", ascending: false },
    trackCreatedBy: true,
    label: "item",
  });

  const currentFolder = useMemo(
    () => folders.rows.find((f) => f.id === folderId) ?? null,
    [folders.rows, folderId],
  );

  const trail = useMemo(() => {
    const out: FolderRow[] = [];
    let cursor = currentFolder;
    let guard = 0;
    while (cursor && guard < 20) {
      out.unshift(cursor);
      const parentId: string | null = cursor.parent_id;
      cursor = parentId ? (folders.rows.find((f) => f.id === parentId) ?? null) : null;
      guard += 1;
    }
    return out;
  }, [currentFolder, folders.rows]);

  const subfolders = useMemo(
    () => folders.rows.filter((f) => (f.parent_id ?? null) === folderId),
    [folders.rows, folderId],
  );

  const folderFiles = useMemo(
    () => files.rows.filter((f) => (f.folder_id ?? null) === folderId),
    [files.rows, folderId],
  );

  function saveFolder() {
    const name = String(folderValues['name'] ?? "").trim();
    if (!name) {
      toast.error("Informe o nome da pasta.");
      return;
    }
    folders.create.mutate(
      { name, color: String(folderValues['color'] ?? ""), parent_id: folderId },
      {
        onSuccess: () => {
          setFolderPanel(false);
          setFolderValues({ name: "", color: "principal" });
        },
      },
    );
  }

  function openNewItem() {
    setItemId(undefined);
    setItemValues({ kind: "link", name: "", url: "", content: "" });
    setItemPanel(true);
  }

  function openEditItem(row: FileRow) {
    setItemId(row.id);
    setItemValues({
      kind: row.kind === "texto" ? "texto" : row.kind === "link" ? "link" : row.kind,
      name: row.name,
      url: row.url,
      content: row.content,
    });
    setItemPanel(true);
  }

  function saveItem() {
    const name = String(itemValues['name'] ?? "").trim();
    if (!name) {
      toast.error("Informe o nome do item.");
      return;
    }
    files.save.mutate(
      {
        id: itemId,
        values: {
          folder_id: folderId,
          kind: String(itemValues['kind'] ?? "link"),
          name,
          url: String(itemValues['url'] ?? ""),
          content: String(itemValues['content'] ?? ""),
        },
      },
      { onSuccess: () => setItemPanel(false) },
    );
  }

  async function deleteItem(row: FileRow) {
    try {
      if (row.path) await removeStoragePaths([row.path]);
    } catch {
      toast.error("Não foi possível excluir o arquivo do armazenamento.");
      return;
    }
    files.remove.mutate(row.id, { onSuccess: () => setToDelete(null) });
  }

  async function deleteFolder(row: FolderRow) {
    const inside = files.rows.filter((f) => f.folder_id === row.id);
    try {
      await removeStoragePaths(inside.map((f) => f.path).filter(Boolean));
    } catch {
      toast.error("Não foi possível excluir os arquivos da pasta.");
      return;
    }
    for (const f of inside) files.remove.mutate(f.id);
    folders.remove.mutate(row.id, {
      onSuccess: () => {
        setFolderToDelete(null);
        if (folderId === row.id) setFolderId(row.parent_id ?? null);
      },
    });
  }

  async function openPreview(row: FileRow) {
    if (row.kind === "link") {
      window.open(row.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (row.kind === "texto") {
      setPreview({ name: row.name, url: "", mime: "text/plain" });
      setItemValues({ kind: "texto", name: row.name, url: "", content: row.content });
      return;
    }
    const url = await signedUrl(row.path, undefined, 300);
    if (!url) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    setPreview({ name: row.name, url, mime: row.mime_type });
  }

  const loading = loadingOrg || folders.isLoading || files.isLoading;

  return (
    <>
      <PageHeader
        title="Arquivos"
        subtitle="Pastas, arquivos, links, notas e imagens da empresa."
        actions={
          <>
            <Button variant="outline" className="text-body" onClick={() => setFolderPanel(true)}>
              <FolderPlus className="size-4" aria-hidden />
              Nova pasta
            </Button>
            <Button className="text-body" onClick={openNewItem}>
              <Plus className="size-4" aria-hidden />
              Novo item
            </Button>
          </>
        }
      />

      <AppCard title="Pastas" subtitle="Clique para entrar; subpastas ficam dentro da pasta atual.">
        <div className="space-y-3">
          <SelectPillGroup>
            <SelectPill active={folderId === null} onClick={() => setFolderId(null)}>
              Raiz
            </SelectPill>
            {trail.map((f) => (
              <SelectPill key={f.id} active={folderId === f.id} onClick={() => setFolderId(f.id)}>
                <span aria-hidden className={cn("size-2 rounded-full", colorSwatch(f.color))} />
                {f.name}
              </SelectPill>
            ))}
          </SelectPillGroup>

          {subfolders.length === 0 ? (
            <p className="text-body text-muted-foreground">
              Nenhuma subpasta aqui. Crie uma com “Nova pasta”.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {subfolders.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2">
                  <span aria-hidden className={cn("size-2.5 rounded-full", colorSwatch(f.color))} />
                  <button
                    type="button"
                    className="text-body flex flex-1 items-center gap-2 text-left font-medium hover:underline"
                    onClick={() => setFolderId(f.id)}
                  >
                    <FolderClosed className="size-4 text-muted-foreground" aria-hidden />
                    {f.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-label"
                    onClick={() => setFolderToDelete(f)}
                  >
                    Excluir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppCard>

      <AppCard
        title={currentFolder ? currentFolder.name : "Raiz"}
        subtitle="Arquivos, links, notas e imagens juntos na mesma lista."
      >
        <div className="space-y-4">
          <Attachments
            orgId={orgId ?? null}
            folder={`arquivos/${folderId ?? "raiz"}`}
            showList={false}
            buttonLabel="Enviar arquivo ou imagem"
            onUploaded={(uploaded) => {
              for (const u of uploaded) {
                files.create.mutate({
                  folder_id: folderId,
                  kind: u.mime.startsWith("image/") ? "imagem" : "arquivo",
                  name: u.name,
                  path: u.path,
                  mime_type: u.mime,
                  size_bytes: u.size,
                });
              }
            }}
          />

          <RecordList<FileRow>
            items={folderFiles}
            getKey={(f) => f.id}
            getSearchText={(f) => `${f.name} ${f.content}`}
            getGroup={(f) => KIND_LABEL[f.kind] ?? f.kind}
            search={search}
            onSearchChange={setSearch}
            searchLabel="Buscar por nome ou conteúdo"
            searchPlaceholder="Buscar…"
            searchId="arquivos-busca"
            group={group}
            onGroupChange={setGroup}
            groupAllLabel="Todos os tipos"
            colorOptions={[]}
            color={color}
            onColorChange={setColor}
            loading={loading}
            error={files.error}
            onRetry={() => files.refetch()}
            empty={{
              title: "Nada nesta pasta",
              message: "Envie um arquivo ou crie um link, uma nota ou uma imagem.",
              icon: <FolderClosed className="size-5" aria-hidden />,
            }}
            renderItem={(row) => {
              const Icon = KIND_ICON[row.kind] ?? FileText;
              return (
                <>
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  <button
                    type="button"
                    className="text-body min-w-40 flex-1 text-left font-medium hover:underline"
                    onClick={() => void openPreview(row)}
                  >
                    {row.name}
                  </button>
                  <span className="text-label text-muted-foreground">
                    {KIND_LABEL[row.kind] ?? row.kind}
                    {row.size_bytes ? ` · ${formatSize(Number(row.size_bytes))}` : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Pré-visualizar"
                    onClick={() => void openPreview(row)}
                  >
                    <Eye className="size-4" aria-hidden />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Ações do item">
                        <MoreVertical className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-body" onClick={() => openEditItem(row)}>
                        Renomear / editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-body"
                        onClick={() => files.duplicate.mutate({ ...row })}
                      >
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-label">Mover para…</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="text-body"
                        disabled={row.folder_id === null}
                        onClick={() =>
                          files.update.mutate({ id: row.id, values: { folder_id: null } })
                        }
                      >
                        Raiz
                      </DropdownMenuItem>
                      {folders.rows.map((f) => (
                        <DropdownMenuItem
                          key={f.id}
                          className="text-body"
                          disabled={row.folder_id === f.id}
                          onClick={() =>
                            files.update.mutate({ id: row.id, values: { folder_id: f.id } })
                          }
                        >
                          {f.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-body" onClick={() => setToDelete(row)}>
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              );
            }}
          />
        </div>
      </AppCard>

      <RecordPanel
        open={folderPanel}
        onOpenChange={setFolderPanel}
        title="Nova pasta"
        description={
          currentFolder ? `Será criada dentro de ${currentFolder.name}.` : "Será criada na raiz."
        }
        fields={FOLDER_FIELDS}
        values={folderValues}
        onChange={(name, value) => setFolderValues((p) => ({ ...p, [name]: value }))}
        onSave={saveFolder}
        saving={folders.create.isPending}
        idPrefix="pasta"
      />

      <RecordPanel
        open={itemPanel}
        onOpenChange={setItemPanel}
        title={itemId ? "Editar item" : "Novo item"}
        description="Link e texto rico são criados aqui; arquivos e imagens entram pelo envio."
        fields={ITEM_FIELDS}
        values={itemValues}
        onChange={(name, value) => setItemValues((p) => ({ ...p, [name]: value }))}
        onSave={saveItem}
        saving={files.save.isPending}
        idPrefix="item"
      />

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-highlight">{preview?.name}</DialogTitle>
            <DialogDescription className="text-label">
              Pré-visualização sem baixar o arquivo.
            </DialogDescription>
          </DialogHeader>
          {preview?.mime.startsWith("image/") ? (
            <img
              src={preview.url}
              alt={preview.name}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          ) : preview?.mime === "application/pdf" ? (
            <iframe src={preview.url} title={preview.name} className="h-[70vh] w-full rounded-md" />
          ) : preview?.mime === "text/plain" ? (
            <p className="text-body whitespace-pre-wrap">{String(itemValues['content'] ?? "")}</p>
          ) : (
            <EmptyState
              title="Sem pré-visualização"
              message="Este tipo de arquivo não pode ser mostrado aqui."
              action={
                preview?.url ? (
                  <Button variant="outline" className="text-body" asChild>
                    <a href={preview.url} target="_blank" rel="noopener noreferrer">
                      Abrir arquivo
                    </a>
                  </Button>
                ) : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir item?"
        description="Se for arquivo ou imagem, ele também sai do armazenamento."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (toDelete) void deleteItem(toDelete);
        }}
      />

      <ConfirmDialog
        open={!!folderToDelete}
        onOpenChange={(o) => !o && setFolderToDelete(null)}
        title="Excluir pasta?"
        description="Os itens dentro dela também são excluídos, inclusive do armazenamento."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (folderToDelete) void deleteFolder(folderToDelete);
        }}
      />
    </>
  );
}
