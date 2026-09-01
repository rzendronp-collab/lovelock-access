import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel | Plataforma interna" },
      { name: "description", content: "Área autenticada com a empresa e o papel do usuário." },
      { property: "og:title", content: "Painel | Plataforma interna" },
      {
        property: "og:description",
        content: "Área autenticada com a empresa e o papel do usuário.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data, isLoading, error } = useQuery({
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
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Painel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A base de acesso está pronta. Os módulos entram depois.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sua empresa</CardTitle>
          <CardDescription>Dados do seu vínculo atual</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : error ? (
            <p className="text-sm text-destructive">Não foi possível carregar sua empresa.</p>
          ) : data ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-medium">{data.organizations?.name}</span>
              <Badge variant="secondary">{data.role}</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma empresa vinculada à sua conta ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
