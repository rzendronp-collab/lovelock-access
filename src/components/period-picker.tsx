import { useMemo, useState } from "react";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PeriodKey = "7d" | "mes" | "trimestre" | "custom";

export type Period = { from: string; to: string };

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeRange(key: PeriodKey, custom: Period): Period {
  const today = new Date();
  const to = toISODate(today);
  if (key === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toISODate(from), to };
  }
  if (key === "mes") {
    return { from: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  if (key === "trimestre") {
    const from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { from: toISODate(from), to };
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
  { key: "7d", label: "7 dias" },
  { key: "mes", label: "Mês" },
  { key: "trimestre", label: "Trimestre" },
  { key: "custom", label: "Personalizado" },
];

export function PeriodPicker({
  value,
  onChange,
  custom,
  onCustomChange,
}: {
  value: PeriodKey;
  onChange: (key: PeriodKey) => void;
  custom: Period;
  onCustomChange: (period: Period) => void;
}) {
  return (
    <div className="space-y-3">
      <SelectPillGroup>
        {OPTIONS.map((o) => (
          <SelectPill key={o.key} active={value === o.key} onClick={() => onChange(o.key)}>
            {o.label}
          </SelectPill>
        ))}
      </SelectPillGroup>
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
