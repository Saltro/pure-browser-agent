import { useState } from 'react';
import { FileCode, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { deleteContainerFile, isWebContainerBooted, markDirty } from '../lib/webcontainer';
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

  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  function handleCreate() {
    if (!newPath.trim()) return;
    const path = newPath.trim();
    upsertFile(path, '');
    markDirty(path);
    setActivePath(path);
    setActiveTab('editor');
    setCreating(false);
    setNewPath('');
  }

  async function handleDelete(path: string) {
    deleteFile(path);
    if (isWebContainerBooted()) await deleteContainerFile(path).catch(() => undefined);
    setConfirmingDelete(null);
  }

  function handleReset() {
    resetWorkspace();
    setConfirmingReset(false);
  }

  return (
    <section className="panel filePanel">
      <div className="panelTitle">
        Files
        <span className="rowActions">
          {confirmingReset ? (
            <>
              <Button variant="destructive" size="sm" className="small" onClick={handleReset}>Confirm</Button>
              <Button variant="ghost" size="sm" className="small" onClick={() => setConfirmingReset(false)}>Cancel</Button>
            </>
          ) : (
            <Button variant="outline" size="icon" className="iconBtn" title="Reset starter workspace" onClick={() => setConfirmingReset(true)}><RotateCcw size={14} /></Button>
          )}
          <Button variant="outline" size="icon" className="iconBtn" title="New file" onClick={() => { setCreating(true); setNewPath('src/new-file.js'); }}><Plus size={14} /></Button>
        </span>
      </div>
      {creating && (
        <div className="createFileForm">
          <input
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewPath(''); } }}
            placeholder="src/new-file.js"
            autoFocus
          />
          <Button size="sm" className="small" onClick={handleCreate}>Create</Button>
          <Button size="sm" variant="ghost" className="small" onClick={() => { setCreating(false); setNewPath(''); }}>Cancel</Button>
        </div>
      )}
      <div className="fileList">
        {files.map((file) => (
          <div key={file.path} className={file.path === activePath ? 'fileRow active' : 'fileRow'}>
            <Button variant="ghost" className="file" onClick={() => { setActivePath(file.path); setActiveTab('editor'); }}><FileCode size={15} /> {file.path}</Button>
            {confirmingDelete === file.path ? (
              <span className="deleteConfirm">
                <Button variant="destructive" size="sm" className="small" onClick={() => handleDelete(file.path)}>Confirm</Button>
                <Button variant="ghost" size="sm" className="small" onClick={() => setConfirmingDelete(null)}>Cancel</Button>
              </span>
            ) : (
              <Button variant="ghost" size="icon" className="deleteFile" title="Delete" onClick={() => setConfirmingDelete(file.path)}><Trash2 size={13} /></Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
