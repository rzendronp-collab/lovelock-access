import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ConfirmDialog } from "@/components/detail-panel";

export const ATTACHMENTS_BUCKET = "anexos";

export type UploadedFile = {
  /** Caminho completo dentro do bucket. */
  path: string;
  name: string;
  size: number;
  mime: string;
};

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Abre um caminho do armazenamento com link temporário. */
export async function signedUrl(path: string, bucket = ATTACHMENTS_BUCKET, seconds = 60) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Remove caminhos do armazenamento (usado ao excluir registros). */
export async function removeStoragePaths(paths: string[], bucket = ATTACHMENTS_BUCKET) {
  const valid = paths.filter(Boolean);
  if (!valid.length) return;
  const { error } = await supabase.storage.from(bucket).remove(valid);
  if (error) throw error;
}

/** Remove TODOS os arquivos de uma pasta do armazenamento. */
export async function removeStorageFolder(prefix: string, bucket = ATTACHMENTS_BUCKET) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix);
  if (error) throw error;
  const paths = (data ?? []).filter((f) => f.id !== null).map((f) => `${prefix}/${f.name}`);
  await removeStoragePaths(paths, bucket);
}

/**
 * Componente ÚNICO de anexos: enviar, visualizar e excluir arquivos no
 * armazenamento. Genérico — recebe a pasta e serve a qualquer módulo.
 */
export function Attachments({
  orgId,
  folder = "",
  bucket = ATTACHMENTS_BUCKET,
  emptyMessage = "Ainda não há nada aqui. Envie o primeiro arquivo.",
  showList = true,
  buttonLabel = "Enviar arquivo",
  onUploaded,
  onRemoved,
}: {
  orgId: string | null;
  folder?: string;
  bucket?: string;
  emptyMessage?: string;
  /** Mostra a lista de arquivos da pasta (desligue quando o módulo tem a própria lista). */
  showList?: boolean;
  buttonLabel?: string;
  onUploaded?: (files: UploadedFile[]) => void | Promise<void>;
  onRemoved?: (path: string) => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const prefix = [orgId, folder].filter(Boolean).join("/");
  const queryKey = ["attachments", bucket, prefix];

  const list = useQuery({
    queryKey,
    enabled: !!orgId && showList,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return (data ?? []).filter((f) => f.id !== null);
    },
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!orgId) throw new Error("sem empresa");
      const done: UploadedFile[] = [];
      for (const file of files) {
        const path = `${prefix}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file);
        if (error) throw error;
        done.push({ path, name: file.name, size: file.size, mime: file.type });
      }
      if (onUploaded) await onUploaded(done);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast.success("Arquivo enviado.");
    },
    onError: () => toast.error("Não foi possível enviar o arquivo."),
  });

  const remove = useMutation({
    mutationFn: async (name: string) => {
      const path = `${prefix}/${name}`;
      await removeStoragePaths([path], bucket);
      if (onRemoved) await onRemoved(path);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      setToDelete(null);
      toast.success("Arquivo excluído.");
    },
    onError: () => toast.error("Não foi possível excluir o arquivo."),
  });

  async function openFile(name: string) {
    const url = await signedUrl(`${prefix}/${name}`, bucket);
    if (!url) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const rows = list.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) upload.mutate(files);
            e.target.value = "";
          }}
        />
        <Button
          className="text-body"
          disabled={!orgId || upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {upload.isPending ? "Enviando..." : buttonLabel}
        </Button>
      </div>

      {showList &&
        (list.isLoading ? (
          <LoadingState />
        ) : list.error ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhum anexo"
            message={emptyMessage}
            icon={<Paperclip className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((f) => (
              <li key={f.name} className="flex flex-wrap items-center gap-3 py-3">
                <FileText className="size-4 text-muted-foreground" aria-hidden />
                <button
                  type="button"
                  className="text-body min-w-40 flex-1 text-left font-medium hover:underline"
                  onClick={() => void openFile(f.name)}
                >
                  {f.name.replace(/^\d+-/, "")}
                </button>
                <span className="text-label text-muted-foreground">
                  {formatSize(Number(f.metadata?.['size'] ?? 0))}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir arquivo"
                  onClick={() => setToDelete(f.name)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ))}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir arquivo?"
        description="O arquivo sai do armazenamento e não pode ser recuperado."
        confirmLabel="Excluir"
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </div>
  );
}
