import { openDB, type IDBPDatabase } from 'idb'

export type ChatItem = { roomId: string; t: number; playerId?: string; name?: string; color?: string; text: string; kind?: 'system' | 'chat' }

const DB_NAME = 'mpg-chat'
const STORE = 'messages'
let dbPromise: Promise<IDBPDatabase<any>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: ['roomId', 't', 'playerId'] })
          store.createIndex('byRoom', 'roomId')
        }
      },
    })
  }
  return dbPromise
}

export async function idbPutMany(items: ChatItem[]) {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  for (const it of items) await store.put(it)
  await tx.done
}

export async function idbGetRoom(roomId: string, limit = 200): Promise<ChatItem[]> {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readonly')
  const idx = tx.objectStore(STORE).index('byRoom')
  const all: ChatItem[] = []
  let cursor = await idx.openCursor(roomId)
  while (cursor) {
    all.push(cursor.value as ChatItem)
    cursor = await cursor.continue()
  }
  all.sort((a, b) => a.t - b.t)
  return all.slice(-limit)
}

export async function idbClearRoom(roomId: string) {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  const idx = tx.objectStore(STORE).index('byRoom')
  let cursor = await idx.openCursor(roomId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}
