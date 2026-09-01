import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/trabalho")({
  head: () => ({
    meta: [
      { title: "Trabalho | EuroHub" },
      { name: "description", content: "Área de trabalho do EuroHub: tarefas e entregas da equipe." },
      { property: "og:title", content: "Trabalho | EuroHub" },
      {
        property: "og:description",
        content: "Área de trabalho do EuroHub: tarefas e entregas da equipe.",
      },
    ],
  }),
  component: Trabalho,
});

function Trabalho() {
  return (
    <>
      <PageHeader title="Trabalho" subtitle="Tarefas e entregas da sua equipe." />
      <AppCard>
        <EmptyState
          title="Nada em Trabalho"
          message="Ainda não há nada aqui. Este módulo será ligado em breve."
          icon={<ListChecks className="size-5" aria-hidden />}
        />
      </AppCard>
    </>
  );
}
