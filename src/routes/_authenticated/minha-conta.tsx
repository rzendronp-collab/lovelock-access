import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha conta | Plataforma interna" },
      { name: "description", content: "Edite seu nome, troque sua senha e saia da plataforma." },
      { property: "og:title", content: "Minha conta | Plataforma interna" },
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
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Minha conta</h1>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Seu nome aparece para as pessoas da sua empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveName}>
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="text-sm text-muted-foreground">
                Foto de perfil em breve.
                <div>
                  <Button type="button" variant="outline" size="sm" className="mt-2" disabled>
                    Enviar foto
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="full-name">Nome completo</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={savingName}>
              {savingName ? "Salvando..." : "Salvar nome"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senha</CardTitle>
          <CardDescription>Defina uma nova senha de acesso.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={savePassword}>
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "Salvando..." : "Trocar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessão</CardTitle>
          <CardDescription>Encerrar o acesso neste dispositivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOut}>
            Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
