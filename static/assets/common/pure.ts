/**
 * pure.ts - Common 纯 TS 入口（零 Cocos 依赖）
 * @description 可用于 ViewModel、单元测试、Node.js 脚本等非 Cocos 运行时环境。
 *              所有导出模块及其传递依赖均不包含 `from 'cc'` 导入。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-20
 * @modified 2026-06-30
 */

// ──────────── 统一事件总线 ────────────
export { EventBus } from './core/EventBus';
export type { SubscriptionToken, EventCallback } from './core/EventBus';

// ──────────── 网络请求工具（零 'cc' 依赖）────────────
export { httpClient } from './core/HttpClient';
export { HttpTemplate } from './core/HttpTemplate';
export { TokenManager } from './core/TokenManager';
export type { IHttp, IHttpConfig, IHttpInterceptor } from './core/HttpClient';
export type { IServerData, ResData, PaginateQuery, PaginatedResponse, ListSortItem } from './core/HttpTemplate';

// ──────────── WebSocket 客户端（零 'cc' 依赖）────────────
export { WebSocketClient, wsClient, WsReadyState } from './core/WebSocketClient';
export type { WsConfig, WsEventType, WsCallback, WsSubscription } from './core/WebSocketClient';
