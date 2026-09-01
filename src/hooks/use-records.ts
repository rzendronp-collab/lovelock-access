import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Cliente sem tipo de tabela fixo — o hook é genérico por nome de tabela. */
const db = supabase as unknown as SupabaseClient;

export type RecordRow = Record<string, unknown> & { id: string };

export type UseRecordsOptions = {
  /** Nome da tabela no banco. */
  table: string;
  /** Campos lidos (ex.: "id, description, amount"). */
  columns?: string;
  /** Escopo da empresa (quando a tabela tem org_id). */
  orgId?: string | null;
  /** Escopo do projeto (quando informado, filtra e grava project_id). */
  projectId?: string | null;
  /** Só lista quando há projeto escolhido (módulos por projeto). */
  projectRequired?: boolean;
  /** Ordenação da lista. */
  orderBy?: { column: string; ascending?: boolean };

  /** Exclusão suave por deleted_at (padrão: sim). */
  softDelete?: boolean;
  /** Campos ignorados ao duplicar um registro. */
  omitOnDuplicate?: string[];
  /** Guarda quem criou (created_by) ao inserir. */
  trackCreatedBy?: boolean;
  /** Nome amigável usado nas mensagens. */
  label?: string;
};

/**
 * Hook ÚNICO de registros do sistema: listar, criar, editar, excluir (soft delete)
 * e duplicar — parametrizado pela tabela e pelos campos.
 */
export function useRecords<T extends RecordRow = RecordRow>({
  table,
  columns = "*",
  orgId,
  projectId,
  projectRequired = false,
  orderBy,
  softDelete = true,
  omitOnDuplicate = ["id", "created_at", "updated_at"],
  trackCreatedBy = false,
  label = "registro",
}: UseRecordsOptions) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["records", table, orgId ?? null, projectId ?? null],
    [table, orgId, projectId],
  );
  const needsOrg = orgId !== undefined;

  const list = useQuery({
    queryKey,
    enabled: (!needsOrg || !!orgId) && (!projectRequired || !!projectId),
    queryFn: async () => {
      let q = db.from(table).select(columns);
      if (orgId) q = q.eq("org_id", orgId);
      if (projectId) q = q.eq("project_id", projectId);
      if (softDelete) q = q.is("deleted_at", null);
      if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  async function insert(values: Record<string, unknown>) {
    const payload: Record<string, unknown> = { ...values };
    if (orgId) payload['org_id'] = orgId;
    if (projectId && payload['project_id'] === undefined) payload['project_id'] = projectId;
    if (trackCreatedBy) {
      const { data: userData } = await supabase.auth.getUser();
      payload['created_by'] = userData.user?.id ?? null;
    }
    const { error } = await db.from(table).insert(payload);
    if (error) throw error;
  }


  const create = useMutation({
    mutationFn: insert,
    onSuccess: () => {
      invalidate();
      toast.success(`${cap(label)} salvo.`);
    },
    onError: () => toast.error(`Não foi possível salvar o ${label}.`),
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await db.from(table).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(`${cap(label)} salvo.`);
    },
    onError: () => toast.error(`Não foi possível salvar o ${label}.`),
  });

  /** Cria ou edita conforme a presença de id. */
  const save = useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: Record<string, unknown> }) => {
      if (id) {
        const { error } = await db.from(table).update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      await insert(values);
    },
    onSuccess: () => {
      invalidate();
      toast.success(`${cap(label)} salvo.`);
    },
    onError: () => toast.error(`Não foi possível salvar o ${label}.`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (softDelete) {
        const { error } = await db
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(`${cap(label)} excluído.`);
    },
    onError: () => toast.error("Não foi possível excluir."),
  });

  const duplicate = useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (omitOnDuplicate.includes(k)) continue;
        values[k] = v;
      }
      await insert(values);
    },
    onSuccess: () => {
      invalidate();
      toast.success(`${cap(label)} duplicado.`);
    },
    onError: () => toast.error("Não foi possível duplicar."),
  });

  return {
    queryKey,
    rows: list.data ?? [],
    isLoading: list.isLoading,
    error: list.error,
    refetch: () => void list.refetch(),
    create,
    update,
    save,
    remove,
    duplicate,
    invalidate,
  };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
