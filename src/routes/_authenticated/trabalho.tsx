import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MoreVertical,
  Plus,
  Search,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecords } from "@/hooks/use-records";
import { useContactField } from "@/hooks/use-contacts";
import { useOrgId, useOrgMembers, usePermissions, useUserId } from "@/hooks/use-org";
import { useCurrentProject } from "@/hooks/use-projects";
import { NoProjectState } from "@/components/project-select";

import {
  ITEM_COLORS,
  colorSwatch,
  formatDateBR,
  initialsOf,
  matchesDue,
  PRIORITY_OPTIONS,
  priorityBar,
  dueTone,
  todayISO,
  type DueFilter,
} from "@/lib/board";
import { cn } from "@/lib/utils";

type View = "kanban" | "lista" | "calendario";

type TrabalhoSearch = { cartao?: string };

export const Route = createFileRoute("/_authenticated/trabalho")({
  validateSearch: (search: Record<string, unknown>): TrabalhoSearch =>
    search['cartao'] ? { cartao: String(search['cartao']) } : {},
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
  created_by?: string | null;
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
  priority: string;
  position: number;
  done: boolean;
  archived: boolean;
  contact_id: string | null;
  created_by?: string | null;
};

type CardItemRow = {
  id: string;
  card_id: string;
  kind: string;
  content: string;
  done: boolean;
  path: string;
  created_by?: string | null;
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
  const { projectId } = useCurrentProject();
  const perms = usePermissions();
  const { data: userId } = useUserId();
  const { data: members = [] } = useOrgMembers();
  const [newCardColumn, setNewCardColumn] = useState<string | null>(null);



  const [boardId, setBoardId] = useState<string>("");
  const [folder, setFolder] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<"" | "meus" | "sem">("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("");
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ column: "due_date" | "priority" | "title"; dir: "asc" | "desc" }>({
    column: "due_date",
    dir: "asc",
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [boardPanel, setBoardPanel] = useState(false);
  const [boardValues, setBoardValues] = useState<Values>({ name: "", folder: "" });
  const [columnPanel, setColumnPanel] = useState(false);
  const [columnValues, setColumnValues] = useState<Values>({ name: "", position: "0" });

  const [cardPanelId, setCardPanelId] = useState<string | undefined>(undefined);
  const [cardPanelOpen, setCardPanelOpen] = useState(false);
  const [cardValues, setCardValues] = useState<Values>({});
  const { field: contactField } = useContactField();
  const [checklistText, setChecklistText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [toDelete, setToDelete] = useState<CardRow | null>(null);
  const [toArchive, setToArchive] = useState<CardRow | null>(null);

  const boards = useRecords<BoardRow>({
    table: "boards",
    columns: "id, name, folder, created_by",
    orgId: orgId ?? null,
    projectId,
    projectRequired: true,
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
      "id, board_id, column_id, title, description, assignee_id, due_date, label, color, priority, position, done, archived, contact_id, created_by",
    orgId: orgId ?? null,
    orderBy: { column: "position", ascending: true },
    trackCreatedBy: true,
    label: "cartão",
  });

  const items = useRecords<CardItemRow>({
    table: "card_items",
    columns: "id, card_id, kind, content, done, path, created_by",
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

  const memberName = useMemo(() => {
    const map = new Map(members.map((m) => [m.user_id, m.full_name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Membro") : "");
  }, [members]);

  const filteredBoardCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return boardCards;
    return boardCards.filter((c) =>
      [c.title, c.label, c.description, memberName(c.assignee_id)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [boardCards, search, memberName]);

  const sortedListCards = useMemo(() => {
    const priorityRank: Record<string, number> = { baixa: 1, normal: 2, alta: 3, urgente: 4 };
    const list = [...filteredBoardCards];
    list.sort((a, b) => {
      if (sort.column === "due_date") {
        const da = a.due_date || "9999-12-31";
        const db = b.due_date || "9999-12-31";
        return sort.dir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
      }
      if (sort.column === "priority") {
        const pa = priorityRank[a.priority ?? "normal"] ?? 0;
        const pb = priorityRank[b.priority ?? "normal"] ?? 0;
        return sort.dir === "asc" ? pa - pb : pb - pa;
      }
      return sort.dir === "asc"
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    });
    return list;
  }, [filteredBoardCards, sort]);

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
          { value: "", label: "Sem responsável" },
          ...members.map((m) => ({
            value: m.user_id,
            label: m.user_id === userId ? `${m.full_name} (eu)` : m.full_name,
          })),
        ],
      },
      { name: "due_date", label: "Prazo", type: "date" },
      { name: "label", label: "Etiqueta", type: "text" },
      {
        name: "color",
        label: "Cor da etiqueta",
        type: "choice",
        options: ITEM_COLORS.map((c) => ({ value: c.value, label: c.label })),
      },
      {
        name: "priority",
        label: "Prioridade",
        type: "choice",
        options: PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label })),
      },
      { name: "done", label: "Concluído", type: "switch" },
      contactField,
    ],
    [userId, members, contactField],
  );

  function openCardPanel(card: CardRow) {
    setCardPanelId(card.id);
    setNewCardColumn(null);
    setCardValues({
      title: card.title,
      description: card.description,
      assignee_id: card.assignee_id ?? "",
      due_date: card.due_date ?? "",
      label: card.label,
      color: card.color,
      priority: card.priority ?? "normal",
      done: card.done,
      contact_id: card.contact_id ?? "",
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
    const title = String(cardValues['title'] ?? "").trim();
    if (!title) {
      toast.error("Informe o título do cartão.");
      return;
    }
    const values = {
      title,
      description: String(cardValues['description'] ?? ""),
      assignee_id: String(cardValues['assignee_id'] ?? "") || null,
      due_date: String(cardValues['due_date'] ?? "") || null,
      label: String(cardValues['label'] ?? ""),
      color: String(cardValues['color'] ?? ""),
      priority: String(cardValues['priority'] ?? "normal"),
      done: Boolean(cardValues['done']),
      contact_id: String(cardValues['contact_id'] ?? "") || null,
    };

    if (!cardPanelId) {
      if (!currentBoard || !newCardColumn) return;
      cards.create.mutate(
        {
          ...values,
          board_id: currentBoard.id,
          column_id: newCardColumn,
          position: boardCards.length,
        },
        {
          onSuccess: () => {
            setCardPanelOpen(false);
            setNewCardColumn(null);
          },
        },
      );
      return;
    }

    cards.update.mutate(
      { id: cardPanelId, values },
      { onSuccess: () => setCardPanelOpen(false) },
    );
  }

  function newCard(columnId: string) {
    if (!currentBoard) return;
    setCardPanelId(undefined);
    setNewCardColumn(columnId);
    setCardValues({
      title: "",
      description: "",
      assignee_id: "",
      due_date: "",
      label: "",
      color: ITEM_COLORS[0]?.value ?? "",
      priority: "normal",
      done: false,
      contact_id: "",
    });
    setChecklistText("");
    setCommentText("");
    setCardPanelOpen(true);
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

  const columnMap = useMemo(() => {
    const map = new Map<string, ColumnRow>();
    for (const c of boardColumns) map.set(c.id, c);
    return map;
  }, [boardColumns]);

  const priorityLabel = (value: string) =>
    PRIORITY_OPTIONS.find((p) => p.value === value)?.label ?? value;

  function renderKanban() {
    if (boardColumns.length === 0) {
      return (
        <AppCard>
          <EmptyState
            title="Nenhuma coluna neste quadro"
            message="Crie a primeira coluna para receber os cartões."
            action={
              perms.canWrite ? (
                <Button className="text-body" onClick={() => setColumnPanel(true)}>
                  Nova coluna
                </Button>
              ) : undefined
            }
          />
        </AppCard>
      );
    }
    return (
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
                {colCards.map((card) => renderCard(card))}
              </ul>
              {perms.canWrite && (
                <Button
                  variant="ghost"
                  className="text-body mt-2 w-full justify-start"
                  onClick={() => newCard(col.id)}
                >
                  <Plus className="size-4" aria-hidden />
                  Novo cartão
                </Button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderCard(card: CardRow) {
    return (
      <li
        key={card.id}
        draggable={perms.canWrite}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
        className="relative overflow-hidden rounded-md border border-border bg-background p-3 pl-4"
      >
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-1", priorityBar(card.priority ?? "normal"))}
        />
        {card.label && (
          <span className="text-label mb-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            <span aria-hidden className={cn("size-2 rounded-full", colorSwatch(card.color))} />
            {card.label}
          </span>
        )}
        <div className="flex items-start gap-2">
          <Checkbox
            className="mt-0.5"
            checked={card.done}
            disabled={!perms.canWrite}
            aria-label="Marcar como concluído"
            onCheckedChange={(v) =>
              cards.update.mutate({ id: card.id, values: { done: Boolean(v) } })
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
              <DropdownMenuItem className="text-body" onClick={() => openCardPanel(card)}>
                Abrir detalhe
              </DropdownMenuItem>
              {perms.canWrite && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-label">Mover para…</DropdownMenuLabel>
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
                  <DropdownMenuItem className="text-body" onClick={() => setToArchive(card)}>
                    Arquivar
                  </DropdownMenuItem>
                </>
              )}
              {perms.canDelete(card.created_by) && (
                <DropdownMenuItem className="text-body" onClick={() => setToDelete(card)}>
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {(card.assignee_id || card.due_date) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {card.assignee_id && (
              <Avatar className="size-5" title={memberName(card.assignee_id)}>
                <AvatarFallback className="text-label">
                  {initialsOf(memberName(card.assignee_id))}
                </AvatarFallback>
              </Avatar>
            )}
            {card.due_date && (
              <span
                className={cn(
                  "text-label inline-flex items-center gap-1",
                  dueTone(card.due_date, card.done) === "atrasado"
                    ? "text-destructive font-medium"
                    : dueTone(card.due_date, card.done) === "hoje"
                      ? "text-warning font-medium"
                      : "text-muted-foreground",
                )}
              >
                <CalendarDays className="size-3.5" aria-hidden />
                {formatDateBR(card.due_date)}
              </span>
            )}
          </div>
        )}
      </li>
    );
  }

  function renderList() {
    if (filteredBoardCards.length === 0) {
      return (
        <EmptyState
          title="Nenhum cartão encontrado"
          message={
            search
              ? "Tente ajustar a busca ou os filtros."
              : "Este quadro ainda não tem cartões visíveis."
          }
          icon={<ListChecks className="size-5" aria-hidden />}
        />
      );
    }

    function toggleSort(column: "due_date" | "priority" | "title") {
      setSort((prev) => ({
        column,
        dir: prev.column === column && prev.dir === "asc" ? "desc" : "asc",
      }));
    }

    function SortHeader({
      column,
      children,
      align,
    }: {
      column: "due_date" | "priority" | "title";
      children: React.ReactNode;
      align?: "left" | "right";
    }) {
      return (
        <TableHead
          className={cn(
            "cursor-pointer select-none",
            align === "right" ? "text-right" : "text-left",
          )}
          onClick={() => toggleSort(column)}
        >
          <span className="inline-flex items-center gap-1">
            {children}
            {sort.column === column && (sort.dir === "asc" ? " ↑" : " ↓")}
          </span>
        </TableHead>
      );
    }

    const grouped = sortedListCards.reduce<Record<string, CardRow[]>>((acc, card) => {
      const col = columnMap.get(card.column_id ?? "")?.name ?? "Sem coluna";
      acc[col] = acc[col] ?? [];
      acc[col].push(card);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([colName, groupCards]) => (
          <div key={colName}>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-highlight font-semibold">{colName}</p>
              <span className="text-label rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {groupCards.length}
              </span>
            </div>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <SortHeader column="title">Título</SortHeader>
                    <TableHead>Responsável</TableHead>
                    <SortHeader column="due_date">Prazo</SortHeader>
                    <SortHeader column="priority" align="right">Prioridade</SortHeader>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupCards.map((card) => (
                    <TableRow
                      key={card.id}
                      className="cursor-pointer"
                      onClick={() => openCardPanel(card)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={card.done}
                          disabled={!perms.canWrite}
                          aria-label="Marcar como concluído"
                          onCheckedChange={(v) =>
                            cards.update.mutate({ id: card.id, values: { done: Boolean(v) } })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-body font-medium",
                            card.done && "text-muted-foreground line-through",
                          )}
                        >
                          {card.title}
                        </span>
                      </TableCell>
                      <TableCell>
                        {card.assignee_id ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6" title={memberName(card.assignee_id)}>
                              <AvatarFallback className="text-label">
                                {initialsOf(memberName(card.assignee_id))}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-body">{memberName(card.assignee_id)}</span>
                          </div>
                        ) : (
                          <span className="text-body text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {card.due_date ? (
                          <span
                            className={cn(
                              "text-body inline-flex items-center gap-1",
                              dueTone(card.due_date, card.done) === "atrasado"
                                ? "text-destructive font-medium"
                                : dueTone(card.due_date, card.done) === "hoje"
                                  ? "text-warning font-medium"
                                  : "text-muted-foreground",
                            )}
                          >
                            <CalendarDays className="size-3.5" aria-hidden />
                            {formatDateBR(card.due_date)}
                          </span>
                        ) : (
                          <span className="text-body text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-body">{priorityLabel(card.priority ?? "normal")}</span>
                      </TableCell>
                      <TableCell>
                        {card.label ? (
                          <span className="text-label inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                            <span
                              aria-hidden
                              className={cn("size-2 rounded-full", colorSwatch(card.color))}
                            />
                            {card.label}
                          </span>
                        ) : (
                          <span className="text-body text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                            {perms.canWrite && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-label">Mover para…</DropdownMenuLabel>
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
                              </>
                            )}
                            {perms.canDelete(card.created_by) && (
                              <DropdownMenuItem
                                className="text-body"
                                onClick={() => setToDelete(card)}
                              >
                                Excluir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderCalendar() {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // segunda = 0
    const daysInMonth = lastDay.getDate();
    const weeks: number[][] = [];
    let currentWeek: number[] = Array(startOffset).fill(0);
    for (let d = 1; d <= daysInMonth; d++) {
      currentWeek.push(d);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(0);
      weeks.push(currentWeek);
    }

    const cardsByDay = useMemo(() => {
      const map = new Map<string, CardRow[]>();
      for (const card of filteredBoardCards) {
        if (!card.due_date) continue;
        const key = card.due_date;
        const list = map.get(key) ?? [];
        list.push(card);
        map.set(key, list);
      }
      return map;
    }, [filteredBoardCards]);

    const undated = filteredBoardCards.filter((c) => !c.due_date);
    const monthLabel = firstDay.toLocaleString("pt-BR", { month: "long", year: "numeric" });
    const today = todayISO();

    function dropOnDay(day: number) {
      return (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const card = boardCards.find((c) => c.id === id);
        if (!card || !perms.canWrite) return;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        cards.update.mutate({ id: card.id, values: { due_date: iso } });
      };
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="text-body"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden /> Mês anterior
          </Button>
          <p className="text-highlight font-semibold capitalize">{monthLabel}</p>
          <Button
            variant="outline"
            size="sm"
            className="text-body"
            onClick={() => changeMonth(1)}
          >
            Próximo mês <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="rounded-md border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div key={d} className="p-2 text-center text-label font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                if (day === 0) {
                  return <div key={`${wi}-${di}`} className="min-h-28 border-b border-r border-border bg-muted/20" />;
                }
                const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayCards = cardsByDay.get(iso) ?? [];
                const isToday = iso === today;
                return (
                  <div
                    key={day}
                    className={cn(
                      "min-h-28 border-b border-r border-border p-2 transition-colors",
                      isToday && "bg-primary/5",
                    )}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={dropOnDay(day)}
                  >
                    <p
                      className={cn(
                        "text-label mb-1 font-medium",
                        isToday ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {day}
                    </p>
                    <ul className="space-y-1">
                      {dayCards.map((card) => (
                        <li
                          key={card.id}
                          draggable={perms.canWrite}
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                        >
                          <button
                            type="button"
                            onClick={() => openCardPanel(card)}
                            className={cn(
                              "text-label w-full rounded-md border border-border px-1.5 py-1 text-left transition-colors hover:bg-accent",
                              card.done && "text-muted-foreground line-through opacity-70",
                            )}
                            title={card.title}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "mr-1 inline-block size-2 shrink-0 rounded-full",
                                colorSwatch(card.color),
                              )}
                            />
                            <span className="truncate">{card.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {undated.length > 0 && (
          <div className="rounded-md border border-border p-3">
            <p className="text-highlight font-semibold mb-2">Sem data definida · {undated.length}</p>
            <div className="flex flex-wrap gap-2">
              {undated.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => openCardPanel(card)}
                  className={cn(
                    "text-label inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 transition-colors hover:bg-accent",
                    card.done && "text-muted-foreground line-through opacity-70",
                  )}
                >
                  <span aria-hidden className={cn("size-2 rounded-full", colorSwatch(card.color))} />
                  {card.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function changeMonth(delta: number) {
    setCalendarMonth((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  if (!projectId) {
    return (
      <>
        <PageHeader title="Trabalho" subtitle="Quadros, colunas e cartões do projeto." />
        <AppCard>
          <NoProjectState />
        </AppCard>
      </>
    );
  }

  return (
    <>

      <PageHeader
        title="Trabalho"
        subtitle="Quadros, colunas e cartões da sua equipe."
        actions={
          perms.canWrite ? (
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
          ) : undefined
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
              perms.canWrite ? (
                <Button className="text-body" onClick={() => setBoardPanel(true)}>
                  Novo quadro
                </Button>
              ) : undefined
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SelectPillGroup>
                  <SelectPill active={view === "kanban"} onClick={() => setView("kanban")}>
                    Kanban
                  </SelectPill>
                  <SelectPill active={view === "lista"} onClick={() => setView("lista")}>
                    Lista
                  </SelectPill>
                  <SelectPill active={view === "calendario"} onClick={() => setView("calendario")}>
                    Calendário
                  </SelectPill>
                </SelectPillGroup>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    placeholder="Buscar cartões…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-body"
                  />
                </div>
              </div>
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

          {view === "kanban" ? (
            renderKanban()
          ) : view === "lista" ? (
            <AppCard title="Lista de cartões" subtitle="Clique no cabeçalho para ordenar.">
              {renderList()}
            </AppCard>
          ) : (
            <AppCard title="Calendário" subtitle="Cards com prazo aparecem no dia correspondente.">
              {renderCalendar()}
            </AppCard>
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
          if (!o) {
            setCardPanelId(undefined);
            setNewCardColumn(null);
          }
        }}
        title={cardPanelId ? (openCard?.title ?? "Cartão") : "Novo cartão"}
        description={
          cardPanelId
            ? "Detalhe, checklist, comentários e anexos."
            : "Preencha o título; o resto é opcional."
        }
        fields={cardFields}
        values={cardValues}
        onChange={(name, value) => setCardValues((p) => ({ ...p, [name]: value }))}
        onSave={saveCard}
        saving={cards.update.isPending || cards.create.isPending}
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
                    {perms.canDelete(i.created_by) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-label"
                        onClick={() => items.remove.mutate(i.id)}
                      >
                        Remover
                      </Button>
                    )}
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
                    {perms.canDelete(i.created_by) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-label"
                        onClick={() => items.remove.mutate(i.id)}
                      >
                        Remover
                      </Button>
                    )}
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
