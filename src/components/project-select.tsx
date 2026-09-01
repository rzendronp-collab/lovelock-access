import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { EmptyState } from "@/components/states";
import { useCurrentProject } from "@/hooks/use-projects";

/** Seletor de projeto do cabeçalho — escolha global do sistema. */
export function ProjectSwitcher() {
  const { activeProjects, project, setProjectId } = useCurrentProject();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="text-label max-w-40">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: project?.color ?? "var(--muted-foreground)" }}
            aria-hidden
          />
          <span className="truncate">{project?.name ?? "Sem projeto"}</span>
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {activeProjects.map((p) => (
          <DropdownMenuItem key={p.id} className="text-body" onClick={() => setProjectId(p.id)}>
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: p.color }}
              aria-hidden
            />
            <span className="truncate">{p.name}</span>
            {p.id === project?.id && <Check className="ml-auto size-4" aria-hidden />}
          </DropdownMenuItem>
        ))}
        {activeProjects.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem asChild className="text-body">
          <Link to="/projetos">
            <FolderKanban className="size-4" aria-hidden />
            Gerenciar projetos
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Filtro local por projeto (módulos globais: Agenda, Painel, Arquivos). */
export function ProjectFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { activeProjects } = useCurrentProject();
  if (activeProjects.length === 0) return null;
  return (
    <SelectPillGroup>
      <SelectPill active={!value} onClick={() => onChange(null)}>
        Todos os projetos
      </SelectPill>
      {activeProjects.map((p) => (
        <SelectPill key={p.id} active={value === p.id} onClick={() => onChange(p.id)}>
          {p.name}
        </SelectPill>
      ))}
    </SelectPillGroup>
  );
}

/** Estado usado pelos módulos por projeto quando nenhum projeto está escolhido. */
export function NoProjectState() {
  const { activeProjects } = useCurrentProject();
  return (
    <EmptyState
      title={activeProjects.length ? "Selecione um projeto" : "Crie o primeiro projeto"}
      message={
        activeProjects.length
          ? "Escolha um projeto no seletor do cabeçalho para ver estas informações."
          : "Os módulos de negócio funcionam dentro de um projeto. Crie um para começar."
      }
      icon={<FolderKanban className="size-5" aria-hidden />}
      action={
        <Button asChild className="text-body">
          <Link to="/projetos">Gerenciar projetos</Link>
        </Button>
      }
    />
  );
}
