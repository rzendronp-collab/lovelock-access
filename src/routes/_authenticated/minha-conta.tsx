import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";


export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha conta | EuroHub" },
      { name: "description", content: "Edite seu nome, troque sua senha e saia da plataforma." },
      { property: "og:title", content: "Minha conta | EuroHub" },
      {
        property: "og:description",
        content: "Edite seu nome, troque sua senha e saia da plataforma.",
      },
    ],
  }),
  component: MinhaConta,
});

function MinhaConta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const id = userData.user?.id;
      if (!id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data?.full_name) setFullName(data.full_name);
  }, [data?.full_name]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    const id = userData.user?.id;
    if (!id) return;
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", id);
    setSavingName(false);
    if (error) {
      toast.error("Não foi possível salvar o nome.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Nome atualizado.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Senha atualizada.");
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const initials = (fullName || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <>
      <PageHeader title="Minha conta" subtitle="Seus dados de acesso no EuroHub." />

      <AppCard title="Perfil" subtitle="Seu nome aparece para as pessoas da sua empresa.">
        <form className="space-y-4" onSubmit={saveName}>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="text-highlight">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-body text-muted-foreground">
              Foto de perfil em breve.
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-label mt-2"
                  disabled
                >
                  Enviar foto
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="full-name" className="text-label">
              Nome completo
            </Label>
            <Input
              id="full-name"
              className="text-body"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="text-body" disabled={savingName}>
            {savingName ? "Salvando..." : "Salvar nome"}
          </Button>
        </form>
      </AppCard>

      <AppCard title="Senha" subtitle="Defina uma nova senha de acesso.">
        <form className="space-y-4" onSubmit={savePassword}>
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-label">
              Senha atual
            </Label>
            <Input
              id="current-password"
              type="password"
              className="text-body"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-label">
              Nova senha
            </Label>
            <Input
              id="new-password"
              type="password"
              className="text-body"
              autoComplete="new-password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="text-body" disabled={savingPassword}>
            {savingPassword ? "Salvando..." : "Trocar senha"}
          </Button>
        </form>
      </AppCard>

      <AppCard title="Sessão" subtitle="Encerrar o acesso neste dispositivo.">
        <Button variant="outline" className="text-body" onClick={handleSignOut}>
          Sair da conta
        </Button>
      </AppCard>
    </>
  );
}

