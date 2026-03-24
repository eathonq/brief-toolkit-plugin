/**
 * TooltipBase.ts - 提示框基础绑定组件
 * @description 该组件提供了提示框的基础功能，包括显示内容文本、关闭按钮，并处理用户的交互结果。
 * @important 继承于 ViewBase 默认提供的实现，也可以自己实现Tooltip的基础逻辑，挂载在自定义的提示框预制体。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/tooltipbase}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-28
 * @modified 2024-08-30
 */

import { _decorator, Component, Node, Enum, EventTouch, Label, Button, UITransform } from "cc";
import { VIEW_TYPE_TOOLTIP, ViewBase } from "./ViewBase";
import { ViewEvent, ViewState, ViewType } from "../core/IViewManager";
import { TooltipData } from "../core/IViewManager";

const { ccclass, help, menu, property } = _decorator;

/** 提示框基础绑定组件 */
@ccclass('uim.TooltipBase')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/tooltipbase')
@menu('BriefToolkit/UIM/TooltipBase')
export class TooltipBase extends ViewBase {
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

    this.initButtonEvent();
  }

  protected onDisable(): void {
    super.onDisable?.();

    this._callback = null;

    this.content.string = "";
    // 清空数据（解决界面闪烁问题）
    this.content.node.getComponent(UITransform)?.setContentSize(0, 0);
  }

  /** 数据关闭回调 */
  private _callback: () => void;
  private resetData(data: TooltipData) {
    // 默认数据恢复
    if (!data) data = {
      content: undefined,
      isClose: undefined,
      closeCallback: undefined,
    };
    if (data.content === undefined) data.content = "content.";
    if (data.isClose === undefined) data.isClose = false;
    if (data.closeCallback === undefined) data.closeCallback = () => { };

    // 设置数据
    this.content.string = data.content;
    if (this.close) {
      this.close.node.active = data.isClose;
    }

    // 设置关闭回调
    if (this._callback) {
      this._callback();// 提前执行上次关闭回调
    }
    this._callback = data.closeCallback;

    // 设置超时回调
    if (data.timeout > 0) {
      data.timeoutCallback = () => {
        this.doClose?.(this.viewName);
      };
    }
  }

  private initButtonEvent() {
    if (!this.close) return;

    const doSetEvent = (button: Button) => {
      if (!button) return;
      button.node.on(Button.EventType.CLICK, (event: EventTouch) => {
        this._callback?.();
        this.doClose?.(this.viewName);
      });
    }
    doSetEvent(this.close);
  }

}
