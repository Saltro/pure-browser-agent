import { FileCode, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { deleteContainerFile, isWebContainerBooted } from '../lib/webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { Button } from './ui/button';

export function FileExplorer() {
  const files = useWorkbenchStore((state) => state.files);
  const activePath = useWorkbenchStore((state) => state.activePath);
  const setActivePath = useWorkbenchStore((state) => state.setActivePath);
  const setActiveTab = useWorkbenchStore((state) => state.setActiveTab);
  const upsertFile = useWorkbenchStore((state) => state.upsertFile);
  const deleteFile = useWorkbenchStore((state) => state.deleteFile);
  const resetWorkspace = useWorkbenchStore((state) => state.resetWorkspace);

  function createFile() {
    const path = prompt('New file path', 'src/new-file.js');
    if (!path) return;
    upsertFile(path, '');
    setActivePath(path);
    setActiveTab('editor');
  }

  async function removeFile(path: string) {
    if (!confirm(`Delete ${path}?`)) return;
    deleteFile(path);
    if (isWebContainerBooted()) await deleteContainerFile(path).catch(() => undefined);
  }

  return (
    <section className="panel filePanel">
      <div className="panelTitle">
        Files
        <span className="rowActions">
          <Button variant="outline" size="icon" className="iconBtn" title="Reset starter workspace" onClick={() => confirm('Reset starter files?') && resetWorkspace()}><RotateCcw size={14} /></Button>
          <Button variant="outline" size="icon" className="iconBtn" title="New file" onClick={createFile}><Plus size={14} /></Button>
        </span>
      </div>
      <div className="fileList">
        {files.map((file) => (
          <div key={file.path} className={file.path === activePath ? 'fileRow active' : 'fileRow'}>
            <Button variant="ghost" className="file" onClick={() => { setActivePath(file.path); setActiveTab('editor'); }}><FileCode size={15} /> {file.path}</Button>
            <Button variant="ghost" size="icon" className="deleteFile" title="Delete" onClick={() => removeFile(file.path)}><Trash2 size={13} /></Button>
          </div>
        ))}
      </div>
    </section>
  );
}
