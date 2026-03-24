/**
 * ViewBase.ts - 视图基础绑定组件
 * @description 该组件提供了视图的基础功能，包括视图类型、缓存选项和基本的关闭/返回事件处理，为其他具体视图组件提供统一的基础。
 * @important 继承于 ViewSort 默认提供的实现，也可以自己实现View的基础逻辑，挂载在自定义的视图预制体。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/viewbase}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-02-06
 * @modified 2024-08-31
 */

import { _decorator, Component, Node, Enum, EventTouch, Label } from "cc";
import { EDITOR } from "cc/env";
import { ViewSortIndex, ViewType } from "../core/IViewManager";
import { ViewSort } from "./ViewSort";

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

export const VIEW_TYPE_TOOLTIP =
  "视图类型:\n" +
  "  View: 全屏视图(显示将关闭其他视图)\n" +
  "  MessageBox: 消息框(显示在View上层)\n" +
  "  Tooltip: 提示框(显示在最上层)";

/** 视图基础绑定组件 */
@ccclass('uim.ViewBase')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/viewbase')
@executeInEditMode
@menu('BriefToolkit/UIM/ViewBase')
export class ViewBase extends ViewSort {
  @property({
    tooltip: "视图名称",
  })
  viewName: string = "";

  @property({
    type: Enum(ViewType),
    tooltip: VIEW_TYPE_TOOLTIP,
  })
  viewType: ViewType = ViewType.View;

  @property({
    tooltip: "是否缓存（关闭不删除）",
  })
  isCache: boolean = false;

  //#region EDITOR
  onRestore() {
    this.checkEditorComponent(true);
  }

  private checkEditorComponent(isTitle = false) {
    if (this.viewName == "") {
      this.viewName = this.node.name;
    }
    if (isTitle) {
      let titleNode = this.node.getChildByName("Title");
      if (!titleNode) return;
      let title = titleNode.getComponent(Label);
      if (title) {
        title.string = this.viewName.toLocaleLowerCase();
      }
    }
  }

  //#endregion

  protected onLoad() {
    if (EDITOR) {
      this.checkEditorComponent();
      return;
    }

    switch (this.viewType) {
      case ViewType.View:
        this.sortIndex = ViewSortIndex.View;
        break;
      case ViewType.MessageBox:
        this.sortIndex = ViewSortIndex.MessageBox;
        break;
      case ViewType.Tooltip:
        this.sortIndex = ViewSortIndex.Tooltip;
        break;
      default:
        this.sortIndex = ViewSortIndex.View;
        break;
    }
  }

  protected doClose: (name: string, data?: any) => void = null;
  onCloseEvent(event: EventTouch, customEventData: string) {
    this.doClose?.(this.viewName);
  }

  protected doBack: () => void = null;
  onBackEvent(event: EventTouch, customEventData: string) {
    this.doBack?.();
  }
}