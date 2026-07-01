import { Pin, Trash2 } from 'lucide-react';
import { useWorkbenchStore } from '../stores/workbenchStore';

export function ContextPanel() {
  const contextItems = useWorkbenchStore((state) => state.contextItems);
  const removeContext = useWorkbenchStore((state) => state.removeContext);
  return (
    <aside className="panel contextPanel">
      <div className="panelTitle"><Pin size={15} /> Context</div>
      <div className="contextList">
        {contextItems.length === 0 && <p className="muted">Pin files, terminal output, or tool results here.</p>}
        {contextItems.map((item) => (
          <details key={item.id} className="contextItem" open>
            <summary>
              {item.title} <span>{item.type}</span>
              <button className="miniDanger" onClick={(event) => { event.preventDefault(); removeContext(item.id); }}><Trash2 size={12} /></button>
            </summary>
            <pre>{item.content}</pre>
          </details>
        ))}
      </div>
    </aside>
  );
}
