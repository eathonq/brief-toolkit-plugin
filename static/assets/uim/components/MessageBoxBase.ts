/**
 * MessageBoxBase.ts - 消息框基础绑定组件
 * @description 该组件提供了消息框的基础功能，包括显示标题、内容和不同类型的按钮，并处理用户的交互结果。
 * @important 继承于 ViewBase 默认提供的实现，也可以自己实现MessageBox的基础逻辑，挂载在自定义的消息弹窗预制体。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/messageboxbase}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-28
 * @modified 2026-03-13
 */

import { _decorator, Component, Node, Enum, EventTouch, Label, Button } from "cc";
import { MessageBoxButtons, MessageBoxData, MessageBoxResult } from "../core/IViewManager";
import { VIEW_TYPE_TOOLTIP, ViewBase } from "./ViewBase";
import { ViewEvent, ViewState, ViewType } from "../core/IViewManager";

const { ccclass, help, menu, property } = _decorator;

/** 消息框基础绑定组件 */
@ccclass('uim.MessageBoxBase')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/messageboxbase')
@menu('BriefToolkit/UIM/MessageBoxBase')
export class MessageBoxBase extends ViewBase {
  @property({
    type: Enum(ViewType),
    tooltip: VIEW_TYPE_TOOLTIP,
    override: true,
    readonly: true,
  })
  viewType: ViewType = ViewType.MessageBox;

  @property({
    tooltip: "是否缓存（关闭不删除）",
    override: true,
  })
  isCache: boolean = true;

  @property({
    type: Label,
    tooltip: "标题文本",
  })
  title: Label = null!;

  @property({
    type: Button,
    tooltip: "顶部关闭按钮",
  })
  topClose: Button = null!;

  @property({
    type: Label,
    tooltip: "内容文本",
  })
  content: Label = null!;

  @property({
    type: Button,
    tooltip: "确定按钮",
  })
  ok: Button = null!;

  @property({
    type: Button,
    tooltip: "是按钮",
  })
  yes: Button = null!;

  @property({
    type: Button,
    tooltip: "否按钮",
  })
  no: Button = null!;

  @property({
    type: Button,
    tooltip: "取消按钮",
  })
  cancel: Button = null!;

  @property({
    type: Button,
    tooltip: "中止按钮",
  })
  abort: Button = null!;

  @property({
    type: Button,
    tooltip: "重试按钮",
  })
  retry: Button = null!;

  @property({
    type: Button,
    tooltip: "忽略按钮",
  })
  ignore: Button = null!;

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

    this.title.string = "";
    this.content.string = "";
  }

  /** 数据关闭回调 */
  private _callback: (result: MessageBoxResult) => void;
  private resetData(data: MessageBoxData) {
    // 设置回调
    if (this._callback) {
      // 直接返回结果
      data.resolve?.(MessageBoxResult.None);
      return;
    }
    else {
      this._callback = data.resolve;
    }

    // 默认数据恢复
    if (!data) data = {
      content: undefined,
      title: undefined,
      buttons: undefined,
      resolve: undefined
    };
    if (data.title === undefined) data.title = "Title";
    if (data.content === undefined) data.content = "content.";
    if (data.buttons === undefined) data.buttons = MessageBoxButtons.YesNoCancel;
    if (data.resolve === undefined) data.resolve = () => { };

    // 设置数据
    this.title.string = data.title;
    this.content.string = data.content;

    // 设置按钮
    const doSetActive = (button: Button, active: boolean) => {
      if (button) button.node.active = active;
    }
    switch (data.buttons) {
      case MessageBoxButtons.OK:
        doSetActive(this.ok, true);
        doSetActive(this.yes, false);
        doSetActive(this.no, false);
        doSetActive(this.cancel, false);
        doSetActive(this.abort, false);
        doSetActive(this.retry, false);
        doSetActive(this.ignore, false);
        // this._result = MessageBoxResult.OK;
        break;
      case MessageBoxButtons.OKCancel:
        doSetActive(this.ok, true);
        doSetActive(this.yes, false);
        doSetActive(this.no, false);
        doSetActive(this.cancel, true);
        doSetActive(this.abort, false);
        doSetActive(this.retry, false);
        doSetActive(this.ignore, false);
        // this._result = MessageBoxResult.Cancel;
        break;
      case MessageBoxButtons.YesNo:
        doSetActive(this.ok, false);
        doSetActive(this.yes, true);
        doSetActive(this.no, true);
        doSetActive(this.cancel, false);
        doSetActive(this.abort, false);
        doSetActive(this.retry, false);
        doSetActive(this.ignore, false);
        // this._result = MessageBoxResult.No;
        break;
      case MessageBoxButtons.YesNoCancel:
        doSetActive(this.ok, false);
        doSetActive(this.yes, true);
        doSetActive(this.no, true);
        doSetActive(this.cancel, true);
        doSetActive(this.abort, false);
        doSetActive(this.retry, false);
        doSetActive(this.ignore, false);
        // this._result = MessageBoxResult.Cancel;
        break;
      case MessageBoxButtons.AbortRetryIgnore:
        doSetActive(this.ok, false);
        doSetActive(this.yes, false);
        doSetActive(this.no, false);
        doSetActive(this.cancel, false);
        doSetActive(this.abort, true);
        doSetActive(this.retry, true);
        doSetActive(this.ignore, true);
        // this._result = MessageBoxResult.Ignore;
        break;
      default:
        doSetActive(this.ok, true);
        doSetActive(this.yes, false);
        doSetActive(this.no, false);
        doSetActive(this.cancel, false);
        doSetActive(this.abort, false);
        doSetActive(this.retry, false);
        doSetActive(this.ignore, false);
        // this._result = MessageBoxResult.None;
        break;
    }
  }

  private initButtonEvent() {
    const doSetEvent = (button: Button, result: MessageBoxResult) => {
      if (!button) return;
      button.node.off(Button.EventType.CLICK);
      button.node.on(Button.EventType.CLICK, (event: EventTouch) => {
        this._callback?.(result);
        this.doClose?.(this.viewName);
      }, this);
    }

    doSetEvent(this.ok, MessageBoxResult.OK);
    doSetEvent(this.yes, MessageBoxResult.Yes);
    doSetEvent(this.no, MessageBoxResult.No);
    doSetEvent(this.cancel, MessageBoxResult.Cancel);
    doSetEvent(this.abort, MessageBoxResult.Abort);
    doSetEvent(this.retry, MessageBoxResult.Retry);
    doSetEvent(this.ignore, MessageBoxResult.Ignore);

    doSetEvent(this.topClose, MessageBoxResult.None);
  }
}
