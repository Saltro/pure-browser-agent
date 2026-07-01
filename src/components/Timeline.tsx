import { Bot, CheckCircle2, ChevronRight, CircleAlert, Clock, Loader2, ShieldAlert, User, Wrench } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useWorkbenchStore } from '../stores/workbenchStore';

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function Timeline() {
  const timeline = useWorkbenchStore((state) => state.timeline);
  const addContext = useWorkbenchStore((state) => state.addContext);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [timeline.length]);

  return (
    <section className="panel timelinePanel">
      <div className="panelTitle">Agent Timeline <span className="muted">{timeline.length} events</span></div>
      <div className="timeline">
        {timeline.map((event) => {
          if (event.type === 'user_message') return <div className="event user" key={event.id}><User size={16} /><div><meta /><p>{event.content}</p><small><Clock size={11} /> {timeLabel(event.createdAt)}</small></div></div>;
          if (event.type === 'assistant_message') return <div className="event assistant" key={event.id}><Bot size={16} /><div><p>{event.content}</p><small><Clock size={11} /> {timeLabel(event.createdAt)}</small></div></div>;
          if (event.type === 'approval_request') return <div className="event approval" key={event.id}><ShieldAlert size={16} /><div><p>{event.reason}</p>{event.command && <pre>{event.command}</pre>}<small><Clock size={11} /> {timeLabel(event.createdAt)}</small></div></div>;
          if (event.type === 'tool_call') return (
            <div className="event tool" key={event.id}>
              {event.status === 'running' ? <Loader2 className="spin" size={16} /> : event.status === 'success' ? <CheckCircle2 size={16} /> : event.status === 'error' ? <CircleAlert size={16} /> : <Wrench size={16} />}
              <details open={event.status === 'running' || event.status === 'error'}>
                <summary>{event.toolName} <span className={`badge ${event.status}`}>{event.status}</span></summary>
                <pre>{JSON.stringify(event.input, null, 2)}</pre>
                <small><Clock size={11} /> {timeLabel(event.createdAt)}</small>
              </details>
            </div>
          );
          if (event.type === 'tool_result') return (
            <div className="event result" key={event.id}>
              <ChevronRight size={16} />
              <details>
                <summary>{event.toolName} result <button onClick={() => addContext({ type: 'note', title: `${event.toolName} result`, content: JSON.stringify(event.output, null, 2) })}>Pin</button></summary>
                <pre>{JSON.stringify(event.output, null, 2)}</pre>
                <small><Clock size={11} /> {timeLabel(event.createdAt)}</small>
              </details>
            </div>
          );
          return null;
        })}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
