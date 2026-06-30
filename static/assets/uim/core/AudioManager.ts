/**
 * AudioManager.ts - 音频管理器（全局单例）
 * @description 全局音频管理单例，构造函数自举绑定 Audios。
 *              通过 game.addPersistRootNode 创建持久节点，跨场景存活。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2023-02-28
 * @modified 2026-06-11
 */

import { Node, AudioClip, AudioSource, NodePool, director } from "cc";
import { EventMutex } from "./EventMutex";
import { AssetScope } from "../../common/core/AssetScope";
import { IAudioManager } from "./IAudioManager";
import { __audiosBind } from "./Audios";

const checkUndefinedAndNull = (value: any) => value === undefined || value === null;
const clampVolume = (value: number) => Math.max(0, Math.min(1, value));

const ASSET_SCOPE_AUDIO = "__AUDIO__";

/** 音频管理器（全局单例） */
export class AudioManager implements IAudioManager {
  //#region 单例
  private static _instance: AudioManager = null!;
  static get instance() {
    if (!this._instance) {
      this._instance = new AudioManager();
    }
    return this._instance;
  }
  private constructor() {
    // 自举：创建即绑定到 Audios 静态门面
    __audiosBind(this);

    this._audioSourceMap = new Map<number, AudioSource>();
    this._audioClipCaches = new Map<string, AudioClip>();
    this._audioClipLoadingTasks = new Map<string, Promise<AudioClip | null>>();

    // 创建持久节点——跨场景存活
    this._persistNode = new Node('AudioManager');
    director.addPersistRootNode(this._persistNode);

    // 初始化音频组件
    this._musicAudioSource = this._persistNode.addComponent(AudioSource);
    this._oneShotAudioSource = this._persistNode.addComponent(AudioSource);
  }
  //#endregion

  /** 默认背景音乐 clip（由 AudioSetting 设置） */
  defaultMusicClip: AudioClip = null!;
  /** 启动时是否播放背景音乐（由 AudioSetting 设置） */
  playOnLoad: boolean = false;

  private _persistNode: Node;
  private _musicAudioSource: AudioSource;
  private _oneShotAudioSource: AudioSource;
  private _audioSourceMap: Map<number, AudioSource>;
  private _audioClipCaches: Map<string, AudioClip>;
  private _audioClipLoadingTasks: Map<string, Promise<AudioClip | null>>;
  private _assetScope: AssetScope = new AssetScope(ASSET_SCOPE_AUDIO);

  private _musicVolume = 1;
  private _musicSwitch = false;
  private _soundVolume = 1;
  private _soundSwitch = true;

  private _soundIdCounter = 0;
  private _playEventMutex = new EventMutex(1);
  private _audioSourceNodePool: NodePool = new NodePool("AUDIO_SOUND_NODE_POOL");

  // ── 初始化 ──

  /** 应用初始化配置（由 AudioSetting.onLoad 调用） */
  applySetting(defaultMusicClip?: AudioClip | null, playOnLoad?: boolean): void {
    if (defaultMusicClip) {
      this.defaultMusicClip = defaultMusicClip;
    }
    if (playOnLoad) {
      this._musicSwitch = true;
      if (this.defaultMusicClip) {
        this.playMusicByClip(this.defaultMusicClip);
      }
    }
  }

  /** 销毁管理器（释放所有资源） */
  destroy(): void {
    if (this._musicAudioSource) {
      this._musicAudioSource.stop();
    }
    if (this._oneShotAudioSource) {
      this._oneShotAudioSource.stop();
    }
    if (this._audioSourceMap) {
      for (const item of this._audioSourceMap.values()) {
        item.node.off(AudioSource.EventType.ENDED);
        item.stop();
      }
      this._audioSourceMap.clear();
    }
    if (this._audioSourceNodePool) {
      this._audioSourceNodePool.clear();
    }
    this.releaseAllAudioClip();
    this._audioClipLoadingTasks?.clear();
    this._playEventMutex.reset();

    if (this._persistNode) {
      this._persistNode.destroy();
    }
  }

  // ── 背景音乐 ──

  async playMusic(path?: string, loop?: boolean): Promise<void> {
    if (!this._musicSwitch) return;
    let music: AudioClip | null = this.defaultMusicClip;
    if (path) {
      music = await this._getOrCreateAudioClip(path);
    }
    this.playMusicByClip(music ?? undefined, loop);
  }

  /** 播放背景音乐（按 AudioClip），不暴露到 IAudioManager */
  playMusicByClip(music?: AudioClip, loop?: boolean): void {
    if (!this._musicSwitch) return;
    if (!music) return;

    if (this._musicAudioSource) {
      if (this._musicAudioSource.clip == music) {
        this._musicAudioSource.volume = this._musicVolume;
        this._musicAudioSource.loop = checkUndefinedAndNull(loop) ? true : loop ?? false;
        if (this._musicAudioSource.playing) return;
        this._musicAudioSource.play();
        return;
      }
      this._musicAudioSource.stop();
    }

    this._musicAudioSource.clip = music;
    this._musicAudioSource.volume = this._musicVolume;
    this._musicAudioSource.loop = checkUndefinedAndNull(loop) ? true : loop ?? false;
    this._musicAudioSource.play();
  }

  switchMusic(isSwitch?: boolean): boolean {
    if (checkUndefinedAndNull(isSwitch)) {
      this._musicSwitch = !this._musicSwitch;
    } else {
      if (this._musicSwitch === isSwitch) return this._musicSwitch;
      this._musicSwitch = isSwitch ?? !this._musicSwitch;
    }

    if (this._musicAudioSource.clip == null) {
      if (this._musicSwitch && this.defaultMusicClip) {
        this.playMusicByClip(this.defaultMusicClip);
      }
      return this._musicSwitch;
    }

    if (this._musicSwitch) {
      if (!this._musicAudioSource.playing) this._musicAudioSource.play();
    } else {
      if (this._musicAudioSource.playing) this._musicAudioSource.stop();
    }
    return this._musicSwitch;
  }

  get musicSwitch(): boolean { return this._musicSwitch; }

  get musicVolume(): number { return this._musicVolume; }
  set musicVolume(volume: number) {
    this._musicVolume = clampVolume(volume);
    this._musicAudioSource.volume = this._musicVolume;
  }

  get isMusicPlaying(): boolean {
    if (!this._musicAudioSource) return false;
    return this._musicAudioSource.playing;
  }

  pauseMusic(): void {
    if (!this._musicSwitch || !this._musicAudioSource?.playing) return;
    this._musicAudioSource.pause();
  }

  resumeMusic(): void {
    if (!this._musicSwitch || this._musicAudioSource?.playing) return;
    this._musicAudioSource.play();
  }

  replayMusic(): void {
    if (!this._musicSwitch) return;
    this._musicAudioSource.stop();
    this._musicAudioSource.play();
  }

  stopMusic(): void {
    this._musicAudioSource.stop();
  }

  // ── 一次性播放 ──

  async playOneShot(path: string, volume?: number): Promise<void> {
    if (!path) {
      console.warn("[AudioManager] playOneShot path is empty");
      return;
    }
    if (this._soundSwitch) {
      const audioClip = await this._getOrCreateAudioClip(path);
      if (audioClip) {
        const finalVolume = clampVolume(volume ?? this._soundVolume);
        this._oneShotAudioSource.playOneShot(audioClip, finalVolume);
      }
    }
  }

  // ── 音效 ──

  async playSound(path: string, volume?: number, loop?: boolean, onStop?: () => void): Promise<number> {
    if (this._soundSwitch == false) return -1;
    if (!path) {
      console.warn("[AudioManager] playSound path is empty");
      return -1;
    }

    await this._playEventMutex.wait();
    const soundId = ++this._soundIdCounter;
    try {
      const audioSource = this._createAudioSource(soundId, onStop);
      const audioClip = await this._getOrCreateAudioClip(path);
      if (!audioClip) {
        audioSource.node.emit(AudioSource.EventType.ENDED);
        return -1;
      }
      audioSource.clip = audioClip;
      audioSource.volume = clampVolume(volume ?? this._soundVolume);
      audioSource.loop = loop ?? false;
      audioSource.play();
      return soundId;
    } catch (error) {
      const audioSource = this._audioSourceMap.get(soundId);
      if (audioSource) {
        audioSource.node.emit(AudioSource.EventType.ENDED);
      }
      console.error(`[AudioManager] playSound failed, path=${path}`, error);
      return -1;
    } finally {
      this._playEventMutex.notify();
    }
  }

  switchSound(isSwitch?: boolean): boolean {
    if (checkUndefinedAndNull(isSwitch)) {
      this._soundSwitch = !this._soundSwitch;
    } else {
      if (this._soundSwitch === isSwitch) return this._soundSwitch;
      this._soundSwitch = isSwitch ?? false;
    }
    if (!this._soundSwitch) {
      for (const item of this._audioSourceMap.values()) {
        this._stopAudioSource(item);
      }
    }
    return this._soundSwitch;
  }

  get soundSwitch(): boolean { return this._soundSwitch; }

  get soundVolume(): number { return this._soundVolume; }
  set soundVolume(volume: number) {
    this._soundVolume = clampVolume(volume);
    for (const item of this._audioSourceMap.values()) {
      item.volume = this._soundVolume;
    }
  }

  isSoundPlaying(soundId: number): boolean {
    const item = this._audioSourceMap.get(soundId);
    return item ? item.playing : false;
  }

  pauseSound(soundId: number): void {
    const item = this._audioSourceMap.get(soundId);
    if (item?.playing) item.pause();
  }

  pauseAllSounds(): void {
    for (const item of this._audioSourceMap.values()) {
      if (item.playing) item.pause();
    }
  }

  resumeSound(soundId: number): void {
    const item = this._audioSourceMap.get(soundId);
    if (item && !item.playing) item.play();
  }

  resumeAllSounds(): void {
    for (const item of this._audioSourceMap.values()) {
      if (!item.playing) item.play();
    }
  }

  stopSound(soundId: number): void {
    const item = this._audioSourceMap.get(soundId);
    if (item) this._stopAudioSource(item);
  }

  stopAllSounds(): void {
    for (const item of this._audioSourceMap.values()) {
      this._stopAudioSource(item);
    }
  }

  releaseAllAudioClip(): void {
    if (!this._audioClipCaches) return;
    this._assetScope.releaseAll();
    this._audioClipCaches.clear();
    this._audioClipLoadingTasks?.clear();
  }

  // ── 内部 ──

  private async _getOrCreateAudioClip(path: string): Promise<AudioClip | null> {
    if (!path) return null;
    const cache = this._audioClipCaches.get(path);
    if (cache) return cache;

    let loadingTask = this._audioClipLoadingTasks.get(path);
    if (!loadingTask) {
      loadingTask = (async () => {
        try {
          const clip = await this._assetScope.getAudioClip(path);
          if (clip) this._audioClipCaches.set(path, clip);
          return clip;
        } finally {
          this._audioClipLoadingTasks.delete(path);
        }
      })();
      this._audioClipLoadingTasks.set(path, loadingTask);
    }
    return await loadingTask;
  }

  private _createAudioSource(soundId: number, onStop?: () => void): AudioSource {
    let audioSourceNode = this._audioSourceNodePool.get();
    if (!audioSourceNode) {
      audioSourceNode = new Node();
      audioSourceNode.addComponent(AudioSource);
      this._persistNode.addChild(audioSourceNode);
    }
    audioSourceNode.once(AudioSource.EventType.ENDED, () => {
      onStop?.();
      this._audioSourceMap.delete(soundId);
      this._audioSourceNodePool.put(audioSourceNode);
    }, this);

    let audioSource = audioSourceNode.getComponent(AudioSource);
    if (!audioSource) {
      audioSource = audioSourceNode.addComponent(AudioSource);
    }
    this._audioSourceMap.set(soundId, audioSource);
    return audioSource;
  }

  private _stopAudioSource(audioSource: AudioSource): void {
    audioSource.stop();
    audioSource.node.emit(AudioSource.EventType.ENDED);
  }
}
