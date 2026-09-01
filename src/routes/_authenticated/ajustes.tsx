import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes | EuroHub" },
      { name: "description", content: "Ajustes da empresa e preferências do sistema EuroHub." },
      { property: "og:title", content: "Ajustes | EuroHub" },
      {
        property: "og:description",
        content: "Ajustes da empresa e preferências do sistema EuroHub.",
      },
    ],
  }),
  component: Ajustes,
});

function Ajustes() {
  return (
    <>
      <PageHeader title="Ajustes" subtitle="Preferências da empresa e do sistema." />
      <AppCard>
        <EmptyState
          title="Nada em Ajustes"
          message="Ainda não há nada aqui. As opções de configuração entram junto com os módulos."
          icon={<Settings className="size-5" aria-hidden />}
        />
      </AppCard>
    </>
  );
}
