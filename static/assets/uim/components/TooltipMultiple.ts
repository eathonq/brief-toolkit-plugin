/**
 * TooltipMultiple.ts - 多提示框基础绑定组件
 * @description 该组件提供了多提示框的基础功能，包括显示多个提示框实例、管理提示框的显示顺序和关闭操作。
 * @important 继承于 ViewBase 默认提供的实现，也可以自己实现Tooltip的基础逻辑，挂载在自定义的提示框预制体。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/tooltipmultiple}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-29
 * @modified 2026-03-13
 */

import { _decorator, Component, Node, Enum, EventTouch, Label, Button, instantiate } from "cc";
import { VIEW_TYPE_TOOLTIP, ViewBase } from "./ViewBase";
import { TooltipData, ViewSortIndex } from "../core/IViewManager";
import { ViewEvent, ViewState, ViewType } from "../core/IViewManager";
import { EDITOR } from "cc/env";
import { VIEW_SORT_TOOLTIP } from "./ViewSort";

const { ccclass, help, menu, property } = _decorator;

/** 多提示框基础绑定组件 */
@ccclass('uim.TooltipMultiple')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/tooltipmultiple')
@menu('BriefToolkit/UIM/TooltipMultiple')
export class TooltipMultiple extends ViewBase {
  @property({
    type: Enum(ViewSortIndex),
    tooltip: VIEW_SORT_TOOLTIP,
    override: true,
    visible: false,
  })
  sortIndex: ViewSortIndex = ViewSortIndex.Tooltip;

  @property({
    type: Enum(ViewType),
    tooltip: VIEW_TYPE_TOOLTIP,
    override: true,
    readonly: true,
  })
  viewType: ViewType = ViewType.Tooltip;

  @property({
    tooltip: "是否缓存（关闭不删除）",
    override: true,
  })
  isCache: boolean = true;

  @property({
    type: Node,
    tooltip: "多内容模板",
  })
  template: Node = null!;

  @property({
    type: Button,
    tooltip: "关闭按钮",
  })
  close: Button = null!;

  @property({
    type: Label,
    tooltip: "内容文本",
  })
  content: Label = null!;

  protected onLoad(): void {
    super.onLoad();

    this.node.on(ViewEvent, (state: ViewState, data?: any) => {
      switch (state) {
        case ViewState.Show:
        case ViewState.Data:
          this.resetData(data);
          break;
        case ViewState.Hide:
        case ViewState.Close:
          break;
      }
    });

    this.initTemplate();
  }

  private getPath(node: Node, root: Node) {
    const path_list = [];
    let findItem = node;
    while (findItem && findItem.name !== 'Canvas') {
      if (findItem === root) {
        break;
      }
      else {
        path_list.push(findItem.name);
        findItem = findItem.parent;
      }
    }
    return path_list.reverse();
  }
  private getNode(path_list: string[], root: Node) {
    if (path_list.length === 0) return null;

    let findItem = root;
    for (let i = 0; i < path_list.length; i++) {
      const path = path_list[i];
      findItem = findItem.getChildByName(path);
      if (!findItem) return null;
    }
    return findItem;
  }
  private _closePath: string[] = [];
  private _contentPath: string[] = [];
  private initTemplate() {
    if (EDITOR) return;

    if (!this.template) return;

    // 查找所在路径
    if (this.close) {
      this._closePath = this.getPath(this.close.node, this.template);
    }
    if (this.content) {
      this._contentPath = this.getPath(this.content.node, this.template);
    }

    this.template.active = false;
  }

  private addItem(data: TooltipData) {
    if (!this.template) return;
    const item = instantiate(this.template);

    const onCloseItem = () => {
      item.removeFromParent();
      item.destroy();

      // 判断父类是否还有子节点
      if (this.template.parent.children.length === 1) {
        this.doClose?.(this.viewName);
      }
    };

    const labelNode = this.getNode(this._contentPath, item);
    const label = labelNode?.getComponent(Label);
    if (label) {
      label.string = data.content;
    }
    const buttonNode = this.getNode(this._closePath, item);
    const button = buttonNode?.getComponent(Button);
    if (button) {
      if (data.isClose) {
        button.node.on(Button.EventType.CLICK, (event: EventTouch) => {
          data.closeCallback?.();
          onCloseItem();
        }, this);
      }
      else {
        button.node.active = false;
      }
    }

    item.parent = this.template.parent;
    item.active = true;

    // 添加超时关闭
    if (data.timeout > 0) {
      data.timeoutCallback = () => {
        onCloseItem();
      };
    }
  }

  private resetData(data: TooltipData) {
    this.addItem(data);
  }

}
