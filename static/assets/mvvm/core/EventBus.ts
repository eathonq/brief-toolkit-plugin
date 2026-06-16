/**
 * EventBus.ts - VM 间事件总线（框架内部）
 * @description 纯 TS 零依赖的全局静态发布/订阅，ViewModel 间通信的底层实现。
 *              不对外导出，业务代码通过 BaseViewModel.emit() 发送、@event 接收。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-09
 * @modified 2026-06-16
 */

/** 订阅令牌，用于取消订阅 */
export interface SubscriptionToken {
  readonly event: string;
  readonly callback: Function;
}

/** 事件回调类型 */
export type EventCallback<T = any> = (payload: T) => void;

const _events = new Map<string, Set<EventCallback>>();
const _onceWrappers = new WeakMap<EventCallback, EventCallback>();

/**
 * VM 间事件总线（全静态方法，框架内部使用）
 *
 * 单个回调异常不影响其他订阅者。
 */
export class EventBus {
  private constructor() { }

  /** 发送事件 */
  static emit<T = any>(name: string, payload?: T): void {
    const cbs = _events.get(name);
    if (!cbs || cbs.size === 0) return;
    for (const cb of [...cbs]) {
      try { cb(payload); } catch (e) {
        console.error(`[EventBus] 事件 "${name}" 回调异常:`, e);
      }
    }
  }

  /** 订阅事件，返回令牌 */
  static on<T = any>(name: string, callback: EventCallback<T>): SubscriptionToken {
    let cbs = _events.get(name);
    if (!cbs) { cbs = new Set(); _events.set(name, cbs); }
    cbs.add(callback as EventCallback);
    return { event: name, callback };
  }

  /** 一次性订阅 */
  static once<T = any>(name: string, callback: EventCallback<T>): SubscriptionToken {
    const wrapper: EventCallback = (payload) => {
      EventBus.off(name, wrapper);
      callback(payload);
    };
    _onceWrappers.set(callback as EventCallback, wrapper);
    return EventBus.on(name, wrapper);
  }

  /** 取消订阅 */
  static off(name: string, callback: Function): void {
    const cbs = _events.get(name);
    if (!cbs) return;
    const wrapper = _onceWrappers.get(callback as EventCallback);
    cbs.delete((wrapper ?? callback) as EventCallback);
    _onceWrappers.delete(callback as EventCallback);
    if (cbs.size === 0) _events.delete(name);
  }

  /** 通过令牌取消 */
  static offByToken(token: SubscriptionToken): void {
    EventBus.off(token.event, token.callback);
  }

  /** 清空指定事件或全部 */
  static clear(name?: string): void {
    if (name) { _events.delete(name); } else { _events.clear(); }
  }

  /** 某事件的订阅者数量 */
  static subscriberCount(name: string): number {
    return _events.get(name)?.size ?? 0;
  }
}
