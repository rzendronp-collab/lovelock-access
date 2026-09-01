import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Empresa ÚNICA da pessoa (lida de memberships) — usada por todos os módulos. */
export function useOrgId() {
  return useQuery({
    queryKey: ["org-id"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.org_id ?? null;
    },
  });
}

/** Papel da pessoa na empresa ('dono' | 'admin' | 'membro'). */
export function useOrgRole() {
  return useQuery({
    queryKey: ["org-role"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.role ?? null;
    },
  });
}

/** Id da pessoa autenticada. */
export function useUserId() {
  return useQuery({
    queryKey: ["user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });
}

export type OrgRole = "dono" | "admin" | "membro" | "parceiro" | "leitura";

/** Papel da pessoa logada, normalizado. */
export function useMyRole() {
  const { data, isLoading } = useOrgRole();
  return { role: (data as OrgRole | null) ?? null, isLoading };
}

/**
 * Permissões da pessoa logada — fonte ÚNICA usada por todos os módulos:
 * leitura só vê; membro/parceiro criam e editam e excluem só o que criaram;
 * dono/admin excluem qualquer coisa.
 */
export function usePermissions() {
  const { role, isLoading } = useMyRole();
  const { data: userId } = useUserId();

  const isAdmin = role === "dono" || role === "admin";
  const canWrite = isAdmin || role === "membro" || role === "parceiro";
  const isReadOnly = role === "leitura";

  /** Pode excluir ESTE registro (dono/admin sempre; os demais só o que criaram). */
  function canDelete(createdBy?: string | null) {
    if (isAdmin) return true;
    if (!canWrite) return false;
    return !!createdBy && !!userId && createdBy === userId;
  }

  return { role, userId: userId ?? null, isAdmin, canWrite, isReadOnly, canDelete, isLoading };
}
