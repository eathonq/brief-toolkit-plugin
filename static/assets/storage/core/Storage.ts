/**
 * Storage.ts - 本地存储模块
 * @description 在 sys.localStorage 之上封装 JSON 序列化、默认值回退、错误降级。
 *              纯 TS 实现，不依赖 Cocos Creator。后端可注入替换。
 *
 *              定位：薄封装，不包含加密/事务/版本迁移等高级功能。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-16
 */

import { IStorageBackend } from "./IStorage";
import { MemoryStorage } from "./MemoryStorage";

/**
 * 尝试从运行环境获取 localStorage 后端。
 * 若不可用（如某些小游戏环境），降级为内存存储。
 */
function resolveDefaultBackend(): IStorageBackend {
  try {
    const testKey = '__brief_storage_test__';
    const ls = (typeof globalThis !== 'undefined' ? globalThis : window) as any;
    const backend = ls.localStorage ?? ls.sys?.localStorage;
    if (backend && typeof backend.getItem === 'function') {
      backend.setItem(testKey, '1');
      backend.removeItem(testKey);
      return backend as IStorageBackend;
    }
  } catch { /* 静默降级 */ }
  return new MemoryStorage();
}

let _backend: IStorageBackend = resolveDefaultBackend();
/** 后端不可用时是否自动降级为内存存储 */
let _allowFallback = true;

/**
 * 本地存储静态门面
 *
 * 在 sys.localStorage 之上提供：
 * - 自动 JSON 序列化/反序列化
 * - 类型安全的默认值回退
 * - 存储不可用时的内存降级
 * - 可注入的后端接口
 *
 * @example
 * ```ts
 * import { Storage } from 'db://assets/brief-toolkit/storage/pure';
 *
 * // 写入（自动 JSON.stringify）
 * Storage.set('user.profile', { name: 'Player1', level: 5 });
 *
 * // 读取（自动 JSON.parse + 默认值回退）
 * const profile = Storage.get<UserProfile>('user.profile');
 * const volume = Storage.get('settings.volume', 0.8);
 *
 * // 注入自定义后端
 * Storage.setBackend(myCloudStorage);
 * ```
 */
export class Storage {
  private constructor() { }

  // ── 后端管理 ──

  /**
   * 注入自定义存储后端。
   * 调用后所有读写操作走新后端，原后端数据不会自动迁移。
   */
  static setBackend(backend: IStorageBackend): void {
    _backend = backend;
  }

  /** 获取当前后端 */
  static getBackend(): IStorageBackend {
    return _backend;
  }

  /**
   * 设置后端不可用时是否自动降级为内存存储（默认 true）。
   * 设为 false 时，后端抛异常会向上传播。
   */
  static set allowFallback(value: boolean) {
    _allowFallback = value;
  }

  // ── 读写操作 ──

  /**
   * 写入值（自动 JSON.stringify）。
   * 后端写入失败时静默忽略（不抛异常）。
   */
  static set(key: string, value: unknown): void {
    try {
      _backend.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (!_allowFallback) throw e;
      console.warn(`[Storage] 写入 "${key}" 失败，已忽略:`, e);
    }
  }

  /**
   * 读取并自动 JSON.parse。
   * @param key          存储 key
   * @param defaultValue key 不存在或解析失败时的默认值
   */
  static get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    try {
      const raw = _backend.getItem(key);
      if (raw === null || raw === undefined) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (e) {
      if (!_allowFallback) throw e;
      return defaultValue;
    }
  }

  /**
   * 检查 key 是否存在
   */
  static has(key: string): boolean {
    try {
      return _backend.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  /**
   * 删除 key
   */
  static remove(key: string): void {
    try {
      _backend.removeItem(key);
    } catch (e) {
      if (!_allowFallback) throw e;
    }
  }

  /**
   * 获取所有 key。
   * 后端不支持 keys() 时返回空数组。
   */
  static keys(): string[] {
    try {
      return _backend.keys?.() ?? [];
    } catch {
      return [];
    }
  }

  /**
   * 清空所有数据。
   * 后端不支持 clear() 时逐个删除。
   */
  static clear(): void {
    try {
      if (_backend.clear) {
        _backend.clear();
      } else {
        for (const key of this.keys()) {
          _backend.removeItem(key);
        }
      }
    } catch (e) {
      if (!_allowFallback) throw e;
      console.warn('[Storage] clear 失败:', e);
    }
  }
}
