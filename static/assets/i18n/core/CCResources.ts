/**
 * CCResources.ts - 资源加载工具类
 * @description 该类提供资源加载相关的功能，支持本地和远程资源的加载。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-16
 * @modified 2026-03-15
 */

import { AssetManager, SpriteFrame, Texture2D, assetManager, resources, ImageAsset, JsonAsset, Asset, TextAsset } from "cc";

const _res_ = 'resources';
export type SpriteLoadFormate = "spriteFrame" | "texture";

/**
 * 资源加载工具类
 * @info 本地地址支持 bundle 资源，格式：'images/goods/i_1_1:game'，game 为 bundle 名称；
 */
export class CCResources {
  private static _currentBundle: string = _res_;
  private static _bundleMap: Map<string, AssetManager.Bundle> = new Map<string, AssetManager.Bundle>([
    [_res_, resources]
  ]);
  private static _bundleLoadingMap: Map<string, Promise<AssetManager.Bundle | null>> = new Map<string, Promise<AssetManager.Bundle | null>>();

  private static loadAsset<T extends Asset>(bundle: AssetManager.Bundle, path: string, type: new (...args: any[]) => T): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      bundle.load(path, type, (err: any, asset: T) => {
        if (err || !asset) {
          resolve(null);
          return;
        }
        resolve(asset);
      });
    });
  }

  /** 规范化资源路径（用于 resources/bundle.load） */
  private static normalizeAssetPath(path: string): string {
    let normalized = (path ?? "").trim();
    if (!normalized) return "";

    normalized = normalized.replace(/\\/g, "/");

    if (normalized.startsWith("assets/resources/")) {
      normalized = normalized.slice("assets/resources/".length);
    } else if (normalized.startsWith("resources/")) {
      normalized = normalized.slice("resources/".length);
    }

    // 去掉常见图片扩展名，保持与 Cocos 资源路径风格一致
    normalized = normalized.replace(/\.(png|jpg|jpeg|webp)$/i, "");

    // 若外部已传入子资源路径，则回退到主资源路径
    normalized = normalized.replace(/\/(spriteFrame|texture)$/i, "");

    return normalized;
  }

  private static loadBundle(bundle: string, url?: string, version?: string): Promise<AssetManager.Bundle | null> {
    const loaded = this._bundleMap.get(bundle);
    if (loaded) {
      return Promise.resolve(loaded);
    }

    const loading = this._bundleLoadingMap.get(bundle);
    if (loading) {
      return loading;
    }

    const promise = new Promise<AssetManager.Bundle | null>((resolve) => {
      const option = version ? { version } : undefined;
      assetManager.loadBundle(url ?? bundle, option, (err, _bundle) => {
        this._bundleLoadingMap.delete(bundle);
        if (err || !_bundle) {
          console.warn("[CCResourcesSprite] loadBundle failed:", bundle, err);
          resolve(null);
          return;
        }
        this._bundleMap.set(bundle, _bundle);
        resolve(_bundle);
      });
    });

    this._bundleLoadingMap.set(bundle, promise);
    return promise;
  }

  private static parsePath(path: string): { path: string, bundle?: string, isRemote: boolean } {
    const raw = (path ?? "").trim();
    if (!raw) {
      return { path: "", isRemote: false };
    }

    if (/^https?:\/\//i.test(raw)) {
      return { path: raw, isRemote: true };
    }

    if (raw.startsWith("db://")) {
      const inner = raw.slice(5);
      if (inner.startsWith("assets/resources/")) {
        return {
          bundle: _res_,
          path: this.normalizeAssetPath(inner),
          isRemote: false
        };
      }
      const firstSlash = inner.indexOf("/");
      if (firstSlash <= 0) {
        return { path: "", isRemote: false };
      }
      return {
        bundle: inner.slice(0, firstSlash),
        path: this.normalizeAssetPath(inner.slice(firstSlash + 1)),
        isRemote: false
      };
    }

    // 支持 path:bundle 语法，和工具类注释保持一致
    const bundleSplitIndex = raw.lastIndexOf(":");
    if (bundleSplitIndex > 0 && raw.indexOf("/") >= 0 && raw.indexOf("\\") < 0) {
      const candidatePath = raw.slice(0, bundleSplitIndex).trim();
      const candidateBundle = raw.slice(bundleSplitIndex + 1).trim();
      if (candidatePath && candidateBundle) {
        return {
          path: this.normalizeAssetPath(candidatePath),
          bundle: candidateBundle,
          isRemote: false
        };
      }
    }

    return { path: this.normalizeAssetPath(raw), isRemote: false };
  }

  private static async loadSpriteFrame(path: string, bundle?: string, formate: SpriteLoadFormate = "spriteFrame"): Promise<SpriteFrame | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundle ?? this._currentBundle);
    if (!res) return Promise.resolve(null);

    if (formate == "spriteFrame") {
      return this.loadAsset(res, `${path}/spriteFrame`, SpriteFrame);
    }
    else if (formate == "texture") {
      const textureFromSubAsset = await this.loadAsset(res, `${path}/texture`, Texture2D);
      if (textureFromSubAsset) {
        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = textureFromSubAsset;
        return spriteFrame;
      }

      return Promise.resolve(null);
    }

    return Promise.resolve(null);
  }

  static async loadSpriteFrameByUuid(uuid: string): Promise<SpriteFrame | null> {
    if (!uuid || uuid.trim() === '') return Promise.resolve(null);

    return new Promise<SpriteFrame | null>((resolve) => {
      assetManager.loadAny({ uuid, type: ImageAsset }, (err, asset) => {
        if (err || !(asset instanceof ImageAsset)) {
          resolve(null);
          return;
        }
        const texture = new Texture2D();
        texture.image = asset;
        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;
        resolve(spriteFrame);
      });
    });
  }

  static async loadJsonAsset(path: string, bundleName?: string): Promise<JsonAsset | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundleName ?? this._currentBundle);
    if (!res) return Promise.resolve(null);

    return this.loadAsset(res, path, JsonAsset);
  }

  static async loadTextAsset(path: string, bundleName?: string): Promise<TextAsset | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundleName ?? this._currentBundle);
    if (!res) return Promise.resolve(null);

    return await this.loadAsset(res, path, TextAsset);
  }

  /**
   * 获取精灵
   * @param path 图片路径，支持本地和远程地址，本地地址支持 bundle 资源
   * @param formate 
   * @returns 
   * @example
   * CCResourcesSprite.getSpriteFrame('images/goods/i_1_1');   // 本地地址（不包含图片后缀名，路径从 resources 目录下面开始）
   * CCResourcesSprite.getSpriteFrame('game/images/goods/i_1_1:game');   // bundle 资源，game 为 bundle 名称；
   */
  static async getSpriteFrame(path: string, formate: SpriteLoadFormate = "spriteFrame"): Promise<SpriteFrame | null> {
    const parsed = this.parsePath(path);
    if (parsed.isRemote) return Promise.resolve(null);
    return this.loadSpriteFrame(parsed.path, parsed.bundle, formate);
  }

  /**
   * 获取 json 数据
   * @param path json路径（不包含后缀，相对路径从resources子目录算起），本地地址支持 bundle 资源
   * @returns 
   * @example
   * CCResources.getJson<GuideTask>('guide/task1');   // 本地地址（不包含后缀名，路径从 resources 目录下面开始）
   * CCResources.getJson<GuideTask>('db://game/guide/task1');   // bundle 资源，game 为 bundle 名称；
   */
  static async getJson<T = any>(path: string): Promise<T | null> {
    const parsed = this.parsePath(path);
    if (parsed.isRemote) return Promise.resolve(null);
    const jsonAsset = await this.loadJsonAsset(parsed.path, parsed.bundle);
    if (jsonAsset) {
      return jsonAsset.json as T;
    }

    return null;
  }
}