import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/dinheiro")({
  head: () => ({
    meta: [
      { title: "Dinheiro | EuroHub" },
      { name: "description", content: "Área financeira do EuroHub: entradas, saídas e saldos." },
      { property: "og:title", content: "Dinheiro | EuroHub" },
      {
        property: "og:description",
        content: "Área financeira do EuroHub: entradas, saídas e saldos.",
      },
    ],
  }),
  component: Dinheiro,
});

function Dinheiro() {
  return (
    <>
      <PageHeader title="Dinheiro" subtitle="Entradas, saídas e saldos da empresa." />
      <AppCard>
        <EmptyState
          title="Nada em Dinheiro"
          message="Ainda não há nada aqui. Este módulo será ligado em breve."
          icon={<Wallet className="size-5" aria-hidden />}
        />
      </AppCard>
    </>
  );
}
