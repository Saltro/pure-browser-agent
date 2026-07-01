import Editor from '@monaco-editor/react';
import { Save } from 'lucide-react';
import { isWebContainerBooted, syncFilesToContainer, writeContainerFile } from '../lib/webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { Button } from './ui/button';

function languageFor(path: string) {
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  return 'javascript';
}

export function EditorPane() {
  const activePath = useWorkbenchStore((state) => state.activePath);
  const files = useWorkbenchStore((state) => state.files);
  const file = files.find((item) => item.path === activePath);
  const upsertFile = useWorkbenchStore((state) => state.upsertFile);
  const addMessage = useWorkbenchStore((state) => state.addMessage);

  if (!file) return <section className="panel editorPane emptyState">No file selected</section>;

  async function syncCurrentFile() {
    if (!file || !isWebContainerBooted()) return;
    await writeContainerFile(file.path, file.content);
    addMessage({ type: 'tool_result', toolName: 'sync_file', output: { path: file.path } });
  }

  async function syncAllFiles() {
    if (!isWebContainerBooted()) return;
    await syncFilesToContainer(files);
    addMessage({ type: 'tool_result', toolName: 'sync_workspace', output: { files: files.length } });
  }

  return (
    <section className="panel editorPane">
      <div className="panelTitle">
        <span>{file.path}</span>
        <span className="rowActions">
          <Button variant="outline" size="sm" className="small" onClick={syncCurrentFile}><Save size={14} /> Sync file</Button>
          <Button variant="outline" size="sm" className="small" onClick={syncAllFiles}>Sync all</Button>
        </span>
      </div>
      <Editor
        height="100%"
        theme="vs-dark"
        path={file.path}
        language={languageFor(file.path)}
        value={file.content}
        onChange={(value) => upsertFile(file.path, value || '')}
        options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', tabSize: 2 }}
      />
    </section>
  );
}
