/**
 * GuideManager.ts - 引导管理绑定组件
 * @description 该组件提供了引导任务的管理功能，包括任务的启动、加载和记录查询。
 * @important 在 Cocos Creator 中，通常挂载在场景根节点或常驻节点（如Canvas、RootNode）上。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/guide/guidemanager}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-01-30
 * @modified 2024-08-16
 */

import { _decorator, Node, Component, JsonAsset, Color } from "cc";
import { EDITOR } from "cc/env";
import { GuideTask, IGuideManager, StartTaskOptions } from "../core/IGuideManager";
import { GuideStepAction } from "../core/GuideStepAction";
import { Guider } from "../core/Guider";
import { GuideMaskController } from "../core/GuideMaskController";

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/** 引导管理 */
@ccclass('guide.GuideManager')
@help('https://vangagh.gitbook.io/brief-toolkit/guide/guidemanager')
@executeInEditMode
@menu('BriefToolkit/Guide/GuideManager')
export class GuideManager extends Component implements IGuideManager {
  @property({
    type: [JsonAsset],
    tooltip: "任务列表资源，Json格式，包含引导任务数据",
  })
  private jsonTasks: JsonAsset[] = [];

  private parseJsonTasks() {
    for (let i = 0; i < this.jsonTasks.length; i++) {
      let data: any = this.jsonTasks[i].json;
      if (data && data.key && data.steps) {
        this._taskMap.set(data.key, { ...data, index: 0 });
      }
    }
  }

  protected onLoad() {
    Guider.bind(this);

    this.initGuide();

    if (EDITOR) return;

    this.parseJsonTasks();
  }

  protected onEnable(): void {
    Guider.bind(this);
  }

  protected onDisable(): void {
    Guider.unbind(this);
  }

  private _stepAction: GuideStepAction = null;
  private initGuide() {
    if (EDITOR) return;

    const guideMask = new GuideMaskController(this.node, {
      maskColor: new Color(0, 0, 0, 180),
    });
    this._stepAction = new GuideStepAction(this.node, guideMask);
  }

  private _taskMap: Map<string, GuideTask> = new Map();

  /**
   * 开始任务
   * @param key 任务标识
   * @param options 任务选项
   * @return Promise<void> 任务完成的 Promise
   */
  async startTask(key: string, options?: StartTaskOptions): Promise<void> {
    const task = this._taskMap.get(key);
    if (!task) {
      console.warn("引导任务不存在！");
      return;
    }

    let currentStepIndex = options?.stepIndex ?? task.index ?? 0;

    while (currentStepIndex < task.steps.length) {
      const step = task.steps[currentStepIndex];
      await this._stepAction.runStep(step, options?.onFocusCallback);
      const nextIndex = currentStepIndex + 1;
      options?.onStepCallback?.(step, nextIndex);
      task.index = nextIndex;
      currentStepIndex = nextIndex;
    }
  }

  /**
   * 加载引导任务
   * @param task 引导任务
   */
  loadTask(task: GuideTask): void {
    this._taskMap.set(task.key, { ...task });
  }

  getTaskRecord(key: string): number | null {
    const task = this._taskMap.get(key);
    return task ? task.index : null;
  }
}
