/**
 * AssetScope.ts - 资源作用域
 * @description 按实例追踪资源路径，支持统一释放。
 *              每个场景/模块创建一个独立的 AssetScope 实例，通过 scope 加载的资源
 *              由 scope.releaseAll() 统一释放，不依赖组件的 onDestroy 逐个清理。
 *
 * ## 跨 Scope 共享
 *   依赖 Cocos AssetManager 自带 ref-count：
 *     bundle.load() → refCount++,  bundle.release() → refCount--,
 *     refCount 归零时引擎自动释放纹理。
 *   两个 Scope 各自加载同一 path 时各贡献 1 个 refCount，互不感知却正确协作。
 *
 * ## 生命周期
 *   const scope = new AssetScope('battle');
 *   const sf = await scope.getSpriteFrame(path);  // 加载并自动追踪
 *   scope.track(path);                             // 手动追踪外部加载的资源
 *   scope.releaseAll();                            // 统一释放，零泄漏
 *
 * ## 预加载
 *   AssetScope 不做逐资源预加载。批量预加载请使用 Cocos Creator 原生 API：
 *     resources.preloadDir('textures/ui', SpriteFrame, onProgress, onComplete);
 *   预加载后 scope.getSpriteFrame() 命中引擎缓存，零 IO。
 *
 * @author eathonq
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-06-19
 */

import { SpriteFrame, JsonAsset, Prefab, AudioClip } from 'cc';
import { CCAssets } from './CCAssets';

/** 资源作用域 */
export class AssetScope {
  /** 作用域名（调试用） */
  private _name: string;

  /** 本 Scope 追踪的所有资源路径（供 releaseAll 使用） */
  private _paths = new Set<string>();

  constructor(name: string) {
    this._name = name;
  }

  /** 作用域名 */
  get name(): string { return this._name; }

  /** 已追踪的资源路径数量 */
  get pathCount(): number { return this._paths.size; }

  // ────────── 加载 / 追踪 ──────────

  /**
   * 获取 SpriteFrame（异步），加载成功后自动追踪路径。
   * 路径命中 Cocos 引擎缓存时无 IO 开销。
   *
   * @param path 资源路径（完整 db:// 格式）
   */
  async getSpriteFrame(path: string): Promise<SpriteFrame | null> {
    const sf = await CCAssets.getSpriteFrame(path);
    if (sf) {
      this._paths.add(path);
    }
    return sf;
  }

  /**
   * 获取 JsonAsset（异步），加载成功后自动追踪路径。
   * 切换 scope 时由 releaseAll() 统一释放，无需手动 releaseAsset。
   *
   * @param path 资源路径
   * @param bundleName 可选 bundle 名
   */
  async getJsonAsset(path: string, bundleName?: string): Promise<JsonAsset | null> {
    const asset = await CCAssets.getJsonAsset(path, bundleName);
    if (asset) {
      const trackPath = bundleName ? `db://${bundleName}/${path}` : path;
      this._paths.add(trackPath);
    }
    return asset;
  }

  /**
   * 获取 Prefab（异步），加载成功后自动追踪路径。
   * @param path 预制体路径（完整 db:// 格式）
   */
  async getPrefab(path: string): Promise<Prefab | null> {
    const prefab = await CCAssets.getPrefab(path);
    if (prefab) {
      this._paths.add(path);
    }
    return prefab;
  }

  /**
   * 获取 AudioClip（异步），加载成功后自动追踪路径。
   * @param path 音频路径（完整 db:// 格式）
   */
  async getAudioClip(path: string): Promise<AudioClip | null> {
    const clip = await CCAssets.getAudioClip(path);
    if (clip) {
      this._paths.add(path);
    }
    return clip;
  }

  /**
   * 手动追踪外部加载的资源路径。
   * 用于已在别处通过 CCAssets 加载、但需要纳入本 Scope 统一释放的资源。
   *
   * @param path 资源路径
   */
  track(path: string): void {
    this._paths.add(path);
  }

  // ────────── 释放 ──────────

  /**
   * 释放本 Scope 追踪的所有资源。
   * 对每个 path 调用 CCAssets.releasePath() → bundle.release()，
   * Cocos AssetManager refCount--，归零时引擎自动释放纹理。
   *
   * 释放后清空内部追踪（重复调用安全）。
   */
  releaseAll(): void {
    for (const path of this._paths) {
      CCAssets.releasePath(path);
    }
    this._paths.clear();
  }

  // ────────── 调试 ──────────

  /**
   * 返回调试信息快照。
   */
  debug(): { name: string; pathCount: number; paths: string[] } {
    return {
      name: this._name,
      pathCount: this._paths.size,
      paths: [...this._paths].sort(),
    };
  }
}
