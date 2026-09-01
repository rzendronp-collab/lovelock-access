import { useMemo, useRef } from "react";
import { Bold, Code, Heading, Link as LinkIcon, List, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tool = "bold" | "list" | "link" | "heading" | "quote" | "code";

const SIMPLE: Tool[] = ["bold", "list", "link"];
const FULL: Tool[] = ["heading", "bold", "list", "quote", "link", "code"];

const TOOLS: Record<Tool, { icon: typeof Bold; label: string; wrap: (sel: string) => string }> = {
  bold: { icon: Bold, label: "Negrito", wrap: (s) => `**${s || "texto"}**` },
  list: { icon: List, label: "Lista", wrap: (s) => `- ${s || "item"}` },
  link: { icon: LinkIcon, label: "Link", wrap: (s) => `[${s || "texto"}](https://)` },
  heading: { icon: Heading, label: "Título", wrap: (s) => `## ${s || "Título"}` },
  quote: { icon: Quote, label: "Citação", wrap: (s) => `> ${s || "citação"}` },
  code: { icon: Code, label: "Código", wrap: (s) => `\`${s || "code"}\`` },
};

/**
 * Editor de texto rico ÚNICO do sistema (marcação simples de texto).
 * `level="simples"` = negrito, lista e link. `level="completo"` inclui
 * títulos, citações e código.
 */
export function RichTextEditor({
  id,
  label,
  value,
  onChange,
  level = "simples",
  disabled = false,
  rows = 6,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  level?: "simples" | "completo";
  disabled?: boolean;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const tools = level === "completo" ? FULL : SIMPLE;

  function apply(tool: Tool) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const inserted = TOOLS[tool].wrap(selected);
    onChange(value.slice(0, start) + inserted + value.slice(end));
  }

  return (
    <div className="space-y-1">
      {label && (
        <Label htmlFor={id} className="text-label">
          {label}
        </Label>
      )}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-1">
          {tools.map((t) => {
            const Icon = TOOLS[t].icon;
            return (
              <Button
                key={t}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={TOOLS[t].label}
                onClick={() => apply(t)}
              >
                <Icon className="size-4" aria-hidden />
              </Button>
            );
          })}
        </div>
      )}
      <Textarea
        id={id}
        ref={ref}
        rows={rows}
        disabled={disabled}
        className="text-body"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

type Block = { key: string; node: React.ReactNode };

/** Leitura do texto rico — usa a mesma marcação do editor. */
export function RichText({
  value,
  className,
  clamp = false,
}: {
  value: string;
  className?: string;
  clamp?: boolean;
}) {
  const blocks = useMemo(() => renderBlocks(value), [value]);
  if (!value.trim()) return null;
  return (
    <div className={cn("text-body space-y-2", clamp && "line-clamp-6", className)}>
      {blocks.map((b) => b.node)}
    </div>
  );
}

function renderBlocks(value: string): Block[] {
  const lines = value.split("\n");
  const out: Block[] = [];
  let list: string[] = [];

  const flush = (key: string) => {
    if (list.length === 0) return;
    const items = [...list];
    list = [];
    out.push({
      key,
      node: (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {items.map((item, i) => (
            <li key={`${key}-${i}`}>{inline(item)}</li>
          ))}
        </ul>
      ),
    });
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `b${i}`;
    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flush(`l${i}`);
    if (!line.trim()) return;
    if (/^#{2,}\s+/.test(line)) {
      out.push({
        key,
        node: (
          <h3 key={key} className="text-highlight font-semibold">
            {inline(line.replace(/^#{2,}\s+/, ""))}
          </h3>
        ),
      });
      return;
    }
    if (/^#\s+/.test(line)) {
      out.push({
        key,
        node: (
          <h2 key={key} className="text-title font-semibold">
            {inline(line.replace(/^#\s+/, ""))}
          </h2>
        ),
      });
      return;
    }
    if (/^>\s?/.test(line)) {
      out.push({
        key,
        node: (
          <blockquote
            key={key}
            className="border-l-2 border-border pl-3 text-muted-foreground italic"
          >
            {inline(line.replace(/^>\s?/, ""))}
          </blockquote>
        ),
      });
      return;
    }
    out.push({ key, node: <p key={key}>{inline(line)}</p> });
  });

  flush("l-end");
  return out;
}

/** Negrito, código e links dentro de uma linha. */
function inline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((\S+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;

  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const key = `i${n++}`;
    if (m[1] !== undefined) parts.push(<strong key={key}>{m[1]}</strong>);
    else if (m[2] !== undefined)
      parts.push(
        <code key={key} className="text-label rounded bg-muted px-1 py-0.5">
          {m[2]}
        </code>,
      );
    else if (m[3] !== undefined && m[4] !== undefined)
      parts.push(
        <a
          key={key}
          href={m[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {m[3]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
