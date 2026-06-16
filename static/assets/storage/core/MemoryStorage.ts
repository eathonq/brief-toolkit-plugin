/**
 * MemoryStorage.ts - 内存存储实现
 * @description 纯内存的 IStorageBackend 实现，作为 localStorage 不可用时的 fallback。
 *              数据不持久化，进程重启后丢失。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-16
 */

import { IStorageBackend } from "./IStorage";

/** 内存存储（作为 localStorage 不可用时的 fallback） */
export class MemoryStorage implements IStorageBackend {
  private _data = new Map<string, string>();

  getItem(key: string): string | null {
    return this._data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this._data.set(key, value);
  }

  removeItem(key: string): void {
    this._data.delete(key);
  }

  keys(): string[] {
    return Array.from(this._data.keys());
  }

  clear(): void {
    this._data.clear();
  }
}
