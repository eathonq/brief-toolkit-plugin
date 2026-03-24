/**
 * CCResources.ts - 资源管理
 * @description 该类提供了资源管理的功能，包括加载、缓存和释放资源。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/resources}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-16
 * @modified 2026-03-12
 */

import { Node, AssetManager, SpriteFrame, Texture2D, assetManager, resources, JsonAsset, AudioClip, Sprite, Prefab, TextAsset, ImageAsset } from "cc";

const _res_ = 'resources';
type SpriteLoadFormate = "spriteFrame" | "texture" | string;

/** 资源管理类，便捷提供全局调用加载、缓存和释放资源等方法 */
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
          console.warn("[CCResources] loadBundle failed:", bundle, err);
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

  private static async loadSpriteFrame(path: string, bundleName?: string, formate: SpriteLoadFormate = "spriteFrame"): Promise<SpriteFrame | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundleName ?? this._currentBundle);
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
        if (err || !imageAsset) {
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

  private static async loadSpriteByPath(path: string, formate: SpriteLoadFormate): Promise<SpriteFrame | null> {
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

  private static setSprite(node: Node | Sprite, path: string, formate: SpriteLoadFormate = "spriteFrame"): void {
    const target = node as unknown as object;
    const requestId = ++this._requestId;
    this._targetRequestMap.set(target, requestId);

    this.loadSpriteByPath(path, formate).then((spriteFrame) => {
      if (!spriteFrame) return;
      const currentRequestId = this._targetRequestMap.get(target);
      if (currentRequestId !== requestId) {
        return;
      }
      this.applySprite(node, spriteFrame);
    });
  }

  private static async loadPrefab(path: string, bundleName?: string): Promise<Prefab | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundleName ?? this._currentBundle);
    if (!res) return Promise.resolve(null);

    return new Promise<Prefab | null>((resolve, reject) => {
      res.load<Prefab>(path, (err: any, prefab: Prefab) => {
        if (err) {
          resolve(null);
        } else {
          resolve(prefab);
        }
      });
    });
  }

  private static async loadJson<T = any>(path: string, bundleName?: string): Promise<T | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundleName ?? this._currentBundle);
    if (!res) return Promise.resolve(null);

    return new Promise<T | null>((resolve, reject) => {
      res.load(path, (err: any, res: JsonAsset) => {
        if (err) {
          resolve(null);
        } else {
          resolve(res.json as T);
        }
      });
    });
  }

  private static async loadAudioClip(path: string, bundleName?: string): Promise<AudioClip | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundleName ?? this._currentBundle);
    if (!res) return Promise.resolve(null);

    return new Promise<AudioClip | null>((resolve, reject) => {
      res.load(path, (err: any, res: AudioClip) => {
        if (err) {
          resolve(null);
        } else {
          resolve(res);
        }
      });
    });
  }

  private static async loadText(path: string, bundleName?: string): Promise<string | null> {
    if (!path || path.trim() === '') return Promise.resolve(null);

    const res = await this.loadBundle(bundleName ?? this._currentBundle);
    if (!res) return Promise.resolve(null);

    return new Promise<string | null>((resolve, reject) => {
      res.load(path, (err: any, res: TextAsset) => {
        if (err) {
          resolve(null);
        } else {
          resolve(res.text);
        }
      });
    });
  }

  private static async release(path: string, bundleName?: string): Promise<void> {
    if (!path || path.trim() === '') return;

    const res = await this.loadBundle(bundleName ?? this._currentBundle);
    if (!res) return;

    res.release(path);
  }

  /***
   * 获取精灵帧
   * @param path 精灵帧路径（不包含后缀，相对路径主包从resources子目录算起, 分包从分包目录子目录算起）
   * @param formate 精灵帧格式（spriteFrame: 精灵帧，texture: 纹理）
   * @returns
   * @example
   * CCResources.getSpriteFrame('image/icon');   // 本地地址（不包含后缀名，路径从 resources 目录下面开始）
   * CCResources.getSpriteFrame('db://game/image/icon');   // bundle 资源，game 为 bundle 名称
   */
  static async getSpriteFrame(path: string, formate: SpriteLoadFormate = "spriteFrame"): Promise<SpriteFrame | null> {
    return this.loadSpriteByPath(path, formate);
  }

  /**
   * 设置节点精灵
   * @param node node节点或着 sprite 组件
   * @param path 精灵帧路径（不包含后缀，相对路径主包从resources子目录算起, 分包从分包目录子目录算起）
   * @param formate 精灵帧格式（spriteFrame: 精灵帧，texture: 纹理）
   * @example
   * CCResources.setNodeSprite(node, 'image/icon');   // 本地地址（不包含后缀名，路径从 resources 目录下面开始）
   * CCResources.setNodeSprite(node, 'db://game/image/icon');   // bundle 资源，game 为 bundle 名称
   */
  static setNodeSprite(node: Node | Sprite, path: string, formate: SpriteLoadFormate = "spriteFrame"): void {
    this.setSprite(node, path, formate);
  }

  /**
   * 获取预制体
   * @param path 预制体路径（不包含后缀，相对路径主包从resources子目录算起, 分包从分包目录子目录算起） 
   * @returns 
   * @example
   * CCResources.getPrefab('prefab/ui/button');   // 本地地址（不包含后缀名，路径从 resources 目录下面开始）
   * CCResources.getPrefab('db://game/prefab/ui/button');   // bundle 资源，game 为 bundle 名称
   */
  static async getPrefab(path: string): Promise<Prefab | null> {
    const parsed = this.parsePath(path);
    if (parsed.isRemote) return Promise.resolve(null);
    return this.loadPrefab(parsed.path, parsed.bundle);
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
    return this.loadJson<T>(parsed.path, parsed.bundle);
  }

  /**
   * 获取音频剪辑
   * @param path 音频路径（不包含后缀，相对路径主包从resources子目录算起, 分包从分包目录子目录算起）
   * @returns 
   * @example
   * CCResources.getAudioClip('audio/bgm');   // 本地地址（不包含后缀名，路径从 resources 目录下面开始）
   * CCResources.getAudioClip('db://game/audio/bgm');   // bundle 资源，game 为 bundle 名称
   */
  static async getAudioClip(path: string): Promise<AudioClip | null> {
    const parsed = this.parsePath(path);
    if (parsed.isRemote) return Promise.resolve(null);
    return this.loadAudioClip(parsed.path, parsed.bundle);
  }

  /**
   * 获取文本内容
   * @param path 文本路径（不包含后缀，相对路径主包从resources子目录算起, 分包从分包目录子目录算起）
   * @returns 
   * @example
   * CCResources.getText('data/config');   // 本地地址（不包含后缀名，路径从 resources 目录下面开始）
   * CCResources.getText('db://game/data/config');   // bundle 资源，game 为 bundle 名称
   */
  static async getText(path: string): Promise<string | null> {
    const parsed = this.parsePath(path);
    if (parsed.isRemote) return Promise.resolve(null);
    return this.loadText(parsed.path, parsed.bundle);
  }

  /**
   * 释放资源
   * @param path 资源路径（不包含后缀，相对路径主包从resources子目录算起, 分包从分包目录子目录算起）
   * @returns 
   * @example
   * CCResources.releasePath('audio/bgm');   // 本地地址（不包含后缀名，路径从 resources 目录下面开始）
   * CCResources.releasePath('db://game/audio/bgm');   // bundle 资源，game 为 bundle 名称
   */
  static async releasePath(path: string): Promise<void> {
    const parsed = this.parsePath(path);
    if (parsed.isRemote) return;
    return this.release(parsed.path, parsed.bundle);
  }
}