import { FormEvent, useState } from 'react';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function SettingsPanel() {
  const llm = useWorkbenchStore((state) => state.llm);
  const setLlm = useWorkbenchStore((state) => state.setLlm);
  const [baseUrl, setBaseUrl] = useState(llm.baseUrl);
  const [model, setModel] = useState(llm.model);
  const [apiKey, setApiKey] = useState(llm.apiKey);

  function submit(event: FormEvent) {
    event.preventDefault();
    setLlm({ baseUrl, model, apiKey });
  }

  return (
    <form className="settingsPanel" onSubmit={submit}>
      <div>
        <h2>Model settings</h2>
        <p>Configure any OpenAI-compatible endpoint. Settings are stored locally in this browser.</p>
      </div>
      <label>Base URL<Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
      <label>Model<Input value={model} onChange={(event) => setModel(event.target.value)} /></label>
      <label>API Key<Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label>
      <Button>Save settings</Button>
    </form>
  );
}
