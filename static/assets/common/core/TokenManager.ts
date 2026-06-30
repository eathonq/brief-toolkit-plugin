/**
 * TokenManager.ts - Token 持久化管理
 * @description 零依赖的 Token 存储与过期管理，基于 localStorage 实现全平台持久化
 *              （Cocos Creator 3.8.8 在所有构建目标均提供了 localStorage polyfill）。
 *
 *              自动处理 Bearer 前缀，模块加载时自动从 localStorage 恢复 token。
 *              默认过期时间 7 天。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-30
 */

/** localStorage 存储键 */
const STORAGE_KEY = 'brief_toolkit_token';

/** 默认过期天数 */
const DEFAULT_EXPIRE_DAYS = 7;

/** 内部存储结构 */
interface TokenStorage {
  token: string;
  expiresAt: number; // 时间戳（ms）
}

// ──────────── 模块级状态 ────────────

let _token: string = '';

/** 从 localStorage 读取存储对象 */
function _loadStorage(): TokenStorage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenStorage;
    if (!parsed.token || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 写入 localStorage */
function _saveStorage(storage: TokenStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (e) {
    console.error('[TokenManager] localStorage 写入失败:', e);
  }
}

/** 清除 localStorage */
function _clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ──────────── 实现 ────────────

/**
 * Token 管理器（全静态方法）
 *
 * 使用示例：
 *   TokenManager.token = 'my-jwt-token';           // 自动加 Bearer 前缀并持久化
 *   const t = TokenManager.token;                   // 获取 token（含过期检查）
 *   const bearer = TokenManager.bearerToken;        // 带 Bearer 前缀
 *   TokenManager.removeToken();                     // 清除
 */
export class TokenManager {
  private constructor() { }

  // ────── Token 读写 ──────

  /** 获取/设置 token（原始值，不含 Bearer 前缀） */
  static get token(): string {
    // 读取时检查过期
    if (_token) return _token;
    const storage = _loadStorage();
    if (!storage) return '';

    // 检查是否过期
    if (Date.now() > storage.expiresAt) {
      _clearStorage();
      return '';
    }

    _token = storage.token;
    return _token;
  }

  static set token(newToken: string) {
    TokenManager.setToken(newToken, DEFAULT_EXPIRE_DAYS, true);
  }

  /**
   * 设置 token
   * @param newToken   新 token 值
   * @param expires    过期时间（天），默认 7 天；传入 0 表示不过期
   * @param saveStorage 是否持久化到 localStorage，默认 true
   */
  static setToken(newToken: string, expires: number = DEFAULT_EXPIRE_DAYS, saveStorage: boolean = true): void {
    const trimmed = (newToken || '').trim();
    _token = trimmed;

    if (saveStorage) {
      if (trimmed) {
        const expiresAt = expires > 0
          ? Date.now() + expires * 24 * 60 * 60 * 1000
          : Number.MAX_SAFE_INTEGER;
        _saveStorage({ token: trimmed, expiresAt });
      } else {
        _clearStorage();
      }
    }
  }

  /** 获取带 Bearer 前缀的 token（用于 Authorization header） */
  static get bearerToken(): string {
    const t = TokenManager.token;
    if (!t) return '';
    if (t.startsWith('Bearer ')) return t;
    return `Bearer ${t}`;
  }

  // ────── 状态查询 ──────

  /** Token 是否存在且未过期 */
  static get isTokenValid(): boolean {
    return TokenManager.token !== '';
  }

  // ────── 清除 ──────

  /** 移除 token（内存 + localStorage） */
  static removeToken(): void {
    _token = '';
    _clearStorage();
  }
}

// ──────────── 模块加载时自动恢复 ────────────

const stored = _loadStorage();
if (stored && stored.token && Date.now() <= stored.expiresAt) {
  _token = stored.token;
}
