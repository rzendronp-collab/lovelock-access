import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  ConfirmDialog,
  Field,
  RecordPanel,
  type FieldDef,
  type FieldValue,
} from "@/components/detail-panel";
import { Attachments, removeStorageFolder } from "@/components/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecords } from "@/hooks/use-records";
import { useOrgId, useUserId } from "@/hooks/use-org";
import {
  ITEM_COLORS,
  colorSwatch,
  formatDateBR,
  initialsOf,
  matchesDue,
  type DueFilter,
} from "@/lib/board";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trabalho")({
  validateSearch: (search: Record<string, unknown>) => ({
    cartao: search['cartao'] ? String(search['cartao']) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Trabalho | EuroHub" },
      {
        name: "description",
        content: "Quadros, colunas e cartões do EuroHub: organize as tarefas da sua equipe.",
      },
      { property: "og:title", content: "Trabalho | EuroHub" },
      {
        property: "og:description",
        content: "Quadros, colunas e cartões do EuroHub: organize as tarefas da sua equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Trabalho,
});

type BoardRow = {
  id: string;
  name: string;
  folder: string;
};

type ColumnRow = {
  id: string;
  board_id: string;
  name: string;
  position: number;
};

type CardRow = {
  id: string;
  board_id: string;
  column_id: string | null;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
  label: string;
  color: string;
  position: number;
  done: boolean;
  archived: boolean;
};

type CardItemRow = {
  id: string;
  card_id: string;
  kind: string;
  content: string;
  done: boolean;
  path: string;
};

type Values = Record<string, FieldValue>;

const BOARD_FIELDS: FieldDef[] = [
  { name: "name", label: "Nome do quadro", type: "text" },
  { name: "folder", label: "Pasta / projeto", type: "text", placeholder: "Ex.: Clientes" },
];

const COLUMN_FIELDS: FieldDef[] = [
  { name: "name", label: "Nome da coluna", type: "text" },
  { name: "position", label: "Ordem", type: "number", min: 0 },
];

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "", label: "Todos os prazos" },
  { value: "atrasado", label: "Atrasado" },
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
];

function cardStoragePrefix(cardId: string) {
  return `cartoes/${cardId}`;
}

function Trabalho() {
  const urlSearch = Route.useSearch();
  const navigate = useNavigate();
  const handledCardRef = useRef<string | null>(null);
  const { data: orgId, isLoading: loadingOrg } = useOrgId();
  const { data: userId } = useUserId();


  const [boardId, setBoardId] = useState<string>("");
  const [folder, setFolder] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<"" | "meus" | "sem">("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("");

  const [boardPanel, setBoardPanel] = useState(false);
  const [boardValues, setBoardValues] = useState<Values>({ name: "", folder: "" });
  const [columnPanel, setColumnPanel] = useState(false);
  const [columnValues, setColumnValues] = useState<Values>({ name: "", position: "0" });

  const [cardPanelId, setCardPanelId] = useState<string | undefined>(undefined);
  const [cardPanelOpen, setCardPanelOpen] = useState(false);
  const [cardValues, setCardValues] = useState<Values>({});
  const [checklistText, setChecklistText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [toDelete, setToDelete] = useState<CardRow | null>(null);
  const [toArchive, setToArchive] = useState<CardRow | null>(null);

  const boards = useRecords<BoardRow>({
    table: "boards",
    columns: "id, name, folder",
    orgId: orgId ?? null,
    orderBy: { column: "name", ascending: true },
    trackCreatedBy: true,
    label: "quadro",
  });

  const columns = useRecords<ColumnRow>({
    table: "board_columns",
    columns: "id, board_id, name, position",
    orgId: orgId ?? null,
    orderBy: { column: "position", ascending: true },
    label: "coluna",
  });

  const cards = useRecords<CardRow>({
    table: "cards",
    columns:
      "id, board_id, column_id, title, description, assignee_id, due_date, label, color, position, done, archived",
    orgId: orgId ?? null,
    orderBy: { column: "position", ascending: true },
    trackCreatedBy: true,
    label: "cartão",
  });

  const items = useRecords<CardItemRow>({
    table: "card_items",
    columns: "id, card_id, kind, content, done, path",
    orgId: orgId ?? null,
    orderBy: { column: "created_at", ascending: true },
    trackCreatedBy: true,
    label: "item",
  });

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const b of boards.rows) if (b.folder) set.add(b.folder);
    return [...set].sort();
  }, [boards.rows]);

  const visibleBoards = useMemo(
    () => boards.rows.filter((b) => !folder || b.folder === folder),
    [boards.rows, folder],
  );

  const currentBoard = useMemo(
    () => visibleBoards.find((b) => b.id === boardId) ?? visibleBoards[0] ?? null,
    [visibleBoards, boardId],
  );

  const boardColumns = useMemo(
    () => columns.rows.filter((c) => c.board_id === currentBoard?.id),
    [columns.rows, currentBoard],
  );

  const boardCards = useMemo(() => {
    return cards.rows.filter((c) => {
      if (c.board_id !== currentBoard?.id) return false;
      if (c.archived) return false;
      if (assigneeFilter === "meus" && c.assignee_id !== userId) return false;
      if (assigneeFilter === "sem" && c.assignee_id) return false;
      if (!matchesDue(c.due_date, c.done, dueFilter)) return false;
      return true;
    });
  }, [cards.rows, currentBoard, assigneeFilter, userId, dueFilter]);

  const openCard = useMemo(
    () => cards.rows.find((c) => c.id === cardPanelId) ?? null,
    [cards.rows, cardPanelId],
  );

  const cardFields: FieldDef[] = useMemo(
    () => [
      { name: "title", label: "Título", type: "text" },
      { name: "description", label: "Descrição", type: "textarea" },
      {
        name: "assignee_id",
        label: "Responsável",
        type: "choice",
        options: [
          { value: "", label: "Ninguém" },
          ...(userId ? [{ value: userId, label: "Eu" }] : []),
        ],
      },
      { name: "due_date", label: "Prazo", type: "date" },
      { name: "label", label: "Etiqueta", type: "text" },
      {
        name: "color",
        label: "Cor",
        type: "choice",
        options: ITEM_COLORS.map((c) => ({ value: c.value, label: c.label })),
      },
      { name: "done", label: "Concluído", type: "switch" },
    ],
    [userId],
  );

  function openCardPanel(card: CardRow) {
    setCardPanelId(card.id);
    setCardValues({
      title: card.title,
      description: card.description,
      assignee_id: card.assignee_id ?? "",
      due_date: card.due_date ?? "",
      label: card.label,
      color: card.color,
      done: card.done,
    });
    setChecklistText("");
    setCommentText("");
    setCardPanelOpen(true);
  }

  // Abre direto o cartão indicado no link (ex.: vindo do Painel de hoje).
  const requestedCard = urlSearch.cartao;
  useEffect(() => {
    if (!requestedCard || handledCardRef.current === requestedCard) return;
    const card = cards.rows.find((c) => c.id === requestedCard);
    if (!card) return;
    handledCardRef.current = requestedCard;
    setBoardId(card.board_id);
    setFolder("");
    openCardPanel(card);
    void navigate({ to: "/trabalho", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedCard, cards.rows]);



  function saveCard() {
    if (!cardPanelId) return;
    const title = String(cardValues['title'] ?? "").trim();
    if (!title) {
      toast.error("Informe o título do cartão.");
      return;
    }
    cards.update.mutate(
      {
        id: cardPanelId,
        values: {
          title,
          description: String(cardValues['description'] ?? ""),
          assignee_id: String(cardValues['assignee_id'] ?? "") || null,
          due_date: String(cardValues['due_date'] ?? "") || null,
          label: String(cardValues['label'] ?? ""),
          color: String(cardValues['color'] ?? ""),
          done: Boolean(cardValues['done']),
        },
      },
      { onSuccess: () => setCardPanelOpen(false) },
    );
  }

  function newCard(columnId: string) {
    if (!currentBoard) return;
    cards.create.mutate({
      board_id: currentBoard.id,
      column_id: columnId,
      title: "Novo cartão",
      position: boardCards.length,
    });
  }

  function saveBoard() {
    const name = String(boardValues['name'] ?? "").trim();
    if (!name) {
      toast.error("Informe o nome do quadro.");
      return;
    }
    boards.create.mutate(
      { name, folder: String(boardValues['folder'] ?? "") },
      {
        onSuccess: () => {
          setBoardPanel(false);
          setBoardValues({ name: "", folder: "" });
        },
      },
    );
  }

  function saveColumn() {
    if (!currentBoard) return;
    const name = String(columnValues['name'] ?? "").trim();
    if (!name) {
      toast.error("Informe o nome da coluna.");
      return;
    }
    columns.create.mutate(
      {
        board_id: currentBoard.id,
        name,
        position: Number(columnValues['position'] ?? 0) || boardColumns.length,
      },
      {
        onSuccess: () => {
          setColumnPanel(false);
          setColumnValues({ name: "", position: "0" });
        },
      },
    );
  }

  function moveCard(card: CardRow, columnId: string) {
    if (card.column_id === columnId) return;
    cards.update.mutate({ id: card.id, values: { column_id: columnId } });
  }

  async function deleteCard(card: CardRow) {
    try {
      if (orgId) await removeStorageFolder(`${orgId}/${cardStoragePrefix(card.id)}`);
    } catch {
      toast.error("Não foi possível excluir os anexos do cartão.");
      return;
    }
    cards.remove.mutate(card.id, {
      onSuccess: () => {
        items.invalidate();
        setToDelete(null);
        if (cardPanelId === card.id) setCardPanelOpen(false);
      },
    });
  }

  const cardItems = useMemo(
    () => items.rows.filter((i) => i.card_id === cardPanelId),
    [items.rows, cardPanelId],
  );
  const checklist = cardItems.filter((i) => i.kind === "checklist");
  const comments = cardItems.filter((i) => i.kind === "comentario");

  const loading = loadingOrg || boards.isLoading || columns.isLoading || cards.isLoading;
  const error = boards.error ?? columns.error ?? cards.error;

  return (
    <>
      <PageHeader
        title="Trabalho"
        subtitle="Quadros, colunas e cartões da sua equipe."
        actions={
          <>
            <Button variant="outline" className="text-body" onClick={() => setBoardPanel(true)}>
              <Plus className="size-4" aria-hidden />
              Novo quadro
            </Button>
            {currentBoard && (
              <Button className="text-body" onClick={() => setColumnPanel(true)}>
                <Plus className="size-4" aria-hidden />
                Nova coluna
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <AppCard>
          <LoadingState />
        </AppCard>
      ) : error ? (
        <AppCard>
          <ErrorState onRetry={() => boards.refetch()} />
        </AppCard>
      ) : boards.rows.length === 0 ? (
        <AppCard>
          <EmptyState
            title="Nenhum quadro ainda"
            message="Crie o primeiro quadro para começar a organizar o trabalho."
            icon={<ListChecks className="size-5" aria-hidden />}
            action={
              <Button className="text-body" onClick={() => setBoardPanel(true)}>
                Novo quadro
              </Button>
            }
          />
        </AppCard>
      ) : (
        <>
          <AppCard title="Quadros" subtitle="Agrupados por pasta ou projeto.">
            <div className="space-y-3">
              {folders.length > 0 && (
                <SelectPillGroup>
                  <SelectPill active={!folder} onClick={() => setFolder("")}>
                    Todas as pastas
                  </SelectPill>
                  {folders.map((f) => (
                    <SelectPill key={f} active={folder === f} onClick={() => setFolder(f)}>
                      {f}
                    </SelectPill>
                  ))}
                </SelectPillGroup>
              )}
              <SelectPillGroup>
                {visibleBoards.map((b) => (
                  <SelectPill
                    key={b.id}
                    active={currentBoard?.id === b.id}
                    onClick={() => setBoardId(b.id)}
                  >
                    {b.name}
                  </SelectPill>
                ))}
              </SelectPillGroup>
            </div>
          </AppCard>

          <AppCard title="Filtros">
            <div className="space-y-3">
              <SelectPillGroup>
                <SelectPill active={!assigneeFilter} onClick={() => setAssigneeFilter("")}>
                  Todos
                </SelectPill>
                <SelectPill
                  active={assigneeFilter === "meus"}
                  onClick={() => setAssigneeFilter("meus")}
                >
                  Meus cartões
                </SelectPill>
                <SelectPill
                  active={assigneeFilter === "sem"}
                  onClick={() => setAssigneeFilter("sem")}
                >
                  Sem responsável
                </SelectPill>
              </SelectPillGroup>
              <SelectPillGroup>
                {DUE_OPTIONS.map((o) => (
                  <SelectPill
                    key={o.value || "todos"}
                    active={dueFilter === o.value}
                    onClick={() => setDueFilter(o.value)}
                  >
                    {o.label}
                  </SelectPill>
                ))}
              </SelectPillGroup>
            </div>
          </AppCard>

          {boardColumns.length === 0 ? (
            <AppCard>
              <EmptyState
                title="Nenhuma coluna neste quadro"
                message="Crie a primeira coluna para receber os cartões."
                action={
                  <Button className="text-body" onClick={() => setColumnPanel(true)}>
                    Nova coluna
                  </Button>
                }
              />
            </AppCard>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {boardColumns.map((col) => {
                const colCards = boardCards.filter((c) => c.column_id === col.id);
                return (
                  <div
                    key={col.id}
                    className="w-72 shrink-0 rounded-lg border border-border bg-card p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      const card = boardCards.find((c) => c.id === id);
                      if (card) moveCard(card, col.id);
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-highlight font-semibold">{col.name}</p>
                      <span className="text-label text-muted-foreground">{colCards.length}</span>
                    </div>
                    <ul className="space-y-2">
                      {colCards.map((card) => (
                        <li
                          key={card.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                          className="rounded-md border border-border bg-background p-3"
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox
                              className="mt-0.5"
                              checked={card.done}
                              aria-label="Marcar como concluído"
                              onCheckedChange={(v) =>
                                cards.update.mutate({
                                  id: card.id,
                                  values: { done: Boolean(v) },
                                })
                              }
                            />
                            <button
                              type="button"
                              className={cn(
                                "text-body min-w-0 flex-1 text-left font-medium",
                                card.done && "line-through text-muted-foreground",
                              )}
                              onClick={() => openCardPanel(card)}
                            >
                              {card.title}
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Ações do cartão">
                                  <MoreVertical className="size-4" aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-body"
                                  onClick={() => openCardPanel(card)}
                                >
                                  Abrir detalhe
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-label">
                                  Mover para…
                                </DropdownMenuLabel>
                                {boardColumns.map((target) => (
                                  <DropdownMenuItem
                                    key={target.id}
                                    className="text-body"
                                    disabled={target.id === card.column_id}
                                    onClick={() => moveCard(card, target.id)}
                                  >
                                    {target.name}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-body"
                                  onClick={() => cards.duplicate.mutate({ ...card })}
                                >
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-body"
                                  onClick={() => setToArchive(card)}
                                >
                                  Arquivar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-body"
                                  onClick={() => setToDelete(card)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {card.assignee_id && (
                              <Avatar className="size-5">
                                <AvatarFallback className="text-label">
                                  {initialsOf(card.assignee_id === userId ? "Eu" : "Membro")}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            {card.due_date && (
                              <span className="text-label text-muted-foreground">
                                {formatDateBR(card.due_date)}
                              </span>
                            )}
                            {card.label && (
                              <span className="text-label inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                                <span
                                  aria-hidden
                                  className={cn("size-2 rounded-full", colorSwatch(card.color))}
                                />
                                {card.label}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="ghost"
                      className="text-body mt-2 w-full justify-start"
                      onClick={() => newCard(col.id)}
                    >
                      <Plus className="size-4" aria-hidden />
                      Novo cartão
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <RecordPanel
        open={boardPanel}
        onOpenChange={setBoardPanel}
        title="Novo quadro"
        description="Dê um nome e escolha a pasta ou projeto."
        fields={BOARD_FIELDS}
        values={boardValues}
        onChange={(name, value) => setBoardValues((p) => ({ ...p, [name]: value }))}
        onSave={saveBoard}
        saving={boards.create.isPending}
        idPrefix="quadro"
      />

      <RecordPanel
        open={columnPanel}
        onOpenChange={setColumnPanel}
        title="Nova coluna"
        fields={COLUMN_FIELDS}
        values={columnValues}
        onChange={(name, value) => setColumnValues((p) => ({ ...p, [name]: value }))}
        onSave={saveColumn}
        saving={columns.create.isPending}
        idPrefix="coluna"
      />

      <RecordPanel
        open={cardPanelOpen}
        onOpenChange={(o) => {
          setCardPanelOpen(o);
          if (!o) setCardPanelId(undefined);
        }}
        title={openCard?.title ?? "Cartão"}
        description="Detalhe, checklist, comentários e anexos."
        fields={cardFields}
        values={cardValues}
        onChange={(name, value) => setCardValues((p) => ({ ...p, [name]: value }))}
        onSave={saveCard}
        saving={cards.update.isPending}
        idPrefix="cartao"
      >
        {cardPanelId && (
          <div className="space-y-6 border-t border-border pt-4">
            <div className="space-y-2">
              <p className="text-highlight font-semibold">Checklist</p>
              <ul className="space-y-2">
                {checklist.map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={i.done}
                      aria-label="Marcar item"
                      onCheckedChange={(v) =>
                        items.update.mutate({ id: i.id, values: { done: Boolean(v) } })
                      }
                    />
                    <span
                      className={cn(
                        "text-body flex-1",
                        i.done && "line-through text-muted-foreground",
                      )}
                    >
                      {i.content}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-label"
                      onClick={() => items.remove.mutate(i.id)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
              <Field label="Novo item" id="cartao-checklist">
                <div className="flex gap-2">
                  <Input
                    id="cartao-checklist"
                    className="text-body"
                    value={checklistText}
                    onChange={(e) => setChecklistText(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="text-body"
                    onClick={() => {
                      const content = checklistText.trim();
                      if (!content) return;
                      items.create.mutate(
                        { card_id: cardPanelId, kind: "checklist", content },
                        { onSuccess: () => setChecklistText("") },
                      );
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              </Field>
            </div>

            <div className="space-y-2">
              <p className="text-highlight font-semibold">Comentários</p>
              <ul className="space-y-2">
                {comments.map((i) => (
                  <li key={i.id} className="rounded-md border border-border p-2">
                    <p className="text-body">{i.content}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-label"
                      onClick={() => items.remove.mutate(i.id)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
              <Field label="Novo comentário" id="cartao-comentario">
                <Textarea
                  id="cartao-comentario"
                  className="text-body"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
              </Field>
              <Button
                variant="outline"
                className="text-body"
                onClick={() => {
                  const content = commentText.trim();
                  if (!content) return;
                  items.create.mutate(
                    { card_id: cardPanelId, kind: "comentario", content },
                    { onSuccess: () => setCommentText("") },
                  );
                }}
              >
                Comentar
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-highlight font-semibold">Anexos</p>
              <Attachments
                orgId={orgId ?? null}
                folder={cardStoragePrefix(cardPanelId)}
                onUploaded={(files) => {
                  for (const f of files) {
                    items.create.mutate({
                      card_id: cardPanelId,
                      kind: "anexo",
                      content: f.name,
                      path: f.path,
                    });
                  }
                }}
                onRemoved={(path) => {
                  const row = cardItems.find((i) => i.path === path);
                  if (row) items.remove.mutate(row.id);
                }}
              />
            </div>
          </div>
        )}
      </RecordPanel>

      <ConfirmDialog
        open={!!toArchive}
        onOpenChange={(o) => !o && setToArchive(null)}
        title="Arquivar cartão?"
        description="Ele sai do quadro, mas o histórico continua guardado."
        confirmLabel="Arquivar"
        onConfirm={() => {
          if (!toArchive) return;
          cards.update.mutate({ id: toArchive.id, values: { archived: true } });
          setToArchive(null);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir cartão?"
        description="O cartão e os anexos dele saem do sistema."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (toDelete) void deleteCard(toDelete);
        }}
      />
    </>
  );
}
