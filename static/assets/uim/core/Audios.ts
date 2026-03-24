/**
 * Audios.ts - 音频管理静态类
 * @description 该类提供全局访问接口,便捷调用播放、暂停、停止等方法，依赖于 IAudioManager 的 playMusic、pauseMusic、resumeMusic、stopMusic 和 playSound 方法实现具体功能。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/audios}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-13
 * @modified 2026-03-13
 */

import { IAudioManager } from "./IAudioManager";

/**
 * 音频静态类，便捷调用播放、暂停、停止等方法
 * @help https://vangagh.gitbook.io/brief-toolkit/uim/audios
 */
export class Audios {
  private static _currentAudioManager?: IAudioManager;
  static bind(audioManager: IAudioManager): void {
    Audios._currentAudioManager = audioManager;
  }
  static unbind(audioManager: IAudioManager): void {
    if (Audios._currentAudioManager === audioManager) {
      Audios._currentAudioManager = undefined;
    }
  }
  private static checkCurrentAudioManager(): boolean {
    if (!Audios._currentAudioManager) {
      console.warn("Audios: currentAudioManager is not set.");
      return false;
    }
    return true;
  }

  /**
   * 播放背景音乐（按路径）。
   * @param path 音频路径（不包含后缀，相对路径从resources子目录算起），不传则使用默认背景音乐
   * @param loop 是否循环（默认循环）
   */
  static playMusic(path?: string, loop?: boolean): Promise<void> {
    if (!Audios.checkCurrentAudioManager()) {
      return Promise.reject("Audios: currentAudioManager is not set.");
    }
    return Audios._currentAudioManager.playMusic(path, loop);
  }

  /**
   * 转换音乐播放开关
   * @param isSwitch true:开，false:关闭，不传则切换
   * @returns 返回当前音乐播放开关状态
   */
  static switchMusic(isSwitch?: boolean): boolean {
    if (!Audios.checkCurrentAudioManager()) {
      return false;
    }
    return Audios._currentAudioManager.switchMusic(isSwitch);
  }

  /** 获取音乐播放开关状态 */
  static get musicSwitch(): boolean {
    if (!Audios.checkCurrentAudioManager()) {
      return false;
    }
    return Audios._currentAudioManager.musicSwitch;
  }

  /**
   * 设置背景音乐音量
   * @param volume （0.0 ~ 1.0）
   */
  static set musicVolume(volume: number) {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.musicVolume = volume;
  }

  /** 获取背景音乐音量 */
  static get musicVolume(): number {
    if (!Audios.checkCurrentAudioManager()) {
      return 0;
    }
    return Audios._currentAudioManager.musicVolume;
  }

  /** 是否当前背景音乐正在播放 */
  static get isMusicPlaying(): boolean {
    if (!Audios.checkCurrentAudioManager()) {
      return false;
    }
    return Audios._currentAudioManager.isMusicPlaying;
  }

  /** 暂停背景音乐 */
  static pauseMusic(): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.pauseMusic();
  }

  /** 恢复当前被暂停背景音乐 */
  static resumeMusic(): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.resumeMusic();
  }

  /** 重新播放背景音乐 */
  static replayMusic(): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.replayMusic();
  }

  /** 停止背景音乐 */
  static stopMusic(): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.stopMusic();
  }

  /** 
   * 以指定音量倍数播放一个音频一次（过程不再接管）
   * @param path 音频路径（不包含后缀，相对路径从resources子目录算起）
   * @param volume 音量倍数（0.0 ~ 1.0）, 不传则使用默认音量
   */
  static playOneShot(path: string, volume?: number): Promise<void> {
    if (!Audios.checkCurrentAudioManager()) {
      return Promise.reject("Audio: currentAudioManager is not set.");
    }
    return Audios._currentAudioManager.playOneShot(path, volume);
  }

  /**
   * 播放音效
   * @param path 音频路径（不包含后缀，相对路径从resources子目录算起）
   * @param volume 音量倍数（0.0 ~ 1.0）, 不传则使用默认音量
   * @param loop 是否循环（默认不循环）, 不传则使用默认值 false
   * @param onStop 停止播放回调
   * @returns Promise<number> 音效id, 用于后续管理（返回-1表示播放失败）
   */
  static playSound(path: string, volume?: number, loop?: boolean, onStop?: () => void): Promise<number> {
    if (!Audios.checkCurrentAudioManager()) {
      return Promise.resolve(-1);
    }
    return Audios._currentAudioManager.playSound(path, volume, loop, onStop);
  }

  /**
   * 转换音效播放开关(仅关闭正在播放的音效)
   * @param isSwitch true:开，false:关闭，不传则切换
   * @returns 
   */
  static switchSound(isSwitch?: boolean): boolean {
    if (!Audios.checkCurrentAudioManager()) {
      return false;
    }
    return Audios._currentAudioManager.switchSound(isSwitch);
  }

  /** 获取音效播放开关状态 */
  static get soundSwitch(): boolean {
    if (!Audios.checkCurrentAudioManager()) {
      return false;
    }
    return Audios._currentAudioManager.soundSwitch;
  }

  /**
   * 设置音效音量
   * @param volume 0.0 - 1.0
   */
  static set soundVolume(volume: number) {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.soundVolume = volume;
  }

  /**
   * 获取音效音量
   * @returns 0.0 - 1.0
   */
  static get soundVolume(): number {
    if (!Audios.checkCurrentAudioManager()) {
      return 0;
    }
    return Audios._currentAudioManager.soundVolume;
  }

  /**
   * 判断指定音效是否正在播放
   * @param soundId 音效id（playSound方法的返回值）
   * @return 是否正在播放
   */
  static isSoundPlaying(soundId: number): boolean {
    if (!Audios.checkCurrentAudioManager()) {
      return false;
    }
    return Audios._currentAudioManager.isSoundPlaying(soundId);
  }

  /**
   * 暂停指定音效
   * @param soundId 音效id
   */
  static pauseSound(soundId: number): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.pauseSound(soundId);
  }

  /** 暂停正在播放的所有音效 */
  static pauseAllSounds(): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.pauseAllSounds();
  }

  /**
   * 恢复指定音效
   * @param soundId 音效id
   */
  static resumeSound(soundId: number): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.resumeSound(soundId);
  }

  /** 恢复被暂停播放的所有音效 */
  static resumeAllSounds(): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.resumeAllSounds();
  }

  /**
   * 停止播放指定音效
   * @param soundId 音效id
   */
  static stopSound(soundId: number): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.stopSound(soundId);
  }

  /** 停止正在播放的所有音效 */
  static stopAllSounds(): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.stopAllSounds();
  }

  /** 释放所有使用过的音效资源 */
  static releaseAllAudioClip(): void {
    if (!Audios.checkCurrentAudioManager()) {
      return;
    }
    Audios._currentAudioManager.releaseAllAudioClip();
  }
}