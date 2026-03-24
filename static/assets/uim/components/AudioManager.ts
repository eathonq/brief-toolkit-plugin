/**
 * AudioManager.ts - 音频管理绑定组件
 * @description 该组件实现了音频管理的功能，包括背景音乐和音效的播放、暂停、停止以及音量控制等。
 * @important 在 Cocos Creator 中，通常挂载在场景根节点或常驻节点（如Canvas、RootNode）上。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/audiomanager}
 * 
 * @author eathonq
 * @version v1.0.0
 * 
 * @created 2023-02-28
 * @license MIT
 * @modified 2026-03-13
 */

import { _decorator, Node, AudioClip, AudioSource, Component, NodePool } from "cc";
import { EventMutex } from "../core/EventMutex";
import { CCResources } from "../core/CCResources";
import { IAudioManager } from "../core/IAudioManager";
import { Audios } from "../core/Audios";
const { ccclass, help, menu, property } = _decorator;

const checkUndefinedAndNull = (value: any) => value === undefined || value === null;
const clampVolume = (value: number) => Math.max(0, Math.min(1, value));

/** 音频管理绑定组件 */
@ccclass('uim.AudioManager')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/audiomanager')
@menu('BriefToolkit/UIM/AudioManager')
export class AudioManager extends Component implements IAudioManager {
  @property({
    type: AudioClip,
    tooltip: "默认背景音乐文件",
  })
  private musicClip: AudioClip = null;

  @property({
    tooltip: "启动播放背景音乐",
  })
  private playOnLoad: boolean = false;

  /** 独立播放背景音乐的AudioSource */
  private _musicAudioSource: AudioSource;
  /** 独立播放一次性音效的AudioSource */
  private _oneShotAudioSource: AudioSource;
  /** 一组可管理的音效AudioSource */
  private _audioSourceMap: Map<number, AudioSource>;
  /** 缓存音频文件 */
  private _audioClipCaches: Map<string, AudioClip>;
  /** 正在加载中的音频任务（用于并发去重） */
  private _audioClipLoadingTasks: Map<string, Promise<AudioClip>>;

  /** 背景音乐声音（0.0 ~ 1.0） */
  private _musicVolume = 1;
  /** 背景音乐开关(true:开，false:关闭) */
  private _musicSwitch = false;

  /** 音效声音（0.0 ~ 1.0） */
  private _soundVolume = 1;
  /** 音效开关(true:开，false:关闭) */
  private _soundSwitch = true;

  protected onLoad(): void {
    Audios.bind(this);
    
    this._audioSourceMap = new Map<number, AudioSource>();
    this._audioClipCaches = new Map<string, AudioClip>();
    this._audioClipLoadingTasks = new Map<string, Promise<AudioClip>>();

    // 初始化背景音乐音频组件
    this._musicAudioSource = this.node.addComponent(AudioSource);

    // 初始化短音频音频组件
    this._oneShotAudioSource = this.node.addComponent(AudioSource);

    // 初始化配置背景音乐
    if (this.playOnLoad) {
      this._musicSwitch = true;
      if (this.musicClip) {
        this.playMusicByClip(this.musicClip);
      }
    }
  }

  protected onDestroy(): void {
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
  }

  protected onEnable(): void {
    Audios.bind(this);
  }

  protected onDisable(): void {
    Audios.unbind(this);
  }

  /**
   * 播放背景音乐（按路径）。
   * @param path 音频路径（不包含后缀，相对路径从resources子目录算起），不传则使用默认背景音乐
   * @param loop 是否循环（默认循环）
   */
  async playMusic(path?: string, loop?: boolean): Promise<void> {
    if (!this._musicSwitch) return;

    let music: AudioClip = this.musicClip;
    if (path) {
      music = await this.getOrCreateAudioClip(path);
    }

    this.playMusicByClip(music, loop);
  }

  /**
   * 播放背景音乐（按 AudioClip）。
   * 该方法不在 IAudioManager 中暴露，用于与引擎类型解耦。
   */
  playMusicByClip(music?: AudioClip, loop?: boolean): void {
    if (!this._musicSwitch) return;
    if (!music) return;

    if (this._musicAudioSource) {
      if (this._musicAudioSource.clip == music) {
        this._musicAudioSource.volume = this._musicVolume;
        this._musicAudioSource.loop = checkUndefinedAndNull(loop) ? true : loop;
        if (this._musicAudioSource.playing) return;  // 音乐已经在播放
        this._musicAudioSource.play();  // 继续播放
        return;
      }
      this._musicAudioSource.stop();
    }

    this._musicAudioSource.clip = music;
    this._musicAudioSource.volume = this._musicVolume;
    this._musicAudioSource.loop = checkUndefinedAndNull(loop) ? true : loop;
    this._musicAudioSource.play();
  }

  /**
   * 转换音乐播放开关
   * @param isSwitch true:开，false:关闭，不传则切换
   * @returns 返回当前音乐播放开关状态
   */
  switchMusic(isSwitch?: boolean): boolean {
    if (checkUndefinedAndNull(isSwitch)) {
      this._musicSwitch = !this._musicSwitch;
    }
    else {
      if (this._musicSwitch === isSwitch) return this._musicSwitch;
      this._musicSwitch = isSwitch;
    }

    if (this._musicAudioSource.clip == null) {
      if (this._musicSwitch) {
        if (this.musicClip) {
          this.playMusicByClip(this.musicClip);
        }
        else {
          console.warn("未设置背景音乐");
        }
      }
      return this._musicSwitch;
    }

    if (this._musicSwitch) {
      if (!this._musicAudioSource.playing)
        this._musicAudioSource.play();
    }
    else {
      if (this._musicAudioSource.playing)
        this._musicAudioSource.stop();
    }

    return this._musicSwitch;
  }

  /** 获取音乐播放开关状态 */
  get musicSwitch() {
    return this._musicSwitch;
  }

  /**
   * 设置背景音乐音量
   * @param volume （0.0 ~ 1.0）
   */
  set musicVolume(volume: number) {
    this._musicVolume = clampVolume(volume);
    this._musicAudioSource.volume = this._musicVolume;
  }

  /** 获取背景音乐音量 */
  get musicVolume(): number {
    return this._musicVolume;
  }

  /** 是否当前背景音乐正在播放 */
  get isMusicPlaying(): boolean {
    if (!this._musicAudioSource) return false;
    return this._musicAudioSource.playing;
  }

  /** 暂停背景音乐 */
  pauseMusic(): void {
    if (!this._musicSwitch) return;
    if (this._musicAudioSource.playing)
      this._musicAudioSource.pause();
  }

  /** 恢复当前被暂停背景音乐 */
  resumeMusic(): void {
    if (!this._musicSwitch) return;
    if (!this._musicAudioSource.playing)
      this._musicAudioSource.play();
  }

  /** 重新播放背景音乐 */
  replayMusic(): void {
    if (!this._musicSwitch) return;
    this._musicAudioSource.stop();
    this._musicAudioSource.play();
  }

  /** 停止背景音乐 */
  stopMusic(): void {
    this._musicAudioSource.stop();
  }

  /** 
   * 以指定音量倍数播放一个音频一次（过程不再接管）
   * @param path 音频路径（不包含后缀，相对路径从resources子目录算起）
   * @param volume 音量倍数（0.0 ~ 1.0）, 不传则使用默认音量
   */
  async playOneShot(path: string, volume?: number): Promise<void> {
    if (!path) {
      console.warn("[AudioManager] playOneShot path is empty");
      return;
    }

    if (this._soundSwitch) {
      let audioClip = await this.getOrCreateAudioClip(path);
      if (audioClip) {
        const finalVolume = clampVolume(checkUndefinedAndNull(volume) ? this._soundVolume : volume);
        this._oneShotAudioSource.playOneShot(audioClip, finalVolume);
      }
    }
  }

  /** 音效id计数器 */
  private _soundIdCounter = 0;
  /** 音效事件锁 */
  private _playEventMutex = new EventMutex(1);
  /**
   * 播放音效
   * @param path 音频路径（不包含后缀，相对路径从resources子目录算起）
   * @param volume 音量倍数（0.0 ~ 1.0）, 不传则使用默认音量
   * @param loop 是否循环（默认不循环）, 不传则使用默认值 false
   * @param onStop 停止播放回调
  * @returns Promise<number> 音效id, 用于后续管理（返回-1表示播放失败）
   */
  async playSound(path: string, volume?: number, loop?: boolean, onStop?: () => void): Promise<number> {
    if (this._soundSwitch == false) {
      return -1;
    }

    if (!path) {
      console.warn("[AudioManager] playSound path is empty");
      return -1;
    }

    await this._playEventMutex.wait();
    const soundId = ++this._soundIdCounter;
    try {
      const audioSource = this.createAudioSource(soundId, onStop);
      let audioClip = await this.getOrCreateAudioClip(path);
      if (!audioClip) {
        audioSource.node.emit(AudioSource.EventType.ENDED);
        return -1;
      }
      audioSource.clip = audioClip;
      audioSource.volume = clampVolume(checkUndefinedAndNull(volume) ? this._soundVolume : volume);
      audioSource.loop = checkUndefinedAndNull(loop) ? false : loop;
      audioSource.play();
      return soundId;
    }
    catch (error) {
      const audioSource = this._audioSourceMap.get(soundId);
      if (audioSource) {
        audioSource.node.emit(AudioSource.EventType.ENDED);
      }
      console.error(`[AudioManager] playSound failed, path=${path}`, error);
      return -1;
    }
    finally {
      this._playEventMutex.notify();
    }
  }

  /**
   * 转换音效播放开关(仅关闭正在播放的音效)
   * @param isSwitch true:开，false:关闭，不传则切换
   * @returns 
   */
  switchSound(isSwitch?: boolean): boolean {
    if (checkUndefinedAndNull(isSwitch)) {
      this._soundSwitch = !this._soundSwitch;
    }
    else {
      if (this._soundSwitch === isSwitch) return this._soundSwitch;
      this._soundSwitch = isSwitch;
    }

    if (!this._soundSwitch) {
      for (const item of this._audioSourceMap.values()) {
        this.stopAudioSource(item);
      }
    }
    return this._soundSwitch;
  }

  /** 获取音效播放开关状态 */
  get soundSwitch(): boolean {
    return this._soundSwitch;
  }

  /**
   * 设置音效音量
   * @param volume 0.0 - 1.0
   */
  set soundVolume(volume: number) {
    this._soundVolume = clampVolume(volume);
    // 设置音效声音大小
    for (const item of this._audioSourceMap.values()) {
      item.volume = this._soundVolume;
    }
  }

  /**
   * 获取音效音量
   * @returns 0.0 - 1.0
   */
  get soundVolume(): number {
    return this._soundVolume;
  }

  /**
   * 判断指定音效是否正在播放
   * @param soundId 音效id（playSound方法的返回值）
   * @return 是否正在播放
   */
  isSoundPlaying(soundId: number): boolean {
    let item = this._audioSourceMap.get(soundId);
    return item ? item.playing : false
  }

  /**
   * 暂停指定音效
   * @param soundId 音效id
   */
  pauseSound(soundId: number): void {
    let item = this._audioSourceMap.get(soundId);
    if (item && item.playing) {
      item.pause();
    }
  }

  /** 暂停正在播放的所有音效 */
  pauseAllSounds(): void {
    for (const item of this._audioSourceMap.values()) {
      if (item.playing) {
        item.pause();
      }
    }
  }

  /**
   * 恢复指定音效
   * @param soundId 音效id
   */
  resumeSound(soundId: number): void {
    let item = this._audioSourceMap.get(soundId);
    if (item && !item.playing) {
      item.play();
    }
  }

  /** 恢复被暂停播放的所有音效 */
  resumeAllSounds(): void {
    for (const item of this._audioSourceMap.values()) {
      if (!item.playing) {
        item.play();
      }
    }
  }

  /**
   * 停止播放指定音效
   * @param soundId 音效id
   */
  stopSound(soundId: number): void {
    let item = this._audioSourceMap.get(soundId);
    if (item) {
      this.stopAudioSource(item);
    }
  }

  /** 停止正在播放的所有音效 */
  stopAllSounds(): void {
    for (const item of this._audioSourceMap.values()) {
      this.stopAudioSource(item);
    }
  }

  /** 释放所有使用过的音效资源 */
  releaseAllAudioClip(): void {
    if (!this._audioClipCaches) {
      return;
    }

    for (const path of this._audioClipCaches.keys()) {
      CCResources.releasePath(path);
    }
    this._audioClipCaches.clear();
    this._audioClipLoadingTasks?.clear();
  }

  private async getOrCreateAudioClip(path: string): Promise<AudioClip> {
    if (!path) {
      return null;
    }

    let cache = this._audioClipCaches.get(path);
    if (cache) {
      return cache;
    }

    let loadingTask = this._audioClipLoadingTasks.get(path);
    if (!loadingTask) {
      loadingTask = (async () => {
        try {
          const clip = await CCResources.getAudioClip(path);
          if (clip) {
            this._audioClipCaches.set(path, clip);
          }
          return clip;
        }
        finally {
          this._audioClipLoadingTasks.delete(path);
        }
      })();
      this._audioClipLoadingTasks.set(path, loadingTask);
    }

    return await loadingTask;
  }

  private _audioSourceNodePool: NodePool = new NodePool("AUDIO_SOUND_NODE_POOL");
  private createAudioSource(soundId: number, onStop?: () => void): AudioSource {
    let audioSourceNode = this._audioSourceNodePool.get();
    if (!audioSourceNode) {
      audioSourceNode = new Node();
      audioSourceNode.addComponent(AudioSource);
      this.node.addChild(audioSourceNode);
    }
    // 播放结束后回收
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

  private stopAudioSource(audioSource: AudioSource) {
    audioSource.stop();
    audioSource.node.emit(AudioSource.EventType.ENDED);
  }
}
