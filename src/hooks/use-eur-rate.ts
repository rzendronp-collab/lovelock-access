import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/hooks/use-org";

export const DEFAULT_EUR_RATE = 6;

/** Cotação do euro em real definida pela empresa (fonte ÚNICA da conversão visual). */
export function useEurRate() {
  const { data: orgId } = useOrgId();
  const queryClient = useQueryClient();
  const queryKey = ["eur-rate", orgId ?? null];

  const query = useQuery({
    queryKey,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("eur_to_brl")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.eur_to_brl ?? DEFAULT_EUR_RATE);
    },
  });

  const save = useMutation({
    mutationFn: async (rate: number) => {
      const { error } = await supabase
        .from("organizations")
        .update({ eur_to_brl: rate })
        .eq("id", orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast.success("Cotação salva.");
    },
    onError: () => toast.error("Não foi possível salvar a cotação."),
  });

  return { orgId: orgId ?? null, rate: query.data ?? DEFAULT_EUR_RATE, isLoading: query.isLoading, save };
}
