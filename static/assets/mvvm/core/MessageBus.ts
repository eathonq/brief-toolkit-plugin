/**
 * MessageBus.ts - 全局消息总线
 * @description 纯 TS 零依赖的全局静态发布/订阅。ViewModel 间解耦通信的唯一通道。
 *
 * @author eathonq
 * @license MIT
 * @version v2.0.0
 *
 * @created 2026-06-09
 * @modified 2026-06-10
 */

/** 订阅令牌，用于取消订阅 */
export interface SubscriptionToken {
  readonly event: string;
  readonly callback: Function;
}

/** 消息回调类型 */
export type MessageCallback<T = any> = (payload: T) => void;

const _events = new Map<string, Set<MessageCallback>>();
const _onceWrappers = new WeakMap<MessageCallback, MessageCallback>();

/**
 * 全局消息总线（全静态方法）
 *
 * VM 间解耦通信的唯一通道。单个回调异常不影响其他订阅者。
 *
 * @example
 * ```ts
 * MessageBus.emit('score-changed', 100);
 * MessageBus.on('score-changed', (score) => this.label = `${score}`);
 * const token = MessageBus.on('refresh', handler);
 * MessageBus.offByToken(token);
 * ```
 */
export class MessageBus {
  private constructor() { }

  /** 发送事件 */
  static emit<T = any>(name: string, payload?: T): void {
    const cbs = _events.get(name);
    if (!cbs || cbs.size === 0) return;
    for (const cb of [...cbs]) {
      try { cb(payload); } catch (e) {
        console.error(`[MessageBus] 事件 "${name}" 回调异常:`, e);
      }
    }
  }

  /** 订阅事件，返回令牌（用于 onDestroy 时解绑） */
  static on<T = any>(name: string, callback: MessageCallback<T>): SubscriptionToken {
    let cbs = _events.get(name);
    if (!cbs) { cbs = new Set(); _events.set(name, cbs); }
    cbs.add(callback as MessageCallback);
    return { event: name, callback };
  }

  /** 一次性订阅 */
  static once<T = any>(name: string, callback: MessageCallback<T>): SubscriptionToken {
    const wrapper: MessageCallback = (payload) => {
      MessageBus.off(name, wrapper);
      callback(payload);
    };
    _onceWrappers.set(callback as MessageCallback, wrapper);
    return MessageBus.on(name, wrapper);
  }

  /** 取消订阅 */
  static off(name: string, callback: Function): void {
    const cbs = _events.get(name);
    if (!cbs) return;
    const wrapper = _onceWrappers.get(callback as MessageCallback);
    cbs.delete((wrapper ?? callback) as MessageCallback);
    _onceWrappers.delete(callback as MessageCallback);
    if (cbs.size === 0) _events.delete(name);
  }

  /** 通过令牌取消 */
  static offByToken(token: SubscriptionToken): void {
    MessageBus.off(token.event, token.callback);
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
