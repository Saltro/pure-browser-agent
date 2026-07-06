import { useMemo } from "react";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

function closeOpenFences(markdown: string): string {
  const fenceCount = (markdown.match(/^```/gm) || []).length;
  if (fenceCount % 2 === 1) {
    const trailingNewline = markdown.endsWith("\n") ? "" : "\n";
    return markdown + trailingNewline + "```";
  }
  return markdown;
}

type MarkdownProps = {
  content: string;
  className?: string;
};

export function Markdown({ content, className }: MarkdownProps) {
  const html = useMemo(() => {
    const prepared = closeOpenFences(content);
    return marked.parse(prepared) as string;
  }, [content]);

  return (
    <div
      className={className ?? "markdown-body"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
