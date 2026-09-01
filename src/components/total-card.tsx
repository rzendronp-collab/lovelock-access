import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AppCard } from "@/components/app-card";
import { cn } from "@/lib/utils";

export type Delta = {
  /** Variação já calculada (positiva, negativa ou zero). */
  value: number;
  /** Texto mostrado ao lado da seta (ex.: "12,3%" ou "3,1 p.p."). */
  text: string;
  /** Descrição da comparação (ex.: "vs. mês anterior"). */
  hint?: string;
};

/** Bloco de número ÚNICO do sistema (usado no Dinheiro e no Painel de hoje). */
export function TotalCard({
  label,
  value,
  delta,
  sub,
}: {
  label: string;
  value: string;
  delta?: Delta | undefined;
  /** Linha pequena e discreta abaixo do número (ex.: equivalente aproximado em real). */
  sub?: string | undefined;
}) {
  const dir = delta ? (delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat") : null;
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;

  return (
    <AppCard>
      <p className="text-label text-muted-foreground">{label}</p>
      <p className="text-title font-semibold">{value}</p>
      {sub && <p className="text-label text-muted-foreground">{sub}</p>}
      {delta && (
        <p
          className={cn(
            "text-label mt-1 flex items-center gap-1",
            dir === "up" && "text-primary",
            dir === "down" && "text-destructive",
            dir === "flat" && "text-muted-foreground",
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span>{delta.text}</span>
          {delta.hint && <span className="text-muted-foreground">{delta.hint}</span>}
        </p>
      )}
    </AppCard>
  );
}
