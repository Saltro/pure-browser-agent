import { WebContainer, type FileSystemTree } from '@webcontainer/api';
import type { FileNode } from '../types/workbench';

let instance: WebContainer | null = null;
let booting: Promise<WebContainer> | null = null;

const dirtyPaths = new Set<string>();

export function markDirty(path: string) {
  dirtyPaths.add(path);
}

function insertFile(tree: FileSystemTree, path: string, content: string) {
  const parts = path.split('/').filter(Boolean);
  let cursor = tree;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === parts.length - 1) {
      cursor[part] = { file: { contents: content } };
    } else {
      if (!cursor[part]) cursor[part] = { directory: {} };
      const node = cursor[part];
      if ('directory' in node) cursor = node.directory;
    }
  }
}

export function filesToTree(files: FileNode[]): FileSystemTree {
  const tree: FileSystemTree = {};
  files.forEach((file) => insertFile(tree, file.path, file.content));
  return tree;
}

export async function bootWebContainer(files: FileNode[]) {
  if (!instance) {
    if (!booting) {
      booting = WebContainer.boot().catch((err) => {
        booting = null;
        throw err;
      });
    }
    instance = await booting;
  }
  await instance.mount(filesToTree(files));
  return instance;
}

export function isWebContainerBooted() {
  return Boolean(instance);
}

export function getWebContainer() {
  if (!instance) throw new Error('WebContainer is not booted yet. Click “Boot WebContainer” first.');
  return instance;
}

export async function writeContainerFile(path: string, content: string) {
  const wc = getWebContainer();
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) await wc.fs.mkdir(dir, { recursive: true });
  await wc.fs.writeFile(path, content);
}

export async function deleteContainerFile(path: string) {
  const wc = getWebContainer();
  await wc.fs.rm(path, { force: true, recursive: true });
}

export async function readContainerFile(path: string) {
  const wc = getWebContainer();
  return await wc.fs.readFile(path, 'utf-8');
}

export async function syncFilesToContainer(files: FileNode[], force = false) {
  getWebContainer();
  const toSync = force ? files : files.filter((f) => dirtyPaths.has(f.path));
  for (const file of toSync) {
    await writeContainerFile(file.path, file.content);
    dirtyPaths.delete(file.path);
  }
  return toSync.length;
}

export async function syncAllFilesToContainer(files: FileNode[]) {
  return syncFilesToContainer(files, true);
}

export async function runContainerCommand(command: string, onData: (chunk: string) => void, signal?: AbortSignal) {
  const wc = getWebContainer();
  const process = await wc.spawn('jsh', ['-c', command]);
  let aborted = false;
  const abort = () => {
    aborted = true;
    process.kill();
  };
  signal?.addEventListener('abort', abort, { once: true });
  const outputDone = process.output.pipeTo(
    new WritableStream({
      write(data) {
        onData(String(data));
      }
    })
  );
  const exitCode = await process.exit;
  signal?.removeEventListener('abort', abort);
  await outputDone.catch(() => undefined);
  if (aborted) throw new DOMException('Command interrupted', 'AbortError');
  return exitCode;
}
