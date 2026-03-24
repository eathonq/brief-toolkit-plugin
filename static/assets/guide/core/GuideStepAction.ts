/**
 * GuideStepAction.ts - 引导步骤动作
 * @description 该类负责执行引导步骤的具体操作，包括高亮目标节点和处理用户交互。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-01-30
 * @modified 2026-03-17
 */

import { Button, EditBox, Label, Node, PageView, ProgressBar, Slider, Sprite, Toggle, ToggleContainer } from "cc";
import { CCLocatorLoop } from "./CCLocatorLoop";
import { FocusCallback, GuideStep, IGuideMask } from "./IGuideManager";

type IdentifyElement = {
  component: any;
}

/**
 * 引导步骤动作
 * @param guideMask 引导遮罩
 * @info 负责执行引导步骤的具体操作，包括高亮目标节点和处理用户交互
 */
export class GuideStepAction {
  private readonly _elementRegistry: IdentifyElement[] = this.createElementRegister();
  private _rootNode: Node = null;
  private _guideMask: IGuideMask = null;

  private createElementRegister(): IdentifyElement[] {
    return [
      { component: Label },
      { component: EditBox },
      { component: Toggle },
      { component: Button },
      { component: Slider },
      { component: ProgressBar },
      { component: PageView },
      { component: Sprite },
      { component: ToggleContainer },
      { component: Node },
    ]
  }

  constructor(rootNode: Node, guideMask: IGuideMask) {
    this._rootNode = rootNode;
    this._guideMask = guideMask;
  }

  private async getNode(path: string) {
    const node = await CCLocatorLoop.locateNode(path, this._rootNode);
    if (!node) {
      console.error(`node not found: ${path}`);
    }
    return node;
  }

  private identifyComponent(node: Node) {
    const identifyList: IdentifyElement[] = [];
    for (const element of this._elementRegistry) {
      if (node.getComponent(element.component)) {
        identifyList.push(element);
      }
    }
    return identifyList;
  }

  async runStep(step: GuideStep, onFocusCallback?: FocusCallback) {
    const node = await this.getNode(step.target);
    if (!node) {
      console.warn(`引导步骤目标节点不存在，路径: ${step.target}`);
      return;
    }
    const identifyList = this.identifyComponent(node);
    if (identifyList.length === 0) {
      console.warn(`无法识别的引导目标组件，路径: ${step.target}`);
      return;
    }

    const firstIdentify = identifyList[0];
    switch (firstIdentify.component) {
      case Button:
        await this.doTouchEnd(node, step, onFocusCallback);
        break;
      case ToggleContainer:
        await this.doToggleGroupCheck(node, step, onFocusCallback);
        break;
      default:
        await this.doTouchEnd(node, step, onFocusCallback);
        break;
    }
  }

  private async doTouchEnd(node: Node, step: GuideStep, onFocusCallback?: FocusCallback) {
    return new Promise<void>((resolve) => {
      this._guideMask.focusOn(node, step, onFocusCallback);
      node.once(Node.EventType.TOUCH_END, () => {
        this._guideMask.clearFocus();
        resolve();
      });
    });
  }

  private async doToggleGroupCheck(node: Node, step: GuideStep, onFocusCallback?: FocusCallback) {
      return new Promise<void>((resolve) => {
        this._guideMask.focusOn(node, step, onFocusCallback);
        const toggleContainer = node.getComponent(ToggleContainer);
        if (!toggleContainer) {
          console.warn(`ToggleContainer component not found on node: ${node.name}`);
          resolve();
          return;
        }
        
        toggleContainer.node.once(Node.EventType.TOUCH_END, () => {
          this._guideMask.clearFocus();
          resolve();
        }
        , toggleContainer.node);
      });
  }

  // private async onToggleContainerCheckEvent(toggle: Toggle) {
  //   if (!toggle || !toggle.node) return;
  //   const parent: Node = toggle.node.parent;
  //   if (!parent) return;

  //   // 获取位置索引
  //   const index = parent.children.indexOf(toggle.node);
  //   if (index === -1) return;

  //   // 切换移动方式类型
  //   this._moveType = index;
  //   console.log(`切换移动方式类型: ${this._moveType}`);
  // }
}