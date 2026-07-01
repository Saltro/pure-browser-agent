import Editor from '@monaco-editor/react';
import { Pin, Save } from 'lucide-react';
import { syncFilesToContainer, writeContainerFile, isWebContainerBooted } from '../lib/webcontainer';
import { useWorkbenchStore } from '../stores/workbenchStore';

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
  const addContext = useWorkbenchStore((state) => state.addContext);
  const addTimeline = useWorkbenchStore((state) => state.addTimeline);

  if (!file) return <section className="panel editorPane">No file selected</section>;

  async function syncCurrentFile() {
    if (!file || !isWebContainerBooted()) return;
    await writeContainerFile(file.path, file.content);
    addTimeline({ type: 'tool_result', toolName: 'sync_file', output: { path: file.path } });
  }

  async function syncAllFiles() {
    if (!isWebContainerBooted()) return;
    await syncFilesToContainer(files);
    addTimeline({ type: 'tool_result', toolName: 'sync_workspace', output: { files: files.length } });
  }

  return (
    <section className="panel editorPane">
      <div className="panelTitle">
        {file.path}
        <span className="rowActions">
          <button className="ghost small" onClick={() => addContext({ type: 'file', title: file.path, content: file.content })}><Pin size={14} /> Pin</button>
          <button className="ghost small" onClick={syncCurrentFile}><Save size={14} /> Sync file</button>
          <button className="ghost small" onClick={syncAllFiles}>Sync all</button>
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
