/**
 * CCResources.ts - 资源加载工具
 * @description 该模块提供资源加载工具，支持从本地资源和远程地址加载图片，并将其应用到 Sprite 组件上。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-02-27
 * @modified 2026-03-11
 */

import { Node, AssetManager, SpriteFrame, Texture2D, assetManager, resources, ImageAsset, Sprite } from "cc";

const _res_ = 'resources';
type SpriteLoadFormate = "spriteFrame" | "texture" | string;

/**
 * 资源加载工具
 * @info 本地地址支持 bundle 资源，格式：'db://game/images/goods/i_1_1'，game 为 bundle 名称；
 */
export class CCResources {
  private static _currentBundle: string = _res_;
  private static _bundleMap: Map<string, AssetManager.Bundle> = new Map<string, AssetManager.Bundle>([
    [_res_, resources]
  ]);
  private static _bundleLoadingMap: Map<string, Promise<AssetManager.Bundle | null>> = new Map<string, Promise<AssetManager.Bundle | null>>();
  private static _remoteSpriteFrameCache: Map<string, SpriteFrame> = new Map<string, SpriteFrame>();
  private static _remoteLoadingMap: Map<string, Promise<SpriteFrame | null>> = new Map<string, Promise<SpriteFrame | null>>();
  private static _requestId = 0;
  private static _targetRequestMap: WeakMap<object, number> = new WeakMap<object, number>();

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
      const firstSlash = inner.indexOf("/");
      if (firstSlash <= 0) {
        return { path: "", isRemote: false };
      }
      return {
        bundle: inner.slice(0, firstSlash),
        path: inner.slice(firstSlash + 1),
        isRemote: false
      };
    }

    return { path: raw, isRemote: false };
  }

  private static async loadSpriteFrame(path: string, bundle?: string, formate: SpriteLoadFormate = "spriteFrame"): Promise<SpriteFrame | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundle ?? this._currentBundle);
    if (!res) return Promise.resolve(null);

    if (formate == "spriteFrame") {
      return new Promise<SpriteFrame | null>((resolve) => {
        res.load(`${path}/spriteFrame`, SpriteFrame, (err: any, spriteFrame: SpriteFrame) => {
          if (err) {
            resolve(null);
          } else {
            resolve(spriteFrame);
          }
        });
      });
    }
    else if (formate == "texture") {
      return new Promise<SpriteFrame | null>((resolve) => {
        res.load(`${path}/texture`, Texture2D, (err: any, texture: Texture2D) => {
          if (err) {
            resolve(null);
          } else {
            let spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            resolve(spriteFrame);
          }
        });
      });
    }

    return Promise.resolve(null);
  }

  private static async loadRemoteSpriteFrame(url: string): Promise<SpriteFrame | null> {
    if (!url || url.trim() === "") return Promise.resolve(null);

    const cached = this._remoteSpriteFrameCache.get(url);
    if (cached) {
      return Promise.resolve(cached);
    }

    const loading = this._remoteLoadingMap.get(url);
    if (loading) {
      return loading;
    }

    const promise = new Promise<SpriteFrame | null>((resolve) => {
      assetManager.loadRemote<ImageAsset>(url, (err: any, imageAsset) => {
        this._remoteLoadingMap.delete(url);
        if (err) {
          resolve(null);
        } else {
          const spriteFrame = new SpriteFrame();
          const texture = new Texture2D();
          texture.image = imageAsset;
          spriteFrame.texture = texture;
          this._remoteSpriteFrameCache.set(url, spriteFrame);
          resolve(spriteFrame);
        }
      });
    });

    this._remoteLoadingMap.set(url, promise);
    return promise;
  }

  private static async loadByPath(path: string, formate: SpriteLoadFormate): Promise<SpriteFrame | null> {
    const parsed = this.parsePath(path);
    if (!parsed.path) return Promise.resolve(null);
    if (parsed.isRemote) {
      return this.loadRemoteSpriteFrame(parsed.path);
    }
    return this.loadSpriteFrame(parsed.path, parsed.bundle, formate);
  }

  private static applySprite(node: Node | Sprite, spriteFrame: SpriteFrame): void {
    if (!spriteFrame) return;
    if ((node as any).isValid === false) return;

    if (node instanceof Node) {
      let sprite: Sprite = node.getComponent(Sprite);
      if (!sprite) {
        if (node.isValid === false) return;
        sprite = node.addComponent(Sprite);
      }
      if (sprite && sprite.isValid !== false) {
        sprite.spriteFrame = spriteFrame;
      }
      return;
    }

    if (node.isValid !== false) {
      node.spriteFrame = spriteFrame;
    }
  }

  static releaseRemote(url?: string): void {
    const releaseOne = (targetUrl: string) => {
      const frame = this._remoteSpriteFrameCache.get(targetUrl);
      if (!frame) return;
      const texture = frame.texture;
      this._remoteSpriteFrameCache.delete(targetUrl);
      if (frame.isValid) {
        frame.destroy();
      }
      if (texture && texture.isValid) {
        texture.destroy();
      }
    };

    if (url) {
      releaseOne(url);
      return;
    }

    for (const key of this._remoteSpriteFrameCache.keys()) {
      releaseOne(key);
    }
  }

  /**
   * 设置精灵
   * @param path 图片路径，支持本地和远程地址，本地地址支持 bundle 资源
   * @param formate 
   * @returns 
   * @example
   * CCResources.getSpriteFrame(node, 'images/goods/i_1_1');   // 本地地址（不包含图片后缀名，路径从 resources 目录下面开始）
   * CCResources.getSpriteFrame(node, 'db://game/images/goods/i_1_1');   // bundle 资源，game 为 bundle 名称
   * CCResources.getSpriteFrame(node, 'https://xxx.com/xxx.png');   // 远程地址
   */
  static async getSpriteFrame(path: string, formate: SpriteLoadFormate = "spriteFrame"): Promise<SpriteFrame | null> {
    return this.loadByPath(path, formate);
  }

  /**
   * 设置精灵
   * @param node Node 或 Sprite 
   * @param path 图片路径，支持本地和远程地址，本地地址支持 bundle 资源
   * @param formate 
   * @returns 
   * @example
   * CCResources.setSprite(node, 'images/goods/i_1_1');   // 本地地址（不包含图片后缀名，路径从 resources 目录下面开始）
   * CCResources.setSprite(node, 'db://game/images/goods/i_1_1');   // bundle 资源，game 为 bundle 名称
   * CCResources.setSprite(node, 'https://xxx.com/xxx.png');   // 远程地址
   */
  static setSprite(node: Node | Sprite, path: string, formate: SpriteLoadFormate = "spriteFrame"): void {
    const target = node as unknown as object;
    const requestId = ++this._requestId;
    this._targetRequestMap.set(target, requestId);

    this.loadByPath(path, formate).then((spriteFrame) => {
      if (!spriteFrame) return;
      const currentRequestId = this._targetRequestMap.get(target);
      if (currentRequestId !== requestId) {
        return;
      }
      this.applySprite(node, spriteFrame);
    });
  }
}