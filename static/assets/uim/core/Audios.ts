/**
 * Audios.ts - 音频管理静态类（Null Object 兜底）
 * @description 该类提供全局访问接口，自动回退到 DefaultAudioManager 确保 ViewModel 中
 *              的调用永不崩溃。所有方法代理到 IAudioManager 的具体实现。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/audios}
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-03-13
 * @modified 2026-06-11
 */

import { IAudioManager } from "./IAudioManager";
import { DefaultAudioManager } from "./DefaultAudioManager";

/**
 * 模块级私有状态。
 * 不挂载在 Audios 类上，避免通过 pure.ts 导出暴露给外部使用者。
 */
let _currentAudioManager: IAudioManager | undefined;

/**
 * @internal 绑定真实 Manager（由 AudioManager 构造函数自动调用）
 *
 * 本函数不通过 pure.ts / index.ts 重导出，外部使用者无法访问。
 */
export function __audiosBind(manager: IAudioManager): void {
  _currentAudioManager = manager;
}

/**
 * @internal 解绑 Manager
 */
export function __audiosUnbind(manager: IAudioManager): void {
  if (_currentAudioManager === manager) {
    _currentAudioManager = undefined;
  }
}

/** 音频静态门面 */
export class Audios {
  /**
   * 获取当前 Manager。
   * 若未绑定真实 AudioManager，自动回退到 DefaultAudioManager（Null Object），
   * 确保 ViewModel 中的调用永不因未绑定而崩溃。
   */
  private static get current(): IAudioManager {
    return _currentAudioManager ?? DefaultAudioManager.instance;
  }

  // ── 背景音乐 ──

  static playMusic(path?: string, loop?: boolean): Promise<void> {
    return Audios.current.playMusic(path, loop);
  }

  static switchMusic(isSwitch?: boolean): boolean {
    return Audios.current.switchMusic(isSwitch);
  }

  static get musicSwitch(): boolean {
    return Audios.current.musicSwitch;
  }

  static get musicVolume(): number {
    return Audios.current.musicVolume;
  }
  static set musicVolume(volume: number) {
    Audios.current.musicVolume = volume;
  }

  static get isMusicPlaying(): boolean {
    return Audios.current.isMusicPlaying;
  }

  static pauseMusic(): void {
    Audios.current.pauseMusic();
  }

  static resumeMusic(): void {
    Audios.current.resumeMusic();
  }

  static replayMusic(): void {
    Audios.current.replayMusic();
  }

  static stopMusic(): void {
    Audios.current.stopMusic();
  }

  // ── 一次性播放 ──

  static playOneShot(path: string, volume?: number): Promise<void> {
    return Audios.current.playOneShot(path, volume);
  }

  // ── 音效 ──

  static playSound(path: string, volume?: number, loop?: boolean, onStop?: () => void): Promise<number> {
    return Audios.current.playSound(path, volume, loop, onStop);
  }

  static switchSound(isSwitch?: boolean): boolean {
    return Audios.current.switchSound(isSwitch);
  }

  static get soundSwitch(): boolean {
    return Audios.current.soundSwitch;
  }

  static get soundVolume(): number {
    return Audios.current.soundVolume;
  }
  static set soundVolume(volume: number) {
    Audios.current.soundVolume = volume;
  }

  static isSoundPlaying(soundId: number): boolean {
    return Audios.current.isSoundPlaying(soundId);
  }

  static pauseSound(soundId: number): void {
    Audios.current.pauseSound(soundId);
  }

  static pauseAllSounds(): void {
    Audios.current.pauseAllSounds();
  }

  static resumeSound(soundId: number): void {
    Audios.current.resumeSound(soundId);
  }

  static resumeAllSounds(): void {
    Audios.current.resumeAllSounds();
  }

  static stopSound(soundId: number): void {
    Audios.current.stopSound(soundId);
  }

  static stopAllSounds(): void {
    Audios.current.stopAllSounds();
  }

  static releaseAllAudioClip(): void {
    Audios.current.releaseAllAudioClip();
  }
}
