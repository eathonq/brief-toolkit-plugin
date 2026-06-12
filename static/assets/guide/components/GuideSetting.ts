/**
 * GuideSetting.ts - 引导配置组件 V2
 * @description 引导系统的编辑器配置挂载点，负责场景装配与生命周期管理。
 *              在 Cocos Creator 中，挂载在场景根节点或常驻节点（如 Canvas、RootNode）上。
 *
 *              V2 新增：聚焦样式配置（形状、动画类型、切换时长）。
 *
 * @author eathonq
 * @license MIT
 * @version v1.3.0
 *
 * @created 2023-01-30
 * @modified 2026-06-12
 */

import { _decorator, Component, JsonAsset, Color, Prefab, instantiate, Enum } from "cc";
import { EDITOR } from "cc/env";
import { GuideManager } from "../core/GuideManager";
import { GuideStepAction } from "../core/GuideStepAction";
import { GuideFocus } from "../core/GuideFocus";
import { GuideDialogBase } from "./GuideDialogBase";
import { GuidePointerBase } from "./GuidePointerBase";
import { GuideTask, FocusShape, FocusStyle } from "../core/IGuideManager";

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/** 聚焦形状枚举（编辑器面板显示中文） */
enum FocusShapeEnum {
  rectangle = 0,
  circle = 1,
  rounded_rect = 2,
  ellipse = 3,
}

/** 引导配置 */
@ccclass('guide.GuideSetting')
@help('https://vangagh.gitbook.io/brief-toolkit/guide/guidesetting')
@executeInEditMode
@menu('BriefToolkit/Guide/GuideSetting')
export class GuideSetting extends Component {

  @property({
    type: JsonAsset,
    tooltip: '引导任务配置文件，内容为 GuideTask {key, steps} 数据',
  })
  private guideConfig: JsonAsset | null = null;

  // ── 聚焦配置 ──

  @property({
    tooltip: '显示遮罩（关闭后镂空区域外无颜色遮挡）',
    displayName: 'Mask',
  })
  private enableMask: boolean = true;

  @property({
    tooltip: '遮罩颜色（默认半透明黑色）',
    visible() { return (this as any).enableMask; },
  })
  private maskColor: Color = new Color(0, 0, 0, 180);

  @property({
    type: Enum(FocusShapeEnum),
    tooltip: '聚焦窗口形状',
    visible() { return (this as any).enableMask; },
  })
  private focusShape: FocusShapeEnum = FocusShapeEnum.rectangle;

  @property({
    tooltip: '步骤切换动画时长（秒，0=无动画/snap）',
    displayName: 'Switch Duration',
    visible() { return (this as any).enableMask; },
  })
  private focusSwitchDuration: number = 0.5;

  @property({
    tooltip: '聚焦窗口外扩距离（px）',
    visible() { return (this as any).enableMask; },
  })
  private focusMargin: number = 8;

  @property({
    tooltip: '聚焦窗口与其它引导元素（对话框、指示器）的间距（px）',
  })
  private focusGap: number = 8;

  // ── 对话配置 ──

  @property({
    tooltip: '启用引导对话',
    displayName: 'Dialog',
  })
  private enableDialog: boolean = true;

  @property({
    type: Prefab,
    tooltip: '对话框节点（根节点需挂载继承自 GuideDialogBase 的自定义组件）',
    visible() { return (this as any).enableDialog; },
  })
  private dialogPrefab: Prefab | null = null;

  // ── 指示器配置 ──

  @property({
    tooltip: '启用引导指示器',
    displayName: 'Pointer',
  })
  private enablePointer: boolean = true;

  @property({
    type: Prefab,
    tooltip: '指示器 Prefab（根节点需挂载继承自 GuidePointerBase 的自定义组件）',
    visible() { return (this as any).enablePointer; },
  })
  private pointerPrefab: Prefab | null = null;

  // ── 生命周期 ──

  protected onLoad(): void {
    if (EDITOR) return;
    this.initGuide();
  }

  private initGuide(): void {
    // 构建聚焦样式
    const focusStyle: Partial<FocusStyle> = {
      shape: FocusShapeEnum[this.focusShape] as FocusShape,
      margin: this.focusMargin,
      maskColor: this.maskColor,
      switchDuration: this.focusSwitchDuration,
    };

    const guideFocus = new GuideFocus(this.node, {
      ...focusStyle,
      blockTouch: this.enableMask,
      showMask: this.enableMask,
    });

    // 对话
    let guideDialog: GuideDialogBase | undefined;
    if (this.enableDialog && this.dialogPrefab) {
      const dialogNode = instantiate(this.dialogPrefab);
      guideFocus.uiLayer.addChild(dialogNode);
      guideDialog = dialogNode.getComponent(GuideDialogBase) ?? undefined;
      if (guideDialog) {
        guideDialog.transitionDuration = this.focusSwitchDuration;
        guideDialog.guideGap = this.focusGap + (this.enableMask ? this.focusMargin : 0);
        guideDialog.hide();
      }
      else {
        console.warn('GuideSetting: guideDialog Prefab 根节点缺少 GuideDialogBase 组件');
      }
    }

    // 指示器
    let guidePointer: GuidePointerBase | undefined;
    if (this.enablePointer && this.pointerPrefab) {
      const pointerNode = instantiate(this.pointerPrefab);
      guideFocus.uiLayer.addChild(pointerNode);
      guidePointer = pointerNode.getComponent(GuidePointerBase) ?? undefined;
      if (guidePointer) {
        guidePointer.transitionDuration = this.focusSwitchDuration;
        guidePointer.guideGap = this.focusGap + (this.enableMask ? this.focusMargin : 0);
        guidePointer.hide();
      }
      else {
        console.warn('GuideSetting: guidePointer Prefab 根节点缺少 GuidePointerBase 组件');
      }
    }

    // 步骤动作
    const stepAction = new GuideStepAction(this.node, guideFocus, guideDialog, guidePointer);

    // 配置校验
    if (!this.guideConfig) {
      console.warn('GuideSetting: 引导配置文件未设置');
      return;
    }
    const task: GuideTask = this.guideConfig.json as GuideTask;
    if (!task.key || !task.steps) {
      console.warn('GuideSetting: 引导配置文件格式无效，缺少 key 或 steps');
      return;
    }

    GuideManager.instance.setup(task, stepAction);
  }

  /**
   * 开始引导（供 UI 按钮事件绑定）
   *
   * Cocos 按钮 ClickEvent 签名：handler(event, customData: string)
   * customData 可填入起始步骤索引（如 "0"），不填则从上次进度开始
   */
  async onStartGuide(_event?: any, customData?: string): Promise<void> {
    const stepIndex = customData ? parseInt(customData) : undefined;
    const result = await GuideManager.instance.startTask(stepIndex);
    console.log(`[Guide] ${result.completed ? '完成' : '中断'}，进度: ${result.stoppedAt}/${result.totalSteps}`);
  }
}
