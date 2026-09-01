import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRecords } from "@/hooks/use-records";
import { useOrgId } from "@/hooks/use-org";

export type ProjectRow = {
  id: string;
  name: string;
  color: string;
  position: number;
  archived: boolean;
  created_by?: string | null;
};

const STORAGE_KEY = "eurohub:projeto";

/** Lista de projetos da empresa (fonte ÚNICA usada pelo seletor e pela tela de gestão). */
export function useProjects() {
  const { data: orgId } = useOrgId();
  return useRecords<ProjectRow>({
    table: "projects",
    columns: "id, name, color, position, archived, created_by",
    orgId: orgId ?? null,
    orderBy: { column: "position", ascending: true },
    softDelete: false,
    label: "projeto",
  });
}

type Ctx = {
  projects: ProjectRow[];
  activeProjects: ProjectRow[];
  projectId: string | null;
  project: ProjectRow | null;
  setProjectId: (id: string | null) => void;
  isLoading: boolean;
};

const ProjectContext = createContext<Ctx | null>(null);

/** Projeto escolhido, guardado no navegador — não reseta ao navegar. */
export function CurrentProjectProvider({ children }: { children: ReactNode }) {
  const records = useProjects();
  const [projectId, setProjectId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const projects = records.rows;
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  useEffect(() => {
    if (records.isLoading) return;
    const valid = activeProjects.some((p) => p.id === projectId);
    if (!valid) {
      const next = activeProjects[0]?.id ?? null;
      if (next !== projectId) setProjectId(next);
    }
  }, [activeProjects, projectId, records.isLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (projectId) window.localStorage.setItem(STORAGE_KEY, projectId);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [projectId]);

  const value = useMemo<Ctx>(
    () => ({
      projects,
      activeProjects,
      projectId,
      project: activeProjects.find((p) => p.id === projectId) ?? null,
      setProjectId,
      isLoading: records.isLoading,
    }),
    [projects, activeProjects, projectId, records.isLoading],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/** Projeto selecionado no cabeçalho. */
export function useCurrentProject(): Ctx {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    return {
      projects: [],
      activeProjects: [],
      projectId: null,
      project: null,
      setProjectId: () => {},
      isLoading: false,
    };
  }
  return ctx;
}
