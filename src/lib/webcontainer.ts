import { WebContainer, type FileSystemTree } from '@webcontainer/api';
import type { FileNode } from '../types/workbench';

let instance: WebContainer | null = null;
let booting: Promise<WebContainer> | null = null;

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
    booting ||= WebContainer.boot();
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

export async function syncFilesToContainer(files: FileNode[]) {
  getWebContainer();
  for (const file of files) await writeContainerFile(file.path, file.content);
}

export async function runContainerCommand(command: string, onData: (chunk: string) => void) {
  const wc = getWebContainer();
  const process = await wc.spawn('jsh', ['-c', command]);
  const outputDone = process.output.pipeTo(
    new WritableStream({
      write(data) {
        onData(String(data));
      }
    })
  );
  const exitCode = await process.exit;
  await outputDone.catch(() => undefined);
  return exitCode;
}
