import { createFileRoute } from "@tanstack/react-router";
import { FolderClosed } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { EmptyState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/arquivos")({
  head: () => ({
    meta: [
      { title: "Arquivos | EuroHub" },
      { name: "description", content: "Arquivos e documentos compartilhados da empresa no EuroHub." },
      { property: "og:title", content: "Arquivos | EuroHub" },
      {
        property: "og:description",
        content: "Arquivos e documentos compartilhados da empresa no EuroHub.",
      },
    ],
  }),
  component: Arquivos,
});

function Arquivos() {
  return (
    <>
      <PageHeader title="Arquivos" subtitle="Documentos compartilhados da empresa." />
      <AppCard>
        <EmptyState
          title="Nada em Arquivos"
          message="Ainda não há nada aqui. Este módulo será ligado em breve."
          icon={<FolderClosed className="size-5" aria-hidden />}
        />
      </AppCard>
    </>
  );
}
