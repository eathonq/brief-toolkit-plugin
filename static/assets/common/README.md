# Common — 公共资源 & 网络管理模块

> `brief-toolkit` 的统一资源加载与生命周期管理层 + 通用 HTTP/WebSocket 网络工具集。提供 `CCAssets` 底层加载器 + `AssetScope` 作用域追踪 + `AssetScopeManager` 场景级自动管理 + `AssetScopeMount` 零代码接入组件，以及基于 `XMLHttpRequest` / `WebSocket` 的全平台网络请求封装。

---

## 架构层次

```
组件层    CCElement   I18nSprite   SkinSprite   AudioManager   ...
              │            │            │            │
              ▼            ▼            ▼            ▼
管理层    AssetScopeManager (scene-scoped)          AssetScope (module-scoped, 自管)
              │            │                          │
              ▼            ▼                          ▼
作用域层  AssetScope (场景 push/pop 自动创建)    AssetScope (I18nManager / AudioManager 自管)
              │                                      │
              ▼                                      ▼
加载层    CCAssets (纯静态加载器, 路径解析 + bundle 管理 + 远程缓存)
              │
              ▼
引擎层    Cocos assetManager / bundle
```

---

## 模块组成

### CCAssets — 底层资源加载器

纯静态方法类，负责路径解析、bundle 管理、远程缓存。**不做 UI 操作，不做生命周期追踪。**

| 方法 | 返回 | 说明 |
| :--- | :--- | :--- |
| `getSpriteFrame(path, formate?)` | `SpriteFrame \| null` | 加载精灵帧（本地 / `db://` / 远程 URL） |
| `getPrefab(path)` | `Prefab \| null` | 加载预制体 |
| `getJsonAsset(path, bundleName?)` | `JsonAsset \| null` | 加载 JSON 资产对象 |
| `getJson<T>(path)` | `T \| null` | 加载并解析 JSON 数据（不追踪资产） |
| `getAudioClip(path)` | `AudioClip \| null` | 加载音频剪辑 |
| `getText(path)` | `string \| null` | 加载文本内容 |
| `releasePath(path)` | `Promise<void>` | 释放本地资源 (bundle.release) |
| `releaseRemote(url?)` | `void` | 释放远程 SpriteFrame 缓存 |

**路径语法**：

| 格式 | 示例 | 说明 |
| :--- | :--- | :--- |
| 主包相对路径 | `'image/icon'` | `resources/image/icon` |
| `db://` 协议 | `'db://game/image/icon'` | 指定 bundle 名 |
| 远程 URL | `'https://cdn.example.com/icon.png'` | 仅 SpriteFrame |

> **注意**：外部组件应通过 `AssetScope` 或 `AssetScopeManager` 加载资源以自动追踪生命周期，而非直接调用 `CCAssets`。

### AssetScope — 资源作用域

按实例追踪资源路径，通过 `releaseAll()` 统一释放。每个场景/模块创建独立的实例。

| 方法 | 说明 |
| :--- | :--- |
| `getSpriteFrame(path)` | 加载 + 自动追踪路径 |
| `getJsonAsset(path, bundleName?)` | 加载 JSON 资产 + 自动追踪 |
| `getPrefab(path)` | 加载预制体 + 自动追踪 |
| `getAudioClip(path)` | 加载音频 + 自动追踪 |
| `track(path)` | 手动追踪外部加载的路径 |
| `releaseAll()` | 统一释放所有追踪资源 (bundle.release) |
| `debug()` | 返回 `{ name, pathCount, paths }` 调试快照 |

**生命周期示例**：

```ts
// 模块级自管 (I18nManager / AudioManager 模式)
const scope = new AssetScope('i18n_zh-CN');
const json = await scope.getJsonAsset('i18n/zh-CN');
const sf = await scope.getSpriteFrame('db://game/textures/i18n/logo');
// 切语言时
scope.releaseAll(); // JSON + 图片统一释放
```

### AssetScopeManager — 场景级资源管理器

全局单例，管理 `AssetScope` 栈。场景组件通过它加载资源，不感知当前 scope。

| 方法 | 说明 |
| :--- | :--- |
| `getSpriteFrame(path)` | 加载 + 追踪到当前 scope |
| `getJsonAsset(path, bundleName?)` | 加载 JSON 资产 + 追踪 |
| `getPrefab(path)` | 加载预制体 + 追踪 |
| `getAudioClip(path)` | 加载音频 + 追踪 |
| `setNodeSprite(target, path)` | 加载 SpriteFrame + 应用到节点（含请求去抖） |
| `push(name)` / `pop(expectedName?)` | 场景生命周期管理 |
| `current` | 获取当前活跃 scope |
| `stackDepth` / `debug()` | 调试信息 |

**去抖机制**：`setNodeSprite` 内置 `WeakMap` + `requestId` 去抖，保证同一 target 只有最新的 path 请求生效。适合 MVVM 绑定等高频更新场景。

### AssetScopeMount — 场景挂载组件

拖到场景根节点，零代码接入：

1. 场景 `onLoad` → `AssetScopeManager.push(sceneName)`
2. 场景 `onDestroy` → `AssetScopeManager.pop()` → 自动 `releaseAll()`

`scopeName` 属性可自定义（默认用场景名）。

---

### EventBus — 统一事件总线

纯 TS、零依赖的全局发布/订阅，是 `brief-toolkit` 跨模块事件通信的统一基础设施。

| 方法 | 说明 |
| :--- | :--- |
| `EventBus.emit(name, payload?)` | 发送事件 |
| `EventBus.on(name, callback)` | 订阅事件，返回 `SubscriptionToken` |
| `EventBus.once(name, callback)` | 一次性订阅 |
| `EventBus.off(name, callback)` | 取消订阅 |
| `EventBus.offByToken(token)` | 通过令牌取消订阅 |
| `EventBus.clear(name?)` | 清空指定事件或全部事件 |
| `EventBus.subscriberCount(name)` | 查询某事件的订阅者数量 |

**使用示例**：

```ts
import { EventBus } from 'db://assets/brief-toolkit/common/pure';

// 订阅
const token = EventBus.on<{ score: number }>('score-changed', (payload) => {
  console.log(`Score: ${payload.score}`);
});

// 发送
EventBus.emit('score-changed', { score: 100 });

// 取消
EventBus.offByToken(token);
```

**事件命名建议**：使用 `module:action` 格式避免冲突 — `inventory:item-acquired`、`player:level-up`。

**各模块接入方式**：

| 模块 | 使用方式 |
| :--- | :--- |
| **mvvm** | ViewModel 通过 `this.emit()` + `@event` 声明式收发（框架自动管理生命周期） |
| **i18n** | `I18nManager` 内部 emit；订阅统一用 `EventBus.on(I18nEventType.XXX, cb)` |
| **uim** | 保持 Cocos `Node.emit/on`（视图级事件）；跨模块通信可用 EventBus |
| **guide** | 保持回调注入（任务级事件）；跨模块通信可用 EventBus |
| **外部模块** | `EventBus.emit/on/off` 直接调用 |

> **EventBus 是 brief-toolkit 插件对外公开的唯一事件 API。** 所有模块（mvvm/i18n/uim/guide）及外部代码统一通过 `EventBus` 收发事件。ViewModel 内部可用 `this.emit()` + `@event` 声明式语法糖（框架层自动调用 EventBus）。单个回调异常不影响其他订阅者。

---

### HttpClient — HTTP 请求客户端（基于 XMLHttpRequest）

零依赖的 Promise 风格 HTTP 客户端，底层使用 `XMLHttpRequest`（Cocos 3.8.8 全平台内置适配层，小游戏内部转发至 `wx.request` / `tt.request`）。导出全局单例 `httpClient`。

| 方法 | 说明 |
| :--- | :--- |
| `httpClient.get(url, config?)` | GET 请求 |
| `httpClient.post(url, data, config?)` | POST 请求 |
| `httpClient.put(url, data, config?)` | PUT 请求 |
| `httpClient.patch(url, data, config?)` | PATCH 请求 |
| `httpClient.delete(url, config?)` | DELETE 请求 |
| `httpClient.addInterceptor(i)` | 添加请求/响应/错误拦截器 |
| `httpClient.removeInterceptor(i)` | 移除拦截器 |

**静态属性**：
| 属性 | 说明 |
| :--- | :--- |
| `HttpClient.baseUrl` | 全局基础 URL，设置后所有请求自动拼接此前缀 |

**拦截器接口**：

```ts
interface IHttpInterceptor {
  request?:  (config: IHttpConfig) => IHttpConfig;  // 修改 headers / timeout 等
  response?: (response: any) => any;                // 统一处理响应
  error?:    (error: any) => any;                   // 统一处理错误
}
```

**使用示例**：

```ts
import { httpClient, TokenManager } from 'db://assets/brief-toolkit/common';

// 注入 Auth 拦截器
httpClient.addInterceptor({
  request: (config) => {
    if (TokenManager.bearerToken) {
      config.headers = { ...config.headers, Authorization: TokenManager.bearerToken };
    }
    return config;
  },
});

// 发送请求
const res = await httpClient.get('https://api.example.com/users');
// res → { data: ..., status: 200, statusText: 'OK' }
```

> **注意**：`httpClient` 在网络错误 / HTTP 4xx/5xx 时会 **reject**。推荐通过 `HttpTemplate` 调用（永不 throw），或自行 `.catch()` 兜底。

### HttpTemplate — 泛型类型安全 API 模板

通过 `IServerData` 泛型定义完整 API 接口契约，提供编译期类型检查与 IDE 智能提示。**所有方法永不抛出异常**，统一返回 `ResData<T>` 信封。

| 方法 | 说明 |
| :--- | :--- |
| `new HttpTemplate<SD>(http, prefix?)` | 创建实例，注入 IHttp 传输层 + API 路径前缀 |
| `api.get(path, req, config?)` | 类型安全 GET，返回 `ResData<T>` |
| `api.post(path, req, config?)` | 类型安全 POST |
| `api.put(path, req, config?)` | 类型安全 PUT |
| `api.patch(path, req, config?)` | 类型安全 PATCH |
| `api.delete(path, req, config?)` | 类型安全 DELETE |

**静态属性**：
| 属性 | 说明 |
| :--- | :--- |
| `HttpTemplate.baseUrl` | 全局基础 URL，所有实例共享 |

**核心类型**：

```ts
interface ResData<T> {
  code: number;      // 0=成功, -1=业务失败, -2=请求异常
  message?: string;
  data?: T;
}

interface IServerData {
  get?:    { [api: string]: { req: {...}; res: ResData<any> } };
  post?:   { [api: string]: { req: {...}; res: ResData<any> } };
  put?:    { [api: string]: { req: {...}; res: ResData<any> } };
  patch?:  { [api: string]: { req: {...}; res: ResData<any> } };
  delete?: { [api: string]: { req: {...}; res: ResData<any> } };
}
```

**使用示例**（对齐 `temp_demo/api/` 模式）：

```ts
import { httpClient, HttpTemplate, type IServerData, type ResData } from 'db://assets/brief-toolkit/common';

// 1) 定义 API 接口契约
interface UserAPI extends IServerData {
  get: {
    'users':         { req: { query?: { page?: number } }; res: ResData<User[]> };
    'users/:id':     { req: { params: { id: number } };    res: ResData<User> };
  };
  post: {
    'users':         { req: { body: CreateUser };          res: ResData<User> };
  };
}

// 2) 创建 API 实例
export const apiUser = new HttpTemplate<UserAPI>(httpClient, 'api/users');

// 3) 调用 —— 编译期检查参数类型，IDE 自动补全
const list = await apiUser.get('users', { query: { page: 1 } });
if (list.code === 0) console.log(list.data); // User[]

const user = await apiUser.get('users/:id', { params: { id: 1 } });

const created = await apiUser.post('users', { body: { name: 'test', email: 't@t.com' } });
```

**URL 构建规则**：`{baseUrl}/{apiPrefix}/{path}?{queryString}`，path 中的 `:paramName` 自动替换为 `req.params` 中的同名值。

### TokenManager — Token 持久化管理

纯静态类，基于 `localStorage` 实现全平台 Token 持久化，自动处理 Bearer 前缀和过期检查。

| 方法/属性 | 说明 |
| :--- | :--- |
| `TokenManager.token` | 读写原始 token（无前缀），get 时自动检查过期 |
| `TokenManager.bearerToken` | 获取带 `Bearer ` 前缀的 token（用于 Authorization header） |
| `TokenManager.setToken(t, days?, persist?)` | 设置 token，支持自定义过期天数（默认 7） |
| `TokenManager.removeToken()` | 清除（内存 + localStorage） |
| `TokenManager.isTokenValid` | Token 是否存在且未过期 |

```ts
import { TokenManager } from 'db://assets/brief-toolkit/common';

// 登录后持久化
TokenManager.token = 'eyJhbGciOi...';  // 自动存 localStorage，7天过期

// 请求时使用（配合 httpClient 拦截器）
const header = TokenManager.bearerToken;  // "Bearer eyJhbGciOi..."

// 登出
TokenManager.removeToken();
```

> 模块 `import` 时自动从 `localStorage` 恢复 token，无需手动初始化。

### WebSocketClient — WebSocket 客户端

Promise 风格 + 事件订阅的 WebSocket 封装，内置心跳保活和断线自动重连。导出全局单例 `wsClient`。

| 方法 | 说明 |
| :--- | :--- |
| `ws.connect(url?)` | 建立连接（Promise），超时可配 |
| `ws.disconnect(code?, reason?)` | 主动断开（不触发重连） |
| `ws.send(data)` | 发送消息（对象自动 JSON 序列化） |
| `ws.request(data, timeout?)` | RPC 请求-响应：发送带唯一 ID 的消息，等待匹配 ID 的响应 |
| `ws.on(event, cb)` | 订阅事件，返回 `WsSubscription` |
| `ws.off(sub)` | 取消订阅 |
| `ws.destroy()` | 销毁：断开 + 清空订阅 + 清空定时器 |
| `ws.configure(config)` | 更新配置（仅对下一次 connect 生效） |

**属性**：
| 属性 | 说明 |
| :--- | :--- |
| `ws.isConnected` | 是否已连接 |
| `ws.readyState` | 就绪状态（CONNECTING / OPEN / CLOSING / CLOSED） |

**事件类型**：`'open'` | `'close'` | `'error'` | `'message'` | `'reconnecting'`

**配置项**：

| 配置 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `url` | `''` | WebSocket 地址 |
| `heartbeatInterval` | `30000` | 心跳间隔 ms，0 禁用 |
| `heartbeatTimeout` | `5000` | 心跳超时 ms，超时视为断线 |
| `reconnect` | `true` | 是否启用自动重连 |
| `reconnectBaseInterval` | `1000` | 重连基础间隔 ms |
| `reconnectMaxDelay` | `30000` | 重连最大间隔 ms |
| `reconnectMaxAttempts` | `-1`（无限） | 最大重连次数 |
| `reconnectDecay` | `1.5` | 退避指数（1s → 1.5s → 2.25s ...） |
| `connectTimeout` | `10000` | 连接超时 ms |
| `requestTimeout` | `10000` | request() 默认超时 ms |

**使用示例**：

```ts
import { WebSocketClient, wsClient } from 'db://assets/brief-toolkit/common';

// 使用全局单例
wsClient.configure({ url: 'ws://localhost:8080/ws' });

wsClient.on('message', (data) => console.log('收到:', data));
wsClient.on('reconnecting', (n) => console.log(`重连第 ${n} 次`));

await wsClient.connect();
wsClient.send({ type: 'chat', text: 'hello' });

// RPC 请求-响应
const reply = await wsClient.request({ method: 'getRank', page: 1 }, 5000);

// 多连接场景
const ws2 = new WebSocketClient({ url: 'wss://game.example.com/ws' });
```

**心跳协议**（应用层 `__ws_ping` / `__ws_pong`，服务端回传即可）：

```
Client → Server:  {"__ws_ping":true,"__ws_ts":1719700000000}
Server → Client:  {"__ws_pong":true,"__ws_ts":1719700000000}
```

**重连策略**：指数退避 + ±20% 随机抖动，避免惊群效应。

---

## 使用模式

### 模式 1：场景级自动管理

```ts
// 1. 场景根节点挂 AssetScopeMount 组件 (scopeName = "battle")

// 2. 场景组件中加载资源 — 自动追踪到当前 scene scope
const sf = await AssetScopeManager.getSpriteFrame('db://game/textures/char/hero');
// 3. 场景销毁 → pop() → releaseAll() 自动释放
```

### 模式 2：模块级自管 (I18nManager / AudioManager)

```ts
class MyGlobalManager {
  private _scope = new AssetScope('my_module');

  async loadData(path: string) {
    return this._scope.getJsonAsset(path); // 自动追踪
  }

  destroy() {
    this._scope.releaseAll(); // 统一释放
  }
}
```

### 模式 3：混合使用

场景组件通过 `AssetScopeManager` 加载场景资源（自动随场景释放），全局单例（I18nManager、AudioManager）自管 `AssetScope` 实例（跨场景存活，手动控制释放时机）。

---

## 设计原则

| 原则 | 实践 |
| :--- | :--- |
| **类型无关** | `_paths: Set<string>` 统一追踪，`releaseAll()` 按路径释放，不关心资源类型 |
| **ref-count 安全** | 依赖 Cocos AssetManager 自带 ref-count，跨 Scope 共享资源正确协作 |
| **层级清晰** | CCAssets (加载) → AssetScope (追踪) → AssetScopeManager (管理) → AssetScopeMount (接入) |
| **去抖内置** | `setNodeSprite` 在 Manager 层独立去抖，CCAssets 保持纯函数无状态 |
| **统一事件** | EventBus 提供跨模块 pub/sub，ViewModel 声明式 + 外部模块直接调用共享同一命名空间 |

---

## 依赖

- `cc` (SpriteFrame, JsonAsset, Prefab, AudioClip, Node, Sprite, AssetManager, ...)
- 本模块内部：`CCAssets` ← `AssetScope` ← `AssetScopeManager` ← `AssetScopeMount`
- 纯 TS 层：`EventBus` / `HttpClient` / `HttpTemplate` / `TokenManager` / `WebSocketClient` 零 `'cc'` 依赖，可安全用于单元测试和 Node.js 环境
- 平台要求：`XMLHttpRequest` + `WebSocket` + `localStorage`（Cocos Creator 3.8.8 全平台内置）
