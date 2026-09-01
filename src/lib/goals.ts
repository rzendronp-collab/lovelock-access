import { formatMoney } from "@/lib/finance";

/** Marca usada dentro de `note` para guardar o progresso manual da meta. */
export const MANUAL_TAG = "progresso:";

export function readManual(note: string) {
  const line = note.split("\n").find((l) => l.startsWith(MANUAL_TAG));
  return line ? Number(line.slice(MANUAL_TAG.length)) || 0 : 0;
}

export function writeManual(note: string, current: number) {
  const rest = note
    .split("\n")
    .filter((l) => !l.startsWith(MANUAL_TAG))
    .join("\n");
  return `${MANUAL_TAG}${current}${rest ? `\n${rest}` : ""}`;
}

export function readNote(note: string) {
  return note
    .split("\n")
    .filter((l) => !l.startsWith(MANUAL_TAG))
    .join("\n");
}

export function formatValue(value: number, unit: string) {
  if (unit === "R$") return formatMoney(value);
  if (unit === "%") return `${value.toFixed(1)}%`;
  return String(value);
}

export type GoalLike = {
  current_source: string;
  note: string;
  period_start: string;
  due_date: string | null;
  target: number;
};

export type GoalEntryLike = {
  entry_date: string;
  kind: string;
  amount: number;
  received: boolean;
};

/** Progresso atual da meta — fonte ÚNICA (Metas e Relatórios usam esta função). */
export function goalCurrent(goal: GoalLike, entries: GoalEntryLike[]) {
  if (goal.current_source !== "finance_entries") return readManual(goal.note);
  return entries
    .filter((e) => e.kind === "entrada" && e.received)
    .filter((e) => e.entry_date >= goal.period_start)
    .filter((e) => !goal.due_date || e.entry_date <= goal.due_date)
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

/** Percentual concluído (0–100). */
export function goalPercent(goal: GoalLike, entries: GoalEntryLike[]) {
  const target = Number(goal.target) || 0;
  if (target <= 0) return 0;
  return Math.min(100, (goalCurrent(goal, entries) / target) * 100);
}
