import { Download, Upload } from 'lucide-react';
import { loadDefaultSnapshot, saveDefaultSnapshot } from '../lib/storage';
import { useWorkbenchStore } from '../stores/workbenchStore';

export function WorkspaceActions() {
  const files = useWorkbenchStore((state) => state.files);
  const contextItems = useWorkbenchStore((state) => state.contextItems);
  const loadSnapshot = useWorkbenchStore((state) => state.loadSnapshot);
  const addTimeline = useWorkbenchStore((state) => state.addTimeline);

  async function save() {
    const snapshot = await saveDefaultSnapshot({ name: 'Default workspace', files, contextItems });
    addTimeline({ type: 'tool_result', toolName: 'save_workspace', output: { savedAt: new Date(snapshot.savedAt).toISOString(), files: files.length } });
  }

  async function load() {
    const snapshot = await loadDefaultSnapshot();
    if (!snapshot) {
      addTimeline({ type: 'assistant_message', content: 'No saved workspace snapshot found.' });
      return;
    }
    loadSnapshot(snapshot);
    addTimeline({ type: 'tool_result', toolName: 'load_workspace', output: { savedAt: new Date(snapshot.savedAt).toISOString(), files: snapshot.files.length } });
  }

  return (
    <span className="rowActions">
      <button className="ghost" onClick={save}><Download size={15} /> Save</button>
      <button className="ghost" onClick={load}><Upload size={15} /> Load</button>
    </span>
  );
}
