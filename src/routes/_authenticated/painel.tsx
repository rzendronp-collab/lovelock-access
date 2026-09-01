import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel de hoje | EuroHub" },
      { name: "description", content: "Resumo do dia no EuroHub: sua empresa, seu papel e o que está em aberto." },
      { property: "og:title", content: "Painel de hoje | EuroHub" },
      {
        property: "og:description",
        content: "Resumo do dia no EuroHub: sua empresa, seu papel e o que está em aberto.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["membership"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const id = userData.user?.id;
      if (!id) return null;
      const { data, error } = await supabase
        .from("memberships")
        .select("role, organizations(name)")
        .eq("user_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageHeader
        title="Painel de hoje"
        subtitle="Visão geral do dia. Os módulos entram em seguida."
        actions={
          <SelectPillGroup>
            <SelectPill active>Hoje</SelectPill>
            <SelectPill>Semana</SelectPill>
          </SelectPillGroup>
        }
      />

      <AppCard title="Sua empresa" subtitle="Dados do seu vínculo atual">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState
            message="Não foi possível carregar sua empresa."
            onRetry={() => void refetch()}
          />
        ) : data ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-highlight font-semibold">{data.organizations?.name}</span>
            <span className="text-label rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
              {data.role}
            </span>
          </div>
        ) : (
          <EmptyState
            title="Sem empresa vinculada"
            message="Ainda não há nada aqui. Nenhuma empresa está ligada à sua conta."
          />
        )}
      </AppCard>

      <AppCard title="Seu dia" subtitle="Itens em aberto dos módulos">
        <EmptyState title="Nada por aqui" message="Ainda não há nada aqui." />
      </AppCard>
    </>
  );
}
