# brief-toolkit

> Cocos Creator 3.8.8 生产级游戏框架插件 — 统一资源管理、统一事件总线（EventBus）、MVVM 数据绑定、UI 视图管理、国际化、引导系统、本地存储，六模块零耦合按需取用。

[🇨🇳 中文说明](#功能大纲) · [📖 模块文档](#模块总览)

---

## 功能大纲

| 模块 | 版本 | 定位 | 依赖 |
| :--- | :---: | :--- | :--- |
| [Common](#common-公共资源管理) | v1.2 | 统一资源加载 + AssetScope 生命周期管理 + **统一事件总线（EventBus）** | 纯 TS 层零 `cc` 依赖（EventBus），Cocos 层 `cc` (SpriteFrame 等) |
| [MVVM](#mvvm-数据绑定框架) | v1.2 | 装饰器 + 响应式 + 列表渲染 + 对象池 + `@event`/`emit` 声明式事件通信 | 纯 TS 层零 `cc` 依赖 |
| [UIM](#uim-视图管理器) | v1.2 | 视图 / 消息框 / 提示框 / 场景切换 / 音频 / 皮肤 | 静态门面 + Null Object 容错 |
| [i18n](#i18n-国际化) | v1.2 | 文本 + 图片本地化，EventBus 驱动刷新，语言回退 + AssetScope 资源管理 | 静态门面 + Common (AssetScope + EventBus) |
| [Guide](#guide-引导系统) | v1.3 | 任务-步骤引导引擎，遮罩高亮 + 对话框 + 指示器 | 静态门面 + 状态机 |
| [Storage](#storage-本地存储) | v1.0 | JSON 序列化封装，默认值回退，存储不可用时内存降级 | 零依赖，纯 TS |

---

## Common 公共资源管理

**统一资源加载 + 统一事件总线：CCAssets 底层加载器 → AssetScope 作用域追踪 → AssetScopeManager 场景级自动管理 → AssetScopeMount 零代码接入。EventBus 是插件唯一公开事件 API，供各模块及外部代码统一使用。**

### 四层架构

| 层 | 类 | 职责 |
| :--- | :--- | :--- |
| **加载层** | `CCAssets` | 纯静态加载器：路径解析 + bundle 管理 + 远程缓存。无 UI 操作，无生命周期追踪 |
| **作用域层** | `AssetScope` | 按实例追踪资源路径，`releaseAll()` 统一释放（依赖 Cocos ref-count 安全共享） |
| **管理层** | `AssetScopeManager` | 全局单例 + scope 栈，`push/pop` 场景生命周期，`setNodeSprite` 内置去抖 |
| **接入层** | `AssetScopeMount` | 拖到场景根节点，`onLoad` push / `onDestroy` pop，零代码 |

### 使用模式

**场景级自动管理**（推荐）：
```ts
// 1. 场景根节点挂 AssetScopeMount (scopeName = "battle")
// 2. 组件中加载 — 自动追踪到当前场景 scope
const sf = await AssetScopeManager.getSpriteFrame('db://game/textures/char/hero');
AssetScopeManager.setNodeSprite(node, 'db://game/textures/ui/button');
// 3. 场景销毁 → pop() → releaseAll() 自动释放
```

**模块级自管**（全局单例）：
```ts
// I18nManager / AudioManager 自管 AssetScope 实例
const scope = new AssetScope('i18n_zh-CN');
const json = await scope.getJsonAsset('i18n/zh-CN');
scope.releaseAll(); // 切语言/销毁时统一释放
```

### 资源类型全覆盖

`AssetScope` 和 `AssetScopeManager` 统一支持：`SpriteFrame` / `JsonAsset` / `Prefab` / `AudioClip`。路径追踪用 `Set<string>` 类型无关，`releaseAll()` 统一按路径释放。

### EventBus 统一事件总线

纯 TS、零依赖的全局 pub/sub，插件唯一公开事件 API：

```ts
import { EventBus } from 'db://brief-toolkit-plugin/common/pure';

const token = EventBus.on('score-changed', (payload) => { ... });
EventBus.emit('score-changed', 100);
EventBus.offByToken(token);
```

- **mvvm**：`this.emit()` + `@event` 声明式语法糖（框架内部调 EventBus）
- **i18n**：`I18nManager` 内部 emit 到 EventBus，`I18nLabel`/`I18nSprite` 直接订阅
- **外部模块**：从 `common/pure` 导入 `EventBus` 直接调用
- 事件命名建议 `module:action` 格式（如 `inventory:item-acquired`）

---

## MVVM 数据绑定框架

**装饰器声明 + Vue3 风格响应式内核 + 组件绑定链路，覆盖列表渲染与对象池复用。**

### 纯 TS 核心（零 `cc` 依赖）

| 能力 | 说明 |
| :--- | :--- |
| **装饰器注册** | `@vm` / `@model` / `@prop` / `@func` / `@event` 声明式定义 |
| **响应式系统** | `reactive` / `shallowReactive` / `readonly` / `computed`（惰性求值） / `watch` / `watchEffect` / `batch`（合并触发） |
| **生命周期** | `BaseViewModel` 提供 9 个钩子：`onCreate` → `onLoaded` → `onEnable` / `onDisable` → `onUpdate` → `onDestroy` → `onAppShow` / `onAppHide` → `onError` |
| **VM 间通信** | `this.emit()` 发送 + `@event('name')` 声明式接收，框架自动管理订阅生命周期 |
| **错误隔离** | `ErrorBoundary.wrap` / `tryRun` / `wrapCallback`，异常不影响其他链路 |
| **事件总线** | 底层走 `common/EventBus`，VM 用 `this.emit()` + `@event` 声明式语法糖，与外部 `EventBus` 共享同一命名空间 |
| **类型工具** | `ViewModelOf` / `PropType` / `BindingKeys` / `DeepPath` 等编译期类型推导 |

### Cocos 组件层

| 组件 | 职责 |
| :--- | :--- |
| `ViewModel` | 页面根节点，创建 VM 实例 + reactive 包装 + 管理完整生命周期 + 自动管理 `@event` 订阅 |
| `DataContext` | 嵌套数据上下文，从上级取对象字段，暴露给下级 Binding / DataContext |
| `ItemsSource` | 数组 → 模板节点列表，监听 push/pop/splice 增量更新，支持**模板选择器**（不同数据 → 不同模板） |
| `Binding` | UI 属性 ↔ 数据字段，支持 `TwoWay` / `OneWay` / `OneTime` / `OneWayToSource` 四种模式 |
| `CCElement` | UI 组件适配层：Label / EditBox / Sprite / Button / Toggle / Slider / ProgressBar / PageView / ToggleContainer / RichText / Node |

### 关键特性

- **MvvmNodePool 对象池**：出入池自动调 `suspend` / `resume`（停/启 watch + 解/注册上下文 + 清/重设事件）
- **列表增量更新**：根据 `inserted` / `deleted` 精准增删节点，非全量重建
- **静态查找 API**：`ViewModelData.getFirstTarget` / `BindingData.get` / `ItemsSourceData.get` 等
- **边界明确**：`pure.ts`（零 cc 依赖）vs `index.ts`（完整 Cocos 组件），单元测试直接引用 `pure.ts`

---

## UIM 视图管理器

**统一门面模式管理 UI 全流程：视图栈、消息框、提示框、场景切换、音频、皮肤。**

### 核心设计：Manager + Setting 分离

```
静态门面 (Audios/Skins/Scenes/Views/MessageBox/Tooltip)
  └─ bind → Manager 全局单例（自举注入）
       └─ implements → 接口（IAudioManager/ISkinManager/ISceneManager/IViewManager）
            └─ 未绑定 → Null Object 兜底（永不崩溃）
```

### 功能矩阵

| 子系统 | 静态门面 | Manager | 核心能力 |
| :--- | :--- | :--- | :--- |
| **视图** | `Views` | `ViewNavigator` | `showView` / `showAsReplace` / `backView` / `isTopView` / `ViewEvent` 生命周期事件（Show/Hide/Close/Data） |
| **消息框** | `MessageBox` | — | `show(title, content, buttons)` 返回 Promise `<MessageBoxResult>`（Yes/No/Cancel...） |
| **提示框** | `Tooltip` | — | `show(text, duration)` 自动消失 + 多实例管理（`TooltipMultiple`） |
| **场景** | `Scenes` | `SceneManager` | `loadScene` / `onBeforeLeave` 生命周期钩子 / `SceneInfo` 数据传递 |
| **音频** | `Audios` | `AudioManager` | `playMusic` / `playOneShot` / `stop` / `pause` / 音量 & 开关控制 |
| **皮肤** | `Skins` | `SkinManager` | `switchTheme` / `getSkinItem` / `SkinSprite` 自动响应切换 / 事件驱动精确刷新（O(活跃数)） |

### 设计要点

- **静态门面**：ViewModel 从 `pure.ts` 导入，零 Cocos 依赖，单元测试可用
- **Null Object 容错**：未绑定 Manager 时调用不崩溃（`I18n.text("key")` 返回 key 本身）
- **场景级绑定**：`ViewNavigator` 每场景独立挂载，Manager 全局单例，视角清晰
- **事件驱动**：Skin 状态变更 → 遍历活跃 `SkinSprite` 集合精确刷新（非全场景遍历）
- **自定义扩展**：`ViewBase` / `MessageBoxBase` / `TooltipBase` 基类可继承定制

---

## i18n 国际化

**事件驱动的文本 + 图片本地化，ViewModel 从 `pure.ts` 引入零依赖运行。**

### 四层架构

| 层 | 说明 |
| :--- | :--- |
| **I18nManager** | 全局单例，加载 JSON → 扁平化 key → O(1) 查找 → 切换语言 → 发射事件 → 所有订阅组件自动刷新 |
| **I18nSetting** | 可选编辑器配置组件（默认语言、资源目录、显示模式），多场景无需重复挂载 |
| **组件绑定** | `I18nLabel`（Label/RichText/EditBox）+ `I18nSprite`（SpriteFrame），自动响应语言切换 |
| **纯 TS 门面** | `I18n` 静态类 + `DateFormatter` + `I18nEventType`，零 `cc` 依赖，ViewModel 直接调用 |

### 核心能力

- **文本取值**：`I18n.text(key, args?)` 支持 `{0}` `{1}` 占位符
- **格式化**：`I18n.format(key, args)` 参数支持 Date / 字符串 / 数字，Date 自动按语言格式渲染
- **语言切换**：`await I18n.switch(lang)` 失败自动回滚到旧语言
- **语言回退**：`setFallbackLanguage(lang)` → key 缺失时链式回退
- **事件驱动刷新**：`LANGUAGE_BEFORE_SWITCH` → `LANGUAGE_SWITCHED` / `LANGUAGE_SWITCH_ERROR`
- **调试模式**：`I18nLabelMode.PATH` 显示 key 原文，方便定位翻译缺失
- **Null Object 容错**：未初始化时 `text()` 返回 key、`switch()` 静默成功

---

## Guide 引导系统

**基于「任务-步骤」模式的 UI 引导播放器，接收步骤数据，播放遮罩高亮、对话框、指示器，等待交互后推进。**

### 架构管线

```
Guider (静态门面 + 完成标记 API)
  └─ GuideManager (纯逻辑单例，状态机驱动)
       └─ GuideStepAction (步骤编排)
            ├─ CCLocatorLoop (分段路径定位 + 超时轮询)
            ├─ GuideFocus (遮罩镂空高亮 + 多形状 + 切换动画 + 触摸拦截)
            ├─ GuidePointerBase → 指示器 (自动定位 + 方向翻转 + 动画)
            ├─ GuideDialogBase → 对话框 (自动定位 + 方向避让)
            └─ GuideInteractionHandler (5 种触发解析 + 条件校验)
```

### 状态机

```
idle → startTask() → running ⇄ nextStep / previousStep / jumpTo(n)
                      running ⇄ pauseTask / resumeTask
                      running → stopTask → stopped
                      final step done → completed
```

### 功能清单

| 能力 | 说明 |
| :--- | :--- |
| **遮罩高亮** | 镂空目标节点 + 矩形 / 圆形 / 圆角矩形 / 椭圆 + 外扩边距 + 颜色的遮罩 + 点击穿透控制 |
| **平滑动画** | 步骤切换镂空位移 + 大小过渡（`switchDuration`，支持 snap） |
| **对话框** | 标题 + 描述 + 自动定位 + 方向避让，可继承 `GuideDialogBase` 自定义 |
| **进度对话框** | `GuideDialogProgress` 内置：步骤指示器、点击跳步、Prev/Next/Finish 导航 |
| **指示器** | 自动定位 + 方向翻转 + 动画，可继承 `GuidePointerBase` 自定义 |
| **5 种触发** | `click`（点击）/ `input_done`（EditBox完成）/ `slide`（Slider）/ `toggle`（ToggleContainer）/ `page_turn`（PageView翻页） |
| **条件校验** | `property_equal` / `toggle_index` / `page_index`，支持 eq/neq/gt/gte/lt/lte/notEmpty |
| **步骤控制** | 前进/回退/跳转(`jumpTo` 按 id 或索引)/暂停/恢复/停止 |
| **步骤回调** | `onStepEnter` / `onStepLeave` / `onComplete` / `onStop`（埋点、音效等外部注入） |
| **完成标记** | 注入 `setCompletionStorage` → 引导完成自动调用 `markCompleted(key)` |
| **步骤级配置覆盖** | `focus`（形状/边距/动画时长/遮罩颜色）/ `dialog`（标题/描述）/ `pointer`（位置/强制关闭） |

### 边界声明

引导系统是 **UI 播放器**，不负责：何时触发（任务系统判断）、多引导串行/队列（任务系统管理）、进度持久化存储（任务系统注入）、步骤数据动态化（任务系统写入 dialog 字段）。

---

## Storage 本地存储

**`sys.localStorage` 的薄封装 — JSON 自动序列化、默认值回退、存储不可用时内存降级。**

| 方法 | 说明 |
| :--- | :--- |
| `set(key, value)` | 写入值（自动 `JSON.stringify`） |
| `get<T>(key, defaultValue?)` | 读取值（自动 `JSON.parse` + 类型泛型 + 解析失败自动回退） |
| `has(key)` | 检查 key 是否存在 |
| `remove(key)` | 删除 key |
| `keys()` | 获取所有 key |
| `clear()` | 清空所有数据 |
| `setBackend(backend)` | 注入自定义后端（加密存储、云端同步等） |
| `getBackend()` | 获取当前后端 |

### 降级策略

1. 优先 `sys.localStorage`（Cocos）/ `localStorage`（浏览器/Node.js）
2. 不可用时静默降级为 `MemoryStorage`（数据不持久化，进程重启丢失）
3. 可关闭自动降级：`Storage.allowFallback = false`

---

## 跨模块设计原则

| 原则 | 实践 |
| :--- | :--- |
| **零耦合按需取用** | 每个模块有独立 `pure.ts` 入口，逻辑层零 `cc` 依赖，可单独引入 |
| **静态门面 + Null Object** | UIM / i18n / Guide 均采用门面模式，未绑定 Manager 时自动兜底，永不崩溃 |
| **事件驱动** | i18n 语言切换、UIM 皮肤刷新均采用事件广播精确通知（非全场景遍历） |
| **边界清晰** | Guide 是 UI 播放器非任务系统、Storage 是薄封装非状态管理、EventBus 位于 common 是唯一公开事件 API，ViewModel 用 `@event` 声明式语法糖 |
| **单元测试友好** | 每个模块提供 `pure.ts`，可在 Node.js / Vitest 中直接引用，无需启动 Cocos 引擎 |

---

## 📄 协议

MIT License
