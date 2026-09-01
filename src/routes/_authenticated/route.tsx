import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CreditCard,
  FolderClosed,
  ListChecks,
  Moon,
  Settings,
  Sun,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/painel", label: "Painel de hoje", icon: CalendarCheck },
  { to: "/trabalho", label: "Trabalho", icon: ListChecks },
  { to: "/dinheiro", label: "Dinheiro", icon: Wallet },
  { to: "/arquivos", label: "Arquivos", icon: FolderClosed },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const { data: profile } = useQuery({
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

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const initials = (profile?.full_name || "EH")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-label font-bold text-sidebar-primary-foreground">
            EH
          </span>
          <span className="text-highlight font-semibold text-sidebar-foreground">EuroHub</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="text-body flex items-center gap-2.5 rounded-md px-3 py-2 font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent",
              }}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Link
            to="/minha-conta"
            className="text-body flex items-center gap-2.5 rounded-md px-2 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Avatar className="size-6">
              <AvatarFallback className="text-label">{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate">{profile?.full_name || "Minha conta"}</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-5">
          <div className="flex items-center gap-2 md:hidden">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-label font-bold text-primary-foreground">
              EH
            </span>
            <span className="text-highlight font-semibold">EuroHub</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-label rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Alternar tema claro e escuro"
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Ajustes" asChild>
              <Link to="/ajustes">
                <Settings className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="text-label" onClick={handleSignOut}>
              Sair
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-8">
          <Outlet />
        </main>

        <nav className="flex items-center justify-around border-t border-border bg-card px-2 py-2 md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="text-label flex flex-col items-center gap-1 rounded-md px-2 py-1 text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-4" aria-hidden />
              {label.split(" ")[0]}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
