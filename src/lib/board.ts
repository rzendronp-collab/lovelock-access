import type { ColorOption } from "@/components/record-list";

/** Cores do sistema — sempre vindas das variáveis de tema, nunca cor solta. */
export const ITEM_COLORS: ColorOption[] = [
  { value: "principal", label: "Principal", swatchClassName: "bg-primary" },
  { value: "secundaria", label: "Secundária", swatchClassName: "bg-secondary" },
  { value: "alerta", label: "Alerta", swatchClassName: "bg-destructive" },
  { value: "neutra", label: "Neutra", swatchClassName: "bg-muted" },
];

export function colorSwatch(value: string) {
  return ITEM_COLORS.find((c) => c.value === value)?.swatchClassName ?? "bg-muted";
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type DueFilter = "" | "atrasado" | "hoje" | "semana";

export function matchesDue(dueDate: string | null, done: boolean, filter: DueFilter) {
  if (!filter) return true;
  if (!dueDate) return false;
  const today = todayISO();
  if (filter === "atrasado") return dueDate < today && !done;
  if (filter === "hoje") return dueDate === today;
  return dueDate >= today && dueDate <= inDays(6);
}

export function initialsOf(name: string) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDateBR(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export type Priority = "baixa" | "normal" | "alta" | "urgente";

/** Prioridades do cartão — cor sempre por variável de tema. */
export const PRIORITY_OPTIONS: { value: Priority; label: string; barClassName: string }[] = [
  { value: "baixa", label: "Baixa", barClassName: "bg-muted-foreground/40" },
  { value: "normal", label: "Normal", barClassName: "bg-primary" },
  { value: "alta", label: "Alta", barClassName: "bg-secondary" },
  { value: "urgente", label: "Urgente", barClassName: "bg-destructive" },
];

export function priorityBar(value: string) {
  return PRIORITY_OPTIONS.find((p) => p.value === value)?.barClassName ?? "bg-primary";
}

/** Situação do prazo para colorir a data no cartão. */
export function dueTone(dueDate: string | null, done: boolean): "atrasado" | "hoje" | "normal" {
  if (!dueDate || done) return "normal";
  const today = todayISO();
  if (dueDate < today) return "atrasado";
  if (dueDate === today) return "hoje";
  return "normal";
}
