import { Bot, CheckCircle2, ChevronRight, CircleAlert, Clock, Loader2, ShieldAlert, User, Wrench } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import { approveAndContinue, denyAndContinue } from '../lib/agent';
import type { AppMessage } from '../types/workbench';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function renderContentWithCode(content: string) {
  const parts: React.ReactNode[] = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<p key={key++}>{content.slice(lastIndex, match.index)}</p>);
    }
    parts.push(<pre key={key++}><code>{match[2]}</code></pre>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<p key={key++}>{content.slice(lastIndex)}</p>);
  }

  return parts.length > 0 ? parts : <p>{content}</p>;
}

const MessageItem = memo(function MessageItem({ event }: { event: AppMessage }) {
  if (event.type === 'user_message') {
    return <div className="message user"><User size={16} /><div><p>{event.content}</p><small><Clock size={11} /> {timeLabel(event.createdAt)}</small></div></div>;
  }
  if (event.type === 'assistant_message') {
    return <div className="message assistant"><Bot size={16} /><div>{renderContentWithCode(event.content)}{event.streaming && <Loader2 className="spin inlineIcon" size={12} />}<small><Clock size={11} /> {timeLabel(event.createdAt)}</small></div></div>;
  }
  if (event.type === 'approval_request') {
    return (
      <div className="message approval">
        <ShieldAlert size={16} />
        <div>
          <p>{event.reason}</p>
          {event.command && <pre>{event.command}</pre>}
          <div className="approvalActions">
            <Button size="sm" onClick={() => approveAndContinue()}>Approve</Button>
            <Button size="sm" variant="destructive" onClick={() => denyAndContinue()}>Deny</Button>
          </div>
          <small><Clock size={11} /> {timeLabel(event.createdAt)}</small>
        </div>
      </div>
    );
  }
  if (event.type === 'tool_call') {
    return (
      <div className="message tool">
        {event.status === 'running' ? <Loader2 className="spin" size={16} /> : event.status === 'success' ? <CheckCircle2 size={16} /> : event.status === 'error' ? <CircleAlert size={16} /> : <Wrench size={16} />}
        <details open={event.status === 'running' || event.status === 'error'}>
          <summary>{event.toolName} <Badge className={event.status}>{event.status}</Badge></summary>
          <pre>{JSON.stringify(event.input, null, 2)}</pre>
          <small><Clock size={11} /> {timeLabel(event.createdAt)}</small>
        </details>
      </div>
    );
  }
  return (
    <div className="message result">
      <ChevronRight size={16} />
      <details>
        <summary>{event.toolName} result</summary>
        <pre>{JSON.stringify(event.output, null, 2)}</pre>
        <small><Clock size={11} /> {timeLabel(event.createdAt)}</small>
      </details>
    </div>
  );
});

export function MessageList() {
  const messages = useWorkbenchStore(
    (state) => state.sessions.find((s) => s.id === state.activeSessionId)?.messages ?? []
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  return (
    <section className="messagesSurface" aria-label="Messages">
      {messages.map((event) => (
        <MessageItem key={event.id} event={event} />
      ))}
      <div ref={bottomRef} />
    </section>
  );
}
