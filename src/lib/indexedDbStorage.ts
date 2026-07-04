import type { StateStorage } from 'zustand/middleware';

const STORE_NAME = 'keyval';

type RequestExecutor<T> = (store: IDBObjectStore) => IDBRequest<T>;

function canUseIndexedDb() {
  return typeof indexedDB !== 'undefined';
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
    return {
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined
    };
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
      return (await run('readonly', (store) => store.get(key))) ?? null;
    },
    setItem: async (key, value) => {
      await run('readwrite', (store) => store.put(value, key));
    },
    removeItem: async (key) => {
      await run('readwrite', (store) => store.delete(key));
    }
  };
}
