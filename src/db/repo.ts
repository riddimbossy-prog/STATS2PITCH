import { Platform } from 'react-native';
import type { ListEntry, Slip, TrackedPick } from '../domain';
import type { CacheRow, CacheStore } from '../data/sportybet';

export interface Repo {
  kind: 'sqlite' | 'document';
  lists(): Promise<ListEntry[]>;
  saveList(entry: ListEntry): Promise<void>;
  removeList(id: string): Promise<void>;
  replaceLists(entries: ListEntry[]): Promise<void>;
  tracked(): Promise<TrackedPick[]>;
  saveTracked(row: TrackedPick): Promise<void>;
  slips(): Promise<Slip[]>;
  saveSlip(slip: Slip): Promise<void>;
  hasNotice(key: string): Promise<boolean>;
  saveNotice(notice: { key: string; title: string; body: string }): Promise<void>;
  cacheGet(key: string): Promise<CacheRow | null>;
  cacheSet(key: string, payload: string, ttlMs: number, fetchedAt: number): Promise<void>;
}

const DOC_KEY = 'stats2pitch.v1';

interface NoticeRow {
  key: string;
  title: string;
  body: string;
  createdAt: number;
}

interface Doc {
  lists: ListEntry[];
  tracked: TrackedPick[];
  slips: Slip[];
  notices: NoticeRow[];
  cache: Record<string, CacheRow>;
}

let memoryDoc: Doc | null = null;
let repoPromise: Promise<Repo> | null = null;

function emptyDoc(): Doc {
  return { lists: [], tracked: [], slips: [], notices: [], cache: {} };
}

function readDoc(): Doc {
  if (typeof localStorage === 'undefined') {
    memoryDoc = memoryDoc ?? emptyDoc();
    return memoryDoc;
  }
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (!raw) return emptyDoc();
    return { ...emptyDoc(), ...(JSON.parse(raw) as Partial<Doc>) };
  } catch {
    return emptyDoc();
  }
}

function writeDoc(doc: Doc): void {
  memoryDoc = doc;
  if (typeof localStorage !== 'undefined') localStorage.setItem(DOC_KEY, JSON.stringify(doc));
}

function documentRepo(): Repo {
  return {
    kind: 'document',
    async lists() {
      return readDoc().lists;
    },
    async saveList(entry) {
      const doc = readDoc();
      writeDoc({ ...doc, lists: [...doc.lists.filter((item) => item.id !== entry.id), entry] });
    },
    async removeList(id) {
      const doc = readDoc();
      writeDoc({ ...doc, lists: doc.lists.filter((item) => item.id !== id) });
    },
    async replaceLists(entries) {
      writeDoc({ ...readDoc(), lists: entries });
    },
    async tracked() {
      return readDoc().tracked;
    },
    async saveTracked(row) {
      const doc = readDoc();
      writeDoc({ ...doc, tracked: [...doc.tracked.filter((item) => item.id !== row.id), row] });
    },
    async slips() {
      return readDoc().slips;
    },
    async saveSlip(slip) {
      const doc = readDoc();
      writeDoc({ ...doc, slips: [...doc.slips.filter((item) => item.id !== slip.id), slip] });
    },
    async hasNotice(key) {
      return readDoc().notices.some((notice) => notice.key === key);
    },
    async saveNotice(notice) {
      const doc = readDoc();
      if (doc.notices.some((item) => item.key === notice.key)) return;
      writeDoc({ ...doc, notices: [...doc.notices, { ...notice, createdAt: Date.now() }] });
    },
    async cacheGet(key) {
      return readDoc().cache[key] ?? null;
    },
    async cacheSet(key, payload, ttlMs, fetchedAt) {
      const doc = readDoc();
      writeDoc({ ...doc, cache: { ...doc.cache, [key]: { payload, ttlMs, fetchedAt } } });
    },
  };
}

async function sqliteRepo(): Promise<Repo> {
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync('stats2pitch.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS lists (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tracked (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS slips (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notices (key TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS http_cache (key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL, ttl_ms INTEGER NOT NULL);
  `);

  async function all<T>(sql: string): Promise<T[]> {
    return db.getAllAsync<T>(sql);
  }

  return {
    kind: 'sqlite',
    async lists() {
      const rows = await all<{ payload: string }>('SELECT payload FROM lists');
      return rows.map((row) => JSON.parse(row.payload) as ListEntry);
    },
    async saveList(entry) {
      await db.runAsync('INSERT OR REPLACE INTO lists (id, payload) VALUES (?, ?)', entry.id, JSON.stringify(entry));
    },
    async removeList(id) {
      await db.runAsync('DELETE FROM lists WHERE id = ?', id);
    },
    async replaceLists(entries) {
      const current = await db.getAllAsync<{ id: string; payload: string }>('SELECT id, payload FROM lists');
      for (const entry of current) {
        if (!entries.some((item) => item.id === entry.id)) await db.runAsync('DELETE FROM lists WHERE id = ?', entry.id);
      }
      for (const entry of entries) {
        await db.runAsync('INSERT OR REPLACE INTO lists (id, payload) VALUES (?, ?)', entry.id, JSON.stringify(entry));
      }
    },
    async tracked() {
      const rows = await all<{ payload: string }>('SELECT payload FROM tracked');
      return rows.map((row) => JSON.parse(row.payload) as TrackedPick);
    },
    async saveTracked(row) {
      await db.runAsync('INSERT OR REPLACE INTO tracked (id, payload) VALUES (?, ?)', row.id, JSON.stringify(row));
    },
    async slips() {
      const rows = await all<{ payload: string }>('SELECT payload FROM slips');
      return rows.map((row) => JSON.parse(row.payload) as Slip);
    },
    async saveSlip(slip) {
      await db.runAsync('INSERT OR REPLACE INTO slips (id, payload) VALUES (?, ?)', slip.id, JSON.stringify(slip));
    },
    async hasNotice(key) {
      const rows = await db.getAllAsync<{ key: string }>('SELECT key FROM notices WHERE key = ?', key);
      return rows.length > 0;
    },
    async saveNotice(notice) {
      await db.runAsync(
        'INSERT OR IGNORE INTO notices (key, title, body, created_at) VALUES (?, ?, ?, ?)',
        notice.key,
        notice.title,
        notice.body,
        Date.now(),
      );
    },
    async cacheGet(key) {
      const rows = await db.getAllAsync<CacheRow & { key: string }>(
        'SELECT payload, fetched_at as fetchedAt, ttl_ms as ttlMs FROM http_cache WHERE key = ?',
        key,
      );
      return rows[0] ?? null;
    },
    async cacheSet(key, payload, ttlMs, fetchedAt) {
      await db.runAsync(
        'INSERT OR REPLACE INTO http_cache (key, payload, fetched_at, ttl_ms) VALUES (?, ?, ?, ?)',
        key,
        payload,
        fetchedAt,
        ttlMs,
      );
    },
  };
}

export function getRepo(): Promise<Repo> {
  if (!repoPromise) {
    // The web bundle cannot load the SQLite wasm worker. Phones use SQLite.
    repoPromise = Platform.OS === 'web' ? Promise.resolve(documentRepo()) : sqliteRepo().catch(() => documentRepo());
  }
  return repoPromise;
}

export function cacheFromRepo(repo: Repo): CacheStore {
  return {
    get: (key) => repo.cacheGet(key),
    set: (key, payload, ttlMs, fetchedAt) => repo.cacheSet(key, payload, ttlMs, fetchedAt),
  };
}
