export type EntryKind = "entrada" | "saida";

export type FinanceEntryRow = {
  id: string;
  entry_date: string;
  description: string;
  category: string;
  account: string;
  kind: string;
  amount: number;
  received: boolean;
  origin: string;
  contact_id: string | null;
  created_by: string | null;
  project_id?: string | null;
};

export type FixedCostRow = {
  id: string;
  label: string;
  category: string;
  amount: number;
  day_of_month: number;
  start_month: string;
  end_month: string | null;
  active: boolean;
  created_by: string | null;
  project_id?: string | null;
};

/** Lançamento exibido na lista: real (do banco) ou projetado de uma despesa fixa. */
export type DisplayEntry = {
  id: string;
  entry_date: string;
  description: string;
  category: string;
  account: string;
  kind: EntryKind;
  amount: number;
  received: boolean;
  origin: string;
  virtual: boolean;
  sourceId: string;
  contact_id: string | null;
  created_by: string | null;
  project_id: string | null;
};

export function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }).format(value);
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Projeta as despesas fixas ativas como lançamentos de cada mês do período (cálculo na leitura). */
export function expandFixedCosts(
  costs: FixedCostRow[],
  from: string,
  to: string,
): DisplayEntry[] {
  if (!from || !to || from > to) return [];
  const out: DisplayEntry[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  for (const c of costs) {
    if (!c.active) continue;
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const startMonth = c.start_month.slice(0, 7);
      const endMonth = c.end_month ? c.end_month.slice(0, 7) : null;
      const thisMonth = monthStart.slice(0, 7);
      if (thisMonth >= startMonth && (!endMonth || thisMonth <= endMonth)) {
        const day = Math.min(c.day_of_month, daysInMonth(y, m));
        const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (iso >= from && iso <= to) {
          out.push({
            id: `fixo:${c.id}:${iso}`,
            entry_date: iso,
            description: c.label,
            category: c.category,
            account: "—",
            kind: "saida",
            amount: Number(c.amount),
            received: true,
            origin: "fixo",
            virtual: true,
            sourceId: c.id,
            contact_id: null,
            created_by: c.created_by ?? null,
            project_id: c.project_id ?? null,
          });
        }
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return out;
}

export function toDisplay(rows: FinanceEntryRow[]): DisplayEntry[] {
  return rows.map((r) => ({
    id: r.id,
    entry_date: r.entry_date,
    description: r.description,
    category: r.category,
    account: r.account,
    kind: (r.kind === "entrada" ? "entrada" : "saida") as EntryKind,
    amount: Number(r.amount),
    received: r.received,
    origin: r.origin,
    virtual: false,
    sourceId: r.id,
    contact_id: r.contact_id ?? null,
    created_by: r.created_by ?? null,
    project_id: r.project_id ?? null,
  }));
}

export function totals(entries: DisplayEntry[]) {
  const entrou = entries
    .filter((e) => e.kind === "entrada")
    .reduce((s, e) => s + e.amount, 0);
  const saiu = entries.filter((e) => e.kind === "saida").reduce((s, e) => s + e.amount, 0);
  const sobrou = entrou - saiu;
  const margem = entrou > 0 ? (sobrou / entrou) * 100 : 0;
  return { entrou, saiu, sobrou, margem };
}

/** Últimos `count` meses (inclusive o atual) no formato "YYYY-MM". */
export function lastMonths(count = 12): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-09" -> "set/26" */
export function monthLabel(ym: string) {
  const [y = "", m = "1"] = ym.split("-");
  return `${MONTH_NAMES[Number(m) - 1]}/${y.slice(2)}`;
}

/** Primeiro e último dia do mês "YYYY-MM". */
export function monthBounds(ym: string) {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  const end = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(end).padStart(2, "0")}` };
}

/** Série mensal (entradas, saídas, líquido) — usada pelo gráfico de 12 meses. */
export function monthlySeries(entries: DisplayEntry[], months: string[]) {
  const base = new Map(months.map((m) => [m, { entradas: 0, saidas: 0 }]));
  for (const e of entries) {
    const bucket = base.get(e.entry_date.slice(0, 7));
    if (!bucket) continue;
    if (e.kind === "entrada") bucket.entradas += e.amount;
    else bucket.saidas += e.amount;
  }
  return months.map((m) => {
    const b = base.get(m)!;
    return { month: m, label: monthLabel(m), ...b, liquido: b.entradas - b.saidas };
  });
}
