import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import type { Edge, Viewport } from "@xyflow/react";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { MindmapCanvas, type MapNode, type MapState } from "@/components/mindmap-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/mapas/$id")({
  head: () => ({
    meta: [
      { title: "Editor de mapa mental | EuroHub" },
      {
        name: "description",
        content: "Edite um mapa mental: crie nós, conecte ideias e navegue com zoom e pan.",
      },
      { property: "og:title", content: "Editor de mapa mental | EuroHub" },
      {
        property: "og:description",
        content: "Edite um mapa mental: crie nós, conecte ideias e navegue com zoom e pan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapaEditor,
});

function MapaEditor() {
  const { id } = Route.useParams();
  const perms = usePermissions();

  const [title, setTitle] = useState("");
  const stateRef = useRef<MapState>({ nodes: [], edges: [], viewport: null });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  const map = useQuery({
    queryKey: ["mindmap", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mindmaps")
        .select("id, title, nodes, edges, viewport")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (map.data) setTitle(map.data.title);
  }, [map.data]);

  const persist = useCallback(
    async (extra?: { title?: string }) => {
      setSaving(true);
      const { error } = await supabase
        .from("mindmaps")
        .update({
          title: extra?.title ?? title,
          nodes: stateRef.current.nodes as unknown as never,
          edges: stateRef.current.edges as unknown as never,
          viewport: (stateRef.current.viewport ?? null) as unknown as never,
        })
        .eq("id", id);
      setSaving(false);
      if (error) toast.error("Não foi possível salvar o mapa.");
      return !error;
    },
    [id, title],
  );

  const schedule = useCallback(() => {
    if (!perms.canWrite) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 1000);
  }, [perms.canWrite, persist]);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const onChange = useCallback(
    (state: MapState) => {
      stateRef.current = state;
      schedule();
    },
    [schedule],
  );

  if (map.isLoading || perms.isLoading) return <LoadingState />;
  if (map.error || !map.data) return <ErrorState message="Este mapa não foi encontrado." />;

  const initial: MapState = {
    nodes: (Array.isArray(map.data.nodes) ? map.data.nodes : []) as unknown as MapNode[],
    edges: (Array.isArray(map.data.edges) ? map.data.edges : []) as unknown as Edge[],
    viewport: (map.data.viewport as unknown as Viewport | null) ?? null,
  };
  stateRef.current = initial;

  return (
    <>
      <PageHeader
        title={title || "Mapa"}
        subtitle="Arraste o fundo para navegar, use o scroll para dar zoom."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-body" asChild>
              <Link to="/mapas">
                <ArrowLeft className="size-4" aria-hidden />
                Voltar
              </Link>
            </Button>
            {perms.canWrite && (
              <Button
                size="sm"
                className="text-body"
                disabled={saving}
                onClick={async () => {
                  if (await persist()) toast.success("Mapa salvo.");
                }}
              >
                <Save className="size-4" aria-hidden />
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </div>
        }
      />

      {perms.canWrite && (
        <div className="max-w-sm space-y-1">
          <Label htmlFor="mapa-titulo" className="text-label">
            Título do mapa
          </Label>
          <Input
            id="mapa-titulo"
            className="text-body"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => void persist({ title: e.target.value })}
          />
        </div>
      )}

      <MindmapCanvas key={id} initial={initial} editable={perms.canWrite} onChange={onChange} />
    </>
  );
}
