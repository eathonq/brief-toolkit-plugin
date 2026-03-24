/**
 * IAudioManager.ts - 音频管理接口
 * @description 该接口定义了音频管理的功能，包括播放、暂停、停止等操作。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-13
 * @modified 2026-03-13
 */

export interface IAudioManager {
  /**
   * 播放背景音乐，（对于同一个背景音乐，如果音频处于正在播放状态，将不做处理。 如果音频处于暂停状态，则会继续播放音频。）
  * @param path 音频路径（不包含后缀，相对路径从resources子目录算起），不传则使用默认背景音乐
   * @param loop 是否循环（默认循环）
   * @returns 
   */
  playMusic(path?: string, loop?: boolean): Promise<void>;

  /**
   * 转换音乐播放开关
   * @param isSwitch true:开，false:关闭，不传则切换
   * @returns 返回当前音乐播放开关状态
   */
  switchMusic(isSwitch?: boolean): boolean;

  /** 音乐播放开关状态 */
  readonly musicSwitch: boolean;

  /** 音乐音量，范围0-1 */
  musicVolume: number;

  /** 音乐是否正在播放 */
  readonly isMusicPlaying: boolean;

  /** 暂停背景音乐 */
  pauseMusic(): void;
  /** 继续播放背景音乐 */
  resumeMusic(): void;
  /** 继续播放所有背景音乐 */
  replayMusic(): void;
  /** 停止背景音乐 */
  stopMusic(): void;

  /** 
   * 以指定音量倍数播放一个音频一次（过程不再接管）
   * @param path 音频路径（不包含后缀，相对路径从resources子目录算起）
   * @param volume 音量倍数（0.0 ~ 1.0）, 不传则使用默认音量
   */
  playOneShot(path: string, volume?: number): Promise<void>;
  /**
   * 播放音效
   * @param path 音频路径（不包含后缀，相对路径从resources子目录算起）
   * @param volume 音量倍数（0.0 ~ 1.0）, 不传则使用默认音量
   * @param loop 是否循环（默认不循环）, 不传则使用默认值 false
   * @param onStop 停止播放回调
  * @returns Promise<number> 音效id, 用于后续管理（返回-1表示播放失败）
   */
  playSound(path: string, volume?: number, loop?: boolean, onStop?: () => void): Promise<number>;

  /**
   * 转换音效播放开关(仅关闭正在播放的音效)
   * @param isSwitch true:开，false:关闭，不传则切换
   * @returns 
   */
  switchSound(isSwitch?: boolean): boolean;

  /** 音效播放开关状态 */
  readonly soundSwitch: boolean;
  /** 音效音量，范围0-1 */
  soundVolume: number;

  /** 
   * 判断指定音效是否正在播放
   * @param soundId 音效id（playSound方法的返回值）
   * @return 是否正在播放
   */
  isSoundPlaying(soundId: number): boolean;
  /**
   * 暂停指定音效
   * @param soundId 音效id（playSound方法的返回值）
   */
  pauseSound(soundId: number): void;
  /** 暂停所有正在播放的音效 */
  pauseAllSounds(): void;
  /**
   * 继续播放指定音效
   * @param soundId 音效id（playSound方法的返回值）
   */
  resumeSound(soundId: number): void;
  /** 继续播放所有暂停的音效 */
  resumeAllSounds(): void;
  /**
   * 停止指定音效
   * @param soundId 音效id（playSound方法的返回值）
   */
  stopSound(soundId: number): void;
  /** 停止所有正在播放的音效 */
  stopAllSounds(): void;

  /** 释放所有音频资源 */
  releaseAllAudioClip(): void;
}