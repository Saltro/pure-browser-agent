import { FormEvent, useState } from 'react';
import { useWorkbenchStore } from '../stores/workbenchStore';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const llm = useWorkbenchStore((state) => state.llm);
  const setLlm = useWorkbenchStore((state) => state.setLlm);
  const [baseUrl, setBaseUrl] = useState(llm.baseUrl);
  const [model, setModel] = useState(llm.model);
  const [apiKey, setApiKey] = useState(llm.apiKey);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    setLlm({ baseUrl, model, apiKey });
    onClose();
  }

  return (
    <div className="modalBackdrop">
      <form className="modal" onSubmit={submit}>
        <h2>OpenAI-compatible settings</h2>
        <label>Base URL<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
        <label>Model<input value={model} onChange={(event) => setModel(event.target.value)} /></label>
        <label>API Key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label>
        <p className="muted">Pure browser demo: the API key is stored locally in this browser. Do not use this as a public multi-user deployment.</p>
        <div className="modalActions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button>Save</button></div>
      </form>
    </div>
  );
}
