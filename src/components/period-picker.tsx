import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PeriodKey =
  | "hoje"
  | "ontem"
  | "7d"
  | "mes"
  | "3meses"
  | "trimestre"
  | "ano"
  | "custom";

export type Period = { from: string; to: string };

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeRange(key: PeriodKey, custom: Period): Period {
  const today = new Date();
  const to = toISODate(today);
  if (key === "hoje") return { from: to, to };
  if (key === "ontem") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const iso = toISODate(d);
    return { from: iso, to: iso };
  }
  if (key === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toISODate(from), to };
  }
  if (key === "mes") {
    return { from: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  if (key === "3meses" || key === "trimestre") {
    const from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { from: toISODate(from), to };
  }
  if (key === "ano") {
    return { from: toISODate(new Date(today.getFullYear(), today.getMonth() - 11, 1)), to };
  }
  return custom;
}

/** Estado do seletor de período — genérico, sem regra de nenhum módulo. */
export function usePeriodPicker(initial: PeriodKey = "mes", initialCustom?: Partial<Period>) {
  const [key, setKey] = useState<PeriodKey>(initial);
  const [custom, setCustom] = useState<Period>(() => ({
    ...computeRange("mes", { from: "", to: "" }),
    ...initialCustom,
  }));
  const period = useMemo(() => computeRange(key, custom), [key, custom]);
  return { key, setKey, custom, setCustom, period };
}

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "mes", label: "1 mês" },
  { key: "3meses", label: "3 meses" },
  { key: "trimestre", label: "Trimestre" },
  { key: "ano", label: "Ano" },
  { key: "custom", label: "Personalizado" },
];

export function PeriodPicker({
  value,
  onChange,
  custom,
  onCustomChange,
  options,
}: {
  value: PeriodKey;
  onChange: (key: PeriodKey) => void;
  custom: Period;
  onCustomChange: (period: Period) => void;
  /** Quais atalhos aparecem (padrão: todas as opções). */
  options?: PeriodKey[];
}) {
  const shown = OPTIONS.filter((o) =>
    options ? options.includes(o.key) : true,
  );
  const currentLabel = shown.find((o) => o.key === value)?.label ?? "Período";

  return (
    <div className="space-y-3">
      <Select value={value} onValueChange={(v) => onChange(v as PeriodKey)}>
        <SelectTrigger className="h-8 w-auto min-w-[9.5rem] gap-2 text-body">
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <SelectValue placeholder="Período">{currentLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {shown.map((o) => (
            <SelectItem key={o.key} value={o.key} className="text-body">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="periodo-de" className="text-label">
              De
            </Label>
            <Input
              id="periodo-de"
              type="date"
              className="text-body"
              value={custom.from}
              onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="periodo-ate" className="text-label">
              Até
            </Label>
            <Input
              id="periodo-ate"
              type="date"
              className="text-body"
              value={custom.to}
              onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
