/**
 * WebSocketClient.ts - WebSocket 客户端封装
 * @description 基于标准 WebSocket API 的异步风格客户端（Cocos Creator 3.8.8 全平台内置适配层，
 *              小游戏平台内部转发至 wx.connectSocket / tt.connectSocket）。
 *
 *              核心能力：
 *              - Promise 风格 connect / send / request（RPC 请求-响应）
 *              - 事件订阅（open / close / error / message / reconnecting）
 *              - 应用层心跳保活（ping/pong）
 *              - 断线自动重连（指数退避 + 随机抖动）
 *
 *              零 'cc' 依赖，可直接进入 pure.ts。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-30
 */

// ──────────── 类型定义 ────────────

/** WebSocket 就绪状态 */
export enum WsReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

/** 事件类型 */
export type WsEventType = 'open' | 'close' | 'error' | 'message' | 'reconnecting';

/** 事件回调 */
export type WsCallback<T = any> = (payload: T) => void;

/** 订阅令牌 */
export interface WsSubscription {
  readonly event: WsEventType;
  readonly callback: Function;
}

/** WebSocket 配置 */
export interface WsConfig {
  /** 连接地址（ws:// 或 wss://） */
  url?: string;
  /** 子协议 */
  protocols?: string | string[];
  /**
   * 心跳间隔（ms），0 表示禁用心跳
   * @default 30000
   */
  heartbeatInterval?: number;
  /**
   * 心跳超时（ms），超过此时长未收到 pong 视为断线
   * @default 5000
   */
  heartbeatTimeout?: number;
  /**
   * 是否启用断线自动重连
   * @default true
   */
  reconnect?: boolean;
  /**
   * 重连基础间隔（ms）
   * @default 1000
   */
  reconnectBaseInterval?: number;
  /**
   * 重连最大间隔（ms）
   * @default 30000
   */
  reconnectMaxDelay?: number;
  /**
   * 最大重连次数，-1 表示无限
   * @default -1
   */
  reconnectMaxAttempts?: number;
  /**
   * 重连退避指数
   * @default 1.5
   */
  reconnectDecay?: number;
  /**
   * 连接超时（ms）
   * @default 10000
   */
  connectTimeout?: number;
  /**
   * request() 默认超时（ms）
   * @default 10000
   */
  requestTimeout?: number;
}

// ──────────── 内部常量 ────────────

/** 心跳消息 key */
const PING_KEY = '__ws_ping';
const PONG_KEY = '__ws_pong';
const TS_KEY = '__ws_ts';

/** 请求-响应 key */
const REQ_ID_KEY = '__ws_reqId';

/** 默认配置（非 undefined 字段） */
const DEFAULTS = {
  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,
  reconnect: true,
  reconnectBaseInterval: 1000,
  reconnectMaxDelay: 30000,
  reconnectMaxAttempts: -1,
  reconnectDecay: 1.5,
  connectTimeout: 10000,
  requestTimeout: 10000,
};

/** 生成唯一请求 ID */
let _reqCounter = 0;
function _genReqId(): string {
  _reqCounter += 1;
  return `r${_reqCounter}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

/** 计算重连延迟（指数退避 + 抖动） */
function _calcReconnectDelay(
  attempt: number,
  base: number,
  max: number,
  decay: number,
): number {
  const raw = base * Math.pow(decay, attempt);
  // ±20% 随机抖动，避免惊群效应
  const jitter = raw * 0.2 * (Math.random() * 2 - 1);
  return Math.min(raw + jitter, max);
}

// ──────────── Pending Request ────────────

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

// ──────────── 实现 ────────────

/**
 * WebSocket 客户端
 *
 * 使用示例：
 * ```typescript
 * const ws = new WebSocketClient({ url: 'ws://localhost:8080' });
 *
 * // 订阅
 * ws.on('message', (data) => console.log('收到:', data));
 * ws.on('reconnecting', (attempt) => console.log(`重连第 ${attempt} 次`));
 *
 * // 连接
 * await ws.connect();
 *
 * // 发送
 * ws.send({ type: 'chat', text: 'hello' });
 *
 * // RPC 风格请求-响应
 * const reply = await ws.request({ type: 'getUser', uid: 1 }, 5000);
 *
 * // 断开（不重连）
 * ws.disconnect();
 * ```
 */
export class WebSocketClient {
  // ────── 配置 ──────

  private _url: string = '';
  private _protocols: string | string[] = '';
  private _heartbeatInterval: number = DEFAULTS.heartbeatInterval;
  private _heartbeatTimeout: number = DEFAULTS.heartbeatTimeout;
  private _reconnect: boolean = DEFAULTS.reconnect;
  private _reconnectBaseInterval: number = DEFAULTS.reconnectBaseInterval;
  private _reconnectMaxDelay: number = DEFAULTS.reconnectMaxDelay;
  private _reconnectMaxAttempts: number = DEFAULTS.reconnectMaxAttempts;
  private _reconnectDecay: number = DEFAULTS.reconnectDecay;
  private _connectTimeout: number = DEFAULTS.connectTimeout;
  private _requestTimeout: number = DEFAULTS.requestTimeout;

  // ────── 运行时状态 ──────

  private _ws: WebSocket | null = null;
  private _readyState: WsReadyState = WsReadyState.CLOSED;
  private _intentionalClose: boolean = false;

  // connect() Promise 控制
  private _connectResolve: (() => void) | null = null;
  private _connectReject: ((e: any) => void) | null = null;
  private _connectTimer: ReturnType<typeof setTimeout> | null = null;

  // 心跳
  private _heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private _heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  // 重连
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempt: number = 0;

  // RPC 请求-响应
  private _pendingRequests: Map<string, PendingRequest> = new Map();

  // 事件订阅
  private _subscribers: Map<WsEventType, Set<Function>> = new Map();

  // ────── 构造 ──────

  constructor(config?: WsConfig) {
    if (config) this._applyConfig(config);
  }

  /** 更新配置（仅对下一次 connect 生效） */
  configure(config: WsConfig): void {
    this._applyConfig(config);
  }

  private _applyConfig(config: WsConfig): void {
    if (config.url !== undefined) this._url = config.url;
    if (config.protocols !== undefined) this._protocols = config.protocols;
    if (config.heartbeatInterval !== undefined) this._heartbeatInterval = config.heartbeatInterval;
    if (config.heartbeatTimeout !== undefined) this._heartbeatTimeout = config.heartbeatTimeout;
    if (config.reconnect !== undefined) this._reconnect = config.reconnect;
    if (config.reconnectBaseInterval !== undefined) this._reconnectBaseInterval = config.reconnectBaseInterval;
    if (config.reconnectMaxDelay !== undefined) this._reconnectMaxDelay = config.reconnectMaxDelay;
    if (config.reconnectMaxAttempts !== undefined) this._reconnectMaxAttempts = config.reconnectMaxAttempts;
    if (config.reconnectDecay !== undefined) this._reconnectDecay = config.reconnectDecay;
    if (config.connectTimeout !== undefined) this._connectTimeout = config.connectTimeout;
    if (config.requestTimeout !== undefined) this._requestTimeout = config.requestTimeout;
  }

  // ────── 属性 ──────

  /** 当前就绪状态 */
  get readyState(): WsReadyState {
    return this._readyState;
  }

  /** 是否已连接 */
  get isConnected(): boolean {
    return this._readyState === WsReadyState.OPEN && this._ws !== null;
  }

  // ────── 事件订阅 ──────

  /**
   * 订阅事件
   * @returns 订阅令牌，用于取消
   */
  on(event: WsEventType, callback: Function): WsSubscription {
    let cbs = this._subscribers.get(event);
    if (!cbs) {
      cbs = new Set();
      this._subscribers.set(event, cbs);
    }
    cbs.add(callback);
    return { event, callback };
  }

  /** 取消订阅 */
  off(subscription: WsSubscription): void {
    const cbs = this._subscribers.get(subscription.event);
    if (!cbs) return;
    cbs.delete(subscription.callback);
    if (cbs.size === 0) this._subscribers.delete(subscription.event);
  }

  // ────── 生命周期 ──────

  /**
   * 建立 WebSocket 连接
   * @param url 可选，覆盖配置中的 url
   */
  connect(url?: string): Promise<void> {
    if (url) this._url = url;

    if (!this._url) {
      return Promise.reject(new Error('[WebSocketClient] url 未设置'));
    }

    // 如果已连接，先断开
    if (this._ws) {
      this._cleanupSocket();
    }

    this._intentionalClose = false;
    this._readyState = WsReadyState.CONNECTING;

    return new Promise((resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject = reject;

      // 连接超时
      if (this._connectTimeout > 0) {
        this._connectTimer = setTimeout(() => {
          this._onConnectTimeout();
        }, this._connectTimeout);
      }

      try {
        if (this._protocols && this._protocols.length > 0) {
          this._ws = new WebSocket(this._url, this._protocols);
        } else {
          this._ws = new WebSocket(this._url);
        }
      } catch (e) {
        this._handleConnectError(new Error(`[WebSocketClient] 创建连接失败: ${e}`));
        return;
      }

      this._ws.onopen = () => this._onOpen();
      this._ws.onmessage = (event: MessageEvent) => this._onMessage(event);
      this._ws.onclose = (event: CloseEvent) => this._onClose(event);
      this._ws.onerror = () => this._onError();
    });
  }

  /**
   * 主动断开连接（不会触发重连）
   */
  disconnect(code?: number, reason?: string): void {
    this._intentionalClose = true;
    this._cancelReconnect();
    this._stopHeartbeat();
    this._rejectAllPending('Connection closed');

    if (this._ws) {
      try {
        this._ws.close(code || 1000, reason || '');
      } catch (_) { /* ignore */ }
    }

    this._cleanupSocket();
    this._readyState = WsReadyState.CLOSED;
  }

  /**
   * 销毁实例：断开连接 + 清空所有订阅 + 清空所有定时器
   */
  destroy(): void {
    this.disconnect();
    this._subscribers.clear();
    this._pendingRequests.clear();
  }

  // ────── 发送 ──────

  /**
   * 发送消息（纯字符串或可序列化对象）
   * @throws 未连接时抛出错误
   */
  send(data: any): void {
    if (!this.isConnected || !this._ws) {
      throw new Error('[WebSocketClient] 未连接，无法发送');
    }
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    this._ws.send(raw);
  }

  /**
   * RPC 风格请求-响应：发送带唯一 ID 的消息，等待匹配 ID 的响应
   * @param data     请求数据
   * @param timeout  超时（ms），默认使用配置中的 requestTimeout
   * @returns 匹配的响应数据（不含 __ws_reqId 字段）
   */
  request(data: any, timeout?: number): Promise<any> {
    if (!this.isConnected || !this._ws) {
      return Promise.reject(new Error('[WebSocketClient] 未连接，无法发送'));
    }

    const reqId = _genReqId();
    const to = timeout !== undefined ? timeout : this._requestTimeout;

    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      if (to > 0) {
        timer = setTimeout(() => {
          this._pendingRequests.delete(reqId);
          reject(new Error(`[WebSocketClient] 请求超时 (${to}ms)`));
        }, to);
      }

      this._pendingRequests.set(reqId, { resolve, reject, timer });

      try {
        const payload = typeof data === 'string'
          ? JSON.stringify({ [REQ_ID_KEY]: reqId, _body: data })
          : JSON.stringify({ [REQ_ID_KEY]: reqId, ...data });
        this._ws!.send(payload);
      } catch (e) {
        const pending = this._pendingRequests.get(reqId);
        if (pending) {
          if (pending.timer) clearTimeout(pending.timer);
          this._pendingRequests.delete(reqId);
        }
        reject(e);
      }
    });
  }

  // ────── 内部：WebSocket 事件处理 ──────

  private _onOpen(): void {
    this._clearConnectTimer();
    this._readyState = WsReadyState.OPEN;
    this._reconnectAttempt = 0;

    // 启动心跳
    this._startHeartbeat();

    // 通知连接成功
    if (this._connectResolve) {
      this._connectResolve();
      this._connectResolve = null;
      this._connectReject = null;
    }

    // 触发订阅
    this._emit('open');
  }

  private _onMessage(event: MessageEvent): void {
    let data: any;
    try {
      data = JSON.parse(event.data);
    } catch {
      // 非 JSON 数据，直接传递
      data = event.data;
    }

    // 1) 心跳响应
    if (data && data[PONG_KEY] === true) {
      this._onPong();
      return;
    }

    // 2) 服务器主动 ping → 回复 pong
    if (data && data[PING_KEY] === true) {
      this._sendPong(data[TS_KEY]);
      return;
    }

    // 3) 请求-响应匹配
    if (data && data[REQ_ID_KEY] && this._pendingRequests.has(data[REQ_ID_KEY])) {
      const pending = this._pendingRequests.get(data[REQ_ID_KEY])!;
      if (pending.timer) clearTimeout(pending.timer);
      this._pendingRequests.delete(data[REQ_ID_KEY]);
      pending.resolve(data);
      return;
    }

    // 4) 普通消息 → 触发订阅
    this._emit('message', data);
  }

  private _onClose(event: CloseEvent): void {
    this._stopHeartbeat();
    this._clearConnectTimer();

    // connect() 尚未完成
    if (this._connectReject) {
      this._connectReject(new Error(`[WebSocketClient] 连接关闭 (code: ${event.code})`));
      this._connectResolve = null;
      this._connectReject = null;
    }

    // 关闭前的 pending 请求全部拒绝
    this._rejectAllPending('Connection closed');

    this._readyState = WsReadyState.CLOSED;

    // 触发订阅
    this._emit('close', { code: event.code, reason: event.reason });

    // 非主动断开 → 尝试重连
    if (!this._intentionalClose && this._reconnect) {
      this._scheduleReconnect();
    }
  }

  private _onError(): void {
    this._emit('error', new Error('[WebSocketClient] 连接错误'));
  }

  // ────── 内部：连接超时 ──────

  private _onConnectTimeout(): void {
    this._clearConnectTimer();

    if (this._ws) {
      try { this._ws.close(1000, 'Connect timeout'); } catch (_) { /* ignore */ }
      this._cleanupSocket();
    }

    const err = new Error(`[WebSocketClient] 连接超时 (${this._connectTimeout}ms)`);
    if (this._connectReject) {
      this._connectReject(err);
      this._connectResolve = null;
      this._connectReject = null;
    }

    this._readyState = WsReadyState.CLOSED;

    // 尝试重连
    if (!this._intentionalClose && this._reconnect) {
      this._scheduleReconnect();
    }
  }

  private _handleConnectError(err: Error): void {
    this._clearConnectTimer();
    if (this._connectReject) {
      this._connectReject(err);
      this._connectResolve = null;
      this._connectReject = null;
    }
    this._readyState = WsReadyState.CLOSED;

    if (!this._intentionalClose && this._reconnect) {
      this._scheduleReconnect();
    }
  }

  // ────── 内部：心跳 ──────

  private _startHeartbeat(): void {
    this._stopHeartbeat();

    if (this._heartbeatInterval <= 0) return;

    this._heartbeatTimer = setInterval(() => {
      this._sendPing();
    }, this._heartbeatInterval);

    // 立即发送一次
    this._sendPing();
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._heartbeatTimeoutTimer) {
      clearTimeout(this._heartbeatTimeoutTimer);
      this._heartbeatTimeoutTimer = null;
    }
  }

  private _sendPing(): void {
    if (!this.isConnected || !this._ws) return;

    const ts = Date.now();
    try {
      this._ws.send(JSON.stringify({ [PING_KEY]: true, [TS_KEY]: ts }));
    } catch (_) {
      return;
    }

    // 设置 pong 超时
    if (this._heartbeatTimeout > 0) {
      if (this._heartbeatTimeoutTimer) clearTimeout(this._heartbeatTimeoutTimer);
      this._heartbeatTimeoutTimer = setTimeout(() => {
        this._onHeartbeatTimeout();
      }, this._heartbeatTimeout);
    }
  }

  private _sendPong(ts?: number): void {
    if (!this.isConnected || !this._ws) return;
    try {
      this._ws.send(JSON.stringify({ [PONG_KEY]: true, [TS_KEY]: ts || Date.now() }));
    } catch (_) {
      // ignore
    }
  }

  private _onPong(): void {
    // 收到 pong → 清除超时
    if (this._heartbeatTimeoutTimer) {
      clearTimeout(this._heartbeatTimeoutTimer);
      this._heartbeatTimeoutTimer = null;
    }
  }

  private _onHeartbeatTimeout(): void {
    // 心跳超时 → 视为断线
    if (this._ws) {
      try { this._ws.close(1000, 'Heartbeat timeout'); } catch (_) { /* ignore */ }
      this._cleanupSocket();
    }

    this._readyState = WsReadyState.CLOSED;
    this._stopHeartbeat();
    this._rejectAllPending('Heartbeat timeout');

    // 触发重连
    if (!this._intentionalClose && this._reconnect) {
      this._scheduleReconnect();
    }
  }

  // ────── 内部：重连 ──────

  private _scheduleReconnect(): void {
    this._cancelReconnect();

    const maxAttempts = this._reconnectMaxAttempts;
    // -1 表示无限
    if (maxAttempts !== -1 && this._reconnectAttempt >= maxAttempts) {
      this._emit('error', new Error(`[WebSocketClient] 重连失败：已达最大重连次数 (${maxAttempts})`));
      return;
    }

    const delay = _calcReconnectDelay(
      this._reconnectAttempt,
      this._reconnectBaseInterval,
      this._reconnectMaxDelay,
      this._reconnectDecay,
    );

    this._reconnectAttempt += 1;
    this._emit('reconnecting', this._reconnectAttempt);

    this._reconnectTimer = setTimeout(() => {
      this._doReconnect();
    }, delay);
  }

  private async _doReconnect(): Promise<void> {
    this._reconnectTimer = null;

    try {
      this.connect().then(() => {
        // 重连成功（_onOpen 中已处理: reset attempt, start heartbeat）
      }).catch(() => {
        // 重连失败 → 继续尝试
        if (!this._intentionalClose && this._reconnect) {
          this._scheduleReconnect();
        }
      });
    } catch (_) {
      if (!this._intentionalClose && this._reconnect) {
        this._scheduleReconnect();
      }
    }
  }

  private _cancelReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  // ────── 内部：清理 ──────

  private _cleanupSocket(): void {
    if (this._ws) {
      // 移除事件引用，避免内存泄漏
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onclose = null;
      this._ws.onerror = null;
      this._ws = null;
    }
  }

  private _clearConnectTimer(): void {
    if (this._connectTimer) {
      clearTimeout(this._connectTimer);
      this._connectTimer = null;
    }
  }

  private _rejectAllPending(reason: string): void {
    this._pendingRequests.forEach((pending) => {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error(`[WebSocketClient] ${reason}`));
    });
    this._pendingRequests.clear();
  }

  // ────── 内部：事件触发 ──────

  private _emit(event: WsEventType, payload?: any): void {
    const cbs = this._subscribers.get(event);
    if (!cbs || cbs.size === 0) return;
    // 遍历副本，防止回调中修改订阅集合
    const snapshot = Array.from(cbs);
    for (const cb of snapshot) {
      try {
        cb(payload);
      } catch (e) {
        console.error(`[WebSocketClient] 事件 "${event}" 回调异常:`, e);
      }
    }
  }
}

/** 全局单例 —— 大多数场景一个 WebSocket 连接即可 */
export const wsClient = new WebSocketClient();
