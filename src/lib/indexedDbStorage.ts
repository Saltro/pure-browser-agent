import type { StateStorage } from 'zustand/middleware';

const STORE_NAME = 'keyval';

type RequestExecutor<T> = (store: IDBObjectStore) => IDBRequest<T>;

function canUseIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function canUseLocalStorage() {
  return typeof localStorage !== 'undefined';
}

function createAsyncLocalStorage(): StateStorage<Promise<void>> {
  return {
    getItem: async (key) => (canUseLocalStorage() ? localStorage.getItem(key) : null),
    setItem: async (key, value) => {
      if (canUseLocalStorage()) {
        localStorage.setItem(key, value);
      }
    },
    removeItem: async (key) => {
      if (canUseLocalStorage()) {
        localStorage.removeItem(key);
      }
    }
  };
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`IndexedDB database "${databaseName}" is blocked`));
  });
}

export function createIndexedDbStorage(name: string): StateStorage<Promise<void>> {
  if (!canUseIndexedDb()) {
    return createAsyncLocalStorage();
  }

  let databasePromise: Promise<IDBDatabase> | null = null;
  const getDatabase = () => {
    databasePromise ??= openDatabase(name).catch((error) => {
      databasePromise = null;
      throw error;
    });
    return databasePromise;
  };

  const run = async <T>(mode: IDBTransactionMode, execute: RequestExecutor<T>): Promise<T> => {
    const database = await getDatabase();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = execute(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  };

  return {
    getItem: async (key) => {
      try {
        return (await run('readonly', (store) => store.get(key))) ?? createAsyncLocalStorage().getItem(key);
      } catch {
        return createAsyncLocalStorage().getItem(key);
      }
    },
    setItem: async (key, value) => {
      try {
        await run('readwrite', (store) => store.put(value, key));
      } catch {
        await createAsyncLocalStorage().setItem(key, value);
      }
    },
    removeItem: async (key) => {
      try {
        await run('readwrite', (store) => store.delete(key));
      } catch {
        await createAsyncLocalStorage().removeItem(key);
      }
    }
  };
}
