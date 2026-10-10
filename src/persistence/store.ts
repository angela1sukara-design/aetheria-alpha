import type { GameState } from '../core/types.ts';
import { SaveCodec } from './codec.ts';
import type { DecodeResult } from './codec.ts';
export interface SaveStore { write(slot: string, text: string): Promise<void>; read(slot: string): Promise<string | undefined> }
export class MemorySaveStore implements SaveStore {
  #data = new Map<string, string>();
  async write(slot: string, text: string): Promise<void> { this.#data.set(slot, text); }
  async read(slot: string): Promise<string | undefined> { return this.#data.get(slot); }
}
export class IndexedDBSaveStore implements SaveStore {
  #database: Promise<IDBDatabase>;
  constructor(factory: IDBFactory = indexedDB) {
    this.#database = new Promise((resolve, reject) => {
      const request = factory.open('aetheria-alpha-0.1', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('slots'); };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => reject(new Error('无法打开本地存档数据库。'));
      request.onblocked = () => reject(new Error('存档数据库被其他页面阻塞，请关闭旧标签页。'));
    });
  }
  async write(slot: string, text: string): Promise<void> {
    const db = await this.#database;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('slots', 'readwrite'); tx.objectStore('slots').put(text, slot);
      // request 成功不是事务成功；必须等事务 complete，配额/中断错误不能冒充“保存完成”。
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error('存档写入失败。')); tx.onabort = () => reject(new Error('存档写入被中止。'));
    });
  }
  async read(slot: string): Promise<string | undefined> {
    const db = await this.#database;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('slots', 'readonly'); const request = tx.objectStore('slots').get(slot);
      let value: string | undefined;
      request.onsuccess = () => { if (request.result === undefined || typeof request.result === 'string') value = request.result; else reject(new Error('存档记录已损坏。')); };
      tx.oncomplete = () => resolve(value); tx.onerror = () => reject(new Error('读取存档失败。')); tx.onabort = () => reject(new Error('读取存档被中止。'));
    });
  }
}
export class SaveRepository {
  readonly codec: SaveCodec; readonly store: SaveStore;
  constructor(codec: SaveCodec, store: SaveStore) { this.codec = codec; this.store = store; }
  async save(state: GameState, slot = 'manual'): Promise<void> { await this.store.write(slot, await this.codec.encode(state)); }
  async load(slot = 'manual'): Promise<DecodeResult | { status: 'empty' }> {
    const text = await this.store.read(slot); return text === undefined ? { status: 'empty' } : this.codec.decode(text);
  }
}
