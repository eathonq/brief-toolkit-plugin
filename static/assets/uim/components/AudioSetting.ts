/**
 * AudioSetting.ts - 音频配置组件（可选）
 * @description 可选的编辑器便利组件，用于在场景节点上配置默认背景音乐。
 *              AudioManager 已是全局单例且自举绑定 Audios，无需依赖此组件即可工作。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2023-02-28
 * @modified 2026-06-10
 */

import { _decorator, Component, AudioClip } from "cc";
import { AudioManager } from "../core/AudioManager";
const { ccclass, help, menu, property } = _decorator;

/** 音频配置组件（可选） */
@ccclass('uim.AudioSetting')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/audiomanager')
@menu('BriefToolkit/UIM/AudioSetting')
export class AudioSetting extends Component {
  @property({ type: AudioClip, tooltip: "默认背景音乐文件" })
  private musicClip: AudioClip = null!;

  @property({ tooltip: "启动播放背景音乐" })

  private playOnLoad: boolean = false;

  protected onLoad(): void {
    AudioManager.instance.applySetting(this.musicClip, this.playOnLoad);
  }
}
