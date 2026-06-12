/**
 * DefaultAudioManager.ts — IAudioManager 的默认空实现（Null Object Pattern）
 * @description 在真实 AudioManager 绑定前提供安全的空操作，确保 ViewModel 中的
 *              Audios 调用永不因未绑定而崩溃。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-10
 */

import { IAudioManager } from "./IAudioManager";

export class DefaultAudioManager implements IAudioManager {
  static readonly instance = new DefaultAudioManager();

  get musicSwitch(): boolean { return false; }
  get musicVolume(): number { return 0; }
  set musicVolume(_v: number) {}
  get isMusicPlaying(): boolean { return false; }

  get soundSwitch(): boolean { return false; }
  get soundVolume(): number { return 0; }
  set soundVolume(_v: number) {}

  async playMusic(_path?: string, _loop?: boolean): Promise<void> {}
  switchMusic(_isSwitch?: boolean): boolean { return false; }
  pauseMusic(): void {}
  resumeMusic(): void {}
  replayMusic(): void {}
  stopMusic(): void {}

  async playOneShot(_path: string, _volume?: number): Promise<void> {}
  async playSound(_path: string, _volume?: number, _loop?: boolean, _onStop?: () => void): Promise<number> { return -1; }
  switchSound(_isSwitch?: boolean): boolean { return false; }

  isSoundPlaying(_soundId: number): boolean { return false; }
  pauseSound(_soundId: number): void {}
  pauseAllSounds(): void {}
  resumeSound(_soundId: number): void {}
  resumeAllSounds(): void {}
  stopSound(_soundId: number): void {}
  stopAllSounds(): void {}

  releaseAllAudioClip(): void {}
}
