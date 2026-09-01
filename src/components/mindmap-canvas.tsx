import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { ITEM_COLORS, colorSwatch } from "@/lib/board";
import { cn } from "@/lib/utils";

export type MapNode = Node<{ label: string; color: string }>;

export type MapState = {
  nodes: MapNode[];
  edges: Edge[];
  viewport: Viewport | null;
};

/** Nó do mapa — usa a paleta do sistema, nunca cor solta. */
function MindNode({ id, data, selected }: NodeProps<MapNode>) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const flow = useReactFlow();

  useEffect(() => setText(data.label), [data.label]);

  function commit() {
    setEditing(false);
    flow.setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: text } } : n)),
    );
  }

  return (
    <div
      className={cn(
        "min-w-32 max-w-56 rounded-xl border border-border bg-card px-3 py-2 text-card-foreground shadow-sm",
        selected && "ring-2 ring-primary",
      )}
    >
      <Handle type="target" position={Position.Top} />
      <div aria-hidden className={cn("mb-1 h-1 rounded-full", colorSwatch(data.color))} />
      {editing ? (
        <input
          autoFocus
          aria-label="Texto do nó"
          className="text-body w-full bg-transparent outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
      ) : (
        <p className="text-body break-words" onDoubleClick={() => setEditing(true)}>
          {data.label || "Sem texto"}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

/** Nó somente leitura (papel "leitura"). */
function ReadOnlyNode({ data }: NodeProps<MapNode>) {
  return (
    <div className="min-w-32 max-w-56 rounded-xl border border-border bg-card px-3 py-2 text-card-foreground shadow-sm">
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div aria-hidden className={cn("mb-1 h-1 rounded-full", colorSwatch(data.color))} />
      <p className="text-body break-words">{data.label || "Sem texto"}</p>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

function Canvas({
  initial,
  editable,
  onChange,
}: {
  initial: MapState;
  editable: boolean;
  onChange: (state: MapState) => void;
}) {
  const [nodes, setNodes] = useState<MapNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const viewportRef = useRef<Viewport | null>(initial.viewport);
  const flow = useReactFlow();
  const seq = useRef(1);

  const nodeTypes = useMemo(
    () => ({ mind: editable ? MindNode : ReadOnlyNode }),
    [editable],
  );

  const emit = useCallback(
    (ns: MapNode[], es: Edge[]) => onChange({ nodes: ns, edges: es, viewport: viewportRef.current }),
    [onChange],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<MapNode>[]) =>
      setNodes((ns) => {
        const next = applyNodeChanges(changes, ns);
        emit(next, edges);
        return next;
      }),
    [edges, emit],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((es) => {
        const next = applyEdgeChanges(changes, es);
        emit(nodes, next);
        return next;
      }),
    [nodes, emit],
  );

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((es) => {
        const next = addEdge({ ...c, animated: false }, es);
        emit(nodes, next);
        return next;
      }),
    [nodes, emit],
  );

  function addNode(position?: { x: number; y: number }) {
    const id = `n${Date.now()}-${seq.current++}`;
    const node: MapNode = {
      id,
      type: "mind",
      position: position ?? { x: 80 + Math.random() * 240, y: 80 + Math.random() * 200 },
      data: { label: "Novo nó", color: "principal" },
    };
    setNodes((ns) => {
      const next = [...ns, node];
      emit(next, edges);
      return next;
    });
  }

  function deleteSelection() {
    const keptNodes = nodes.filter((n) => !n.selected);
    const removed = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    const keptEdges = edges.filter(
      (e) => !e.selected && !removed.has(e.source) && !removed.has(e.target),
    );
    setNodes(keptNodes);
    setEdges(keptEdges);
    emit(keptNodes, keptEdges);
  }

  function paintSelection(color: string) {
    setNodes((ns) => {
      const next = ns.map((n) => (n.selected ? { ...n, data: { ...n.data, color } } : n));
      emit(next, edges);
      return next;
    });
  }

  const hasSelection = nodes.some((n) => n.selected) || edges.some((e) => e.selected);

  return (
    <div className="relative h-[70vh] min-h-96 overflow-hidden rounded-xl border border-border bg-card">
      {editable && (
        <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
          <Button size="sm" className="text-body" onClick={() => addNode()}>
            <Plus className="size-4" aria-hidden />
            Adicionar nó
          </Button>
          {hasSelection && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-body"
                aria-label="Excluir seleção"
                onClick={deleteSelection}
              >
                <Trash2 className="size-4" aria-hidden />
                Excluir
              </Button>
              <SelectPillGroup>
                {ITEM_COLORS.map((c) => (
                  <SelectPill key={c.value} onClick={() => paintSelection(c.value)}>
                    {c.label}
                  </SelectPill>
                ))}
              </SelectPillGroup>
            </>
          )}
        </div>
      )}
      <ReactFlow<MapNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={editable ? onNodesChange : undefined}
        onEdgesChange={editable ? onEdgesChange : undefined}
        onConnect={editable ? onConnect : undefined}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={editable}
        deleteKeyCode={editable ? ["Delete", "Backspace"] : null}
        defaultViewport={initial.viewport ?? { x: 0, y: 0, zoom: 1 }}
        onMoveEnd={(_, vp) => {
          viewportRef.current = vp;
          emit(nodes, edges);
        }}
        onDoubleClick={(e) => {
          if (!editable) return;
          const target = e.target as HTMLElement;
          if (target.closest(".react-flow__node")) return;
          const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
          addNode(p);
        }}
        proOptions={{ hideAttribution: true }}
        fitView={!initial.viewport}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

/** Canvas de mapa mental (React Flow) com identidade do EuroHub. */
export function MindmapCanvas(props: {
  initial: MapState;
  editable: boolean;
  onChange: (state: MapState) => void;
}) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
