import {
  Bot,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useWorkbenchStore } from "../stores/workbenchStore";
import { SettingsPanel } from "./SettingsPanel";
import { AlertDialog, Dialog, PromptDialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function SessionSidebar() {
  const sessions = useWorkbenchStore((state) => state.sessions);
  const activeSessionId = useWorkbenchStore((state) => state.activeSessionId);
  const isCollapsed = useWorkbenchStore(
    (state) => state.isSessionSidebarCollapsed,
  );
  const isBooted = useWorkbenchStore((state) => state.isBooted);
  const isBooting = useWorkbenchStore((state) => state.isBooting);
  const setCollapsed = useWorkbenchStore(
    (state) => state.setSessionSidebarCollapsed,
  );
  const createSession = useWorkbenchStore((state) => state.createSession);
  const setActiveSession = useWorkbenchStore((state) => state.setActiveSession);
  const renameSession = useWorkbenchStore((state) => state.renameSession);
  const deleteSession = useWorkbenchStore((state) => state.deleteSession);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renaming, setRenaming] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const sandboxStatus = isBooted ? "ready" : isBooting ? "booting" : "";
  const sandboxTooltip = isBooted
    ? "Connected"
    : isBooting
      ? "Connecting..."
      : "Not connected";

  return (
    <aside
      className={isCollapsed ? "sessionSidebar collapsed" : "sessionSidebar"}
    >
      <div
        className={isCollapsed ? "sessionHeader collapsed" : "sessionHeader"}
      >
        {!isCollapsed ? (
          <>
            <div className="brand">
              <Bot size={18} /> Pure Browser Agent
            </div>
            <div className="sessionHeaderActions">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`sandboxDot ${sandboxStatus}`} />
                </TooltipTrigger>
                <TooltipContent>{sandboxTooltip}</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="gearIcon"
                onClick={() => setSettingsOpen(true)}
                title="Settings"
              >
                <Settings size={16} />
              </Button>
            </div>
          </>
        ) : (
          <div className="sessionHeaderCollapsed">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!isCollapsed)}
              title="Expand sessions"
            >
              <PanelLeftOpen size={16} />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`sandboxDot ${sandboxStatus}`} />
              </TooltipTrigger>
              <TooltipContent>{sandboxTooltip}</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="gearIcon"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings size={16} />
            </Button>
          </div>
        )}
      </div>
      {!isCollapsed && (
        <div className="sessionToolbar">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!isCollapsed)}
            title="Collapse sessions"
          >
            <PanelLeftClose size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={createSession}>
            <Plus size={14} /> New
          </Button>
        </div>
      )}
      <div className="sessionList">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={
              session.id === activeSessionId
                ? "sessionRow active"
                : "sessionRow"
            }
          >
            <Button
              variant="ghost"
              className="sessionButton"
              onClick={() => setActiveSession(session.id)}
              title={session.title}
            >
              <MessageSquare size={15} />
              {!isCollapsed && <span>{session.title}</span>}
            </Button>
            {!isCollapsed && (
              <span className="sessionActions">
                <Button
                  variant="ghost"
                  size="icon"
                  className="sessionIcon"
                  onClick={() =>
                    setRenaming({ id: session.id, title: session.title })
                  }
                  title="Rename"
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sessionIcon danger"
                  onClick={() =>
                    setDeleting({ id: session.id, title: session.title })
                  }
                  title="Delete"
                >
                  <Trash2 size={13} />
                </Button>
              </span>
            )}
          </div>
        ))}
      </div>
      <Dialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Settings"
      >
        <SettingsPanel />
      </Dialog>
      <PromptDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        title="Rename session"
        defaultValue={renaming?.title ?? ""}
        onConfirm={(value) => {
          if (renaming) renameSession(renaming.id, value);
        }}
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete session"
        description={
          deleting
            ? `Delete "${deleting.title}"? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) deleteSession(deleting.id);
        }}
      />
    </aside>
  );
}
