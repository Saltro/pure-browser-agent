import Dexie, { type Table } from 'dexie';
import type { ContextItem, FileNode } from '../types/workbench';

export type WorkspaceSnapshot = {
  id: string;
  name: string;
  files: FileNode[];
  contextItems: ContextItem[];
  savedAt: number;
};

class WorkbenchDb extends Dexie {
  snapshots!: Table<WorkspaceSnapshot, string>;

  constructor() {
    super('agent-sandbox-studio');
    this.version(1).stores({
      snapshots: 'id, name, savedAt'
    });
  }
}

export const db = new WorkbenchDb();

const defaultSnapshotId = 'default-workspace';

export async function saveDefaultSnapshot(snapshot: Omit<WorkspaceSnapshot, 'id' | 'savedAt'>) {
  const saved: WorkspaceSnapshot = { ...snapshot, id: defaultSnapshotId, savedAt: Date.now() };
  await db.snapshots.put(saved);
  return saved;
}

export async function loadDefaultSnapshot() {
  return await db.snapshots.get(defaultSnapshotId);
}
