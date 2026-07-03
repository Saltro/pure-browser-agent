import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorPane } from './EditorPane';
import { FileExplorer } from './FileExplorer';

export function WorkspacePane() {
  const [filesWidth, setFilesWidth] = useState(220);
  const [resizing, setResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (event: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(400, Math.max(160, event.clientX - rect.left));
      setFilesWidth(newWidth);
    };
    const stop = () => setResizing(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', handleMove);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  return (
    <div ref={containerRef} className="workspacePane" style={{ '--files-width': `${filesWidth}px` } as React.CSSProperties}>
      <div className="workspaceFiles">
        <FileExplorer />
      </div>
      <div className="workspaceSplitter" role="separator" aria-orientation="vertical" onPointerDown={startResize} />
      <div className="workspaceEditor">
        <EditorPane />
      </div>
    </div>
  );
}
