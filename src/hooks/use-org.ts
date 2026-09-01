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
