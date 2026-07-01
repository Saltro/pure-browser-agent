import { ExternalLink } from 'lucide-react';
import { useWorkbenchStore } from '../stores/workbenchStore';

export function PreviewPane() {
  const previewUrl = useWorkbenchStore((state) => state.iframeUrl || state.previewUrl);
  return (
    <section className="panel previewPane">
      <div className="panelTitle">Preview {previewUrl && <a href={previewUrl} target="_blank"><ExternalLink size={14} /></a>}</div>
      {previewUrl ? <iframe src={previewUrl} /> : <div className="emptyPreview">Run <code>npm run dev</code> to get a preview URL.</div>}
    </section>
  );
}
