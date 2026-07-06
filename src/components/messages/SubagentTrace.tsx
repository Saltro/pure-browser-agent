import {
  Bot,
  ChevronRight,
  CircleAlert,
  CircleStop,
  Loader2,
  MessageSquare,
  User,
  Wrench,
} from "lucide-react";
import type { AppMessage, SubagentStatus } from "../../types/workbench";
import { Markdown } from "../Markdown";
import { Badge } from "../ui/badge";

type SubagentTraceMessage = Extract<AppMessage, { type: "subagent_trace" }>;

type SubagentTraceProps = {
  event: SubagentTraceMessage;
};

const HIDDEN_TOOLS = new Set([
  "boot_webcontainer",
  "server-ready",
  "sync_file",
  "sync_workspace",
]);

function statusVariant(
  status: SubagentStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "secondary";
  if (status === "error") return "destructive";
  if (status === "interrupted") return "outline";
  return "default";
}

function summarizeMessage(message: AppMessage) {
  switch (message.type) {
    case "user_message":
      return { icon: User, label: "User", text: message.content };
    case "assistant_message":
      return {
        icon: Bot,
        label: "Assistant",
        text:
          message.content ||
          (message.streaming ? "Streaming..." : "No content"),
      };
    case "tool_call":
      return {
        icon: Wrench,
        label: `Tool - ${message.toolName}`,
        text: message.status,
      };
    case "tool_result":
      return {
        icon: ChevronRight,
        label: `Tool result - ${message.toolName}`,
        text: JSON.stringify(message.output),
      };
    case "approval_request":
      return { icon: CircleAlert, label: "Approval", text: message.reason };
    case "question_request":
      return {
        icon: MessageSquare,
        label: "Question",
        text: message.questions.map((question) => question.title).join(" · "),
      };
    case "question_answer":
      return {
        icon: MessageSquare,
        label: "Answer",
        text: `${message.answers.length} answer${message.answers.length === 1 ? "" : "s"}`,
      };
    case "subagent_trace":
      return { icon: Bot, label: "Subagent", text: message.title };
  }
}

function compactText(text: string, maxLength = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
}

export function SubagentTrace({ event }: SubagentTraceProps) {
  const visibleMessages = event.messages.filter((message) => {
    if (message.type === "tool_call" || message.type === "tool_result") {
      return !HIDDEN_TOOLS.has(message.toolName);
    }
    return true;
  });

  return (
    <div className="subagentTrace">
      <div className="subagentRail">
        {event.status === "running" ? (
          <Loader2 className="spin" size={16} />
        ) : (
          <CircleStop size={16} />
        )}
      </div>
      <div className="subagentBody">
        <div className="subagentHeader">
          <div>
            <strong>{event.title}</strong>
            <small>{event.subagentSessionId}</small>
          </div>
          <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
        </div>
        {event.finalAnswer && (
          <blockquote className="subagentFinal">
            <Markdown
              content={event.finalAnswer}
              className="markdown-body compact"
            />
          </blockquote>
        )}
        {visibleMessages.length > 0 && (
          <details className="subagentDetails">
            <summary>
              {visibleMessages.length} trace message
              {visibleMessages.length === 1 ? "" : "s"}
            </summary>
            <div className="subagentMessages">
              {visibleMessages.map((message) => {
                const summary = summarizeMessage(message);
                const Icon = summary.icon;
                return (
                  <div key={message.id} className="subagentMessage">
                    <Icon size={13} className="mt-[3px]" />
                    <span>{summary.label}</span>
                    <p>{compactText(summary.text)}</p>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
