# MVVM 框架

> Cocos Creator 3.8.8 的生产级 MVVM 数据绑定框架。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.2.0` |
| Cocos 版本 | `v3.8.8` |

---

## 1. 两层入口

| 入口 | 用途 | 依赖 |
| --- | --- | --- |
| `pure.ts` | 单元测试、Node.js 脚本 | **零 `cc` 导入** |
| `index.ts` | Cocos 项目运行时代码 | 完整 Cocos 组件 + pure.ts 全部 API |

---

## 2. 架构

### 2.1 组件继承链

```
Cocos Component
├── CCElement ────── Binding
└── DataContext
    ├── ViewModel
    └── ItemsSource
```

### 2.2 纯 TS 层（零 cc 依赖）

```
BaseViewModel  ← VM 生命周期基类 + emit() / @event 声明式事件
EventBus       ← 统一事件总线（与 VM 共享事件命名空间，外部可直接调用）
Reactive       ← 响应式内核（Proxy 依赖追踪）
DecoratorData  ← 装饰器元数据注册表
ErrorBoundary  ← 异常捕获隔离
MvvmNodePool   ← 节点对象池
mvvmType       ← TypeScript 类型工具
```

### 2.3 核心类一览

| 类 | 层 | 职责 |
| --- | --- | --- |
| `ViewModel` | Cocos 组件 | 页面根节点，创建 VM 实例 + reactive 包装 + 管理完整生命周期 + 自动管理 @event 订阅 |
| `DataContext` | Cocos 组件 | 嵌套数据上下文，从上级取对象字段，暴露给下级 Binding/DataContext |
| `ItemsSource` | Cocos 组件 | 数组 → 模板节点列表，监听 push/pop/splice 增量更新，支持模板选择器 |
| `Binding` | Cocos 组件 | 连接 UI 组件属性 ↔ 数据字段，支持 4 种绑定模式 |
| `CCElement` | Cocos 组件 | UI 组件适配：识别 Label/EditBox/Sprite 等，统一套读写 + 事件监听 |
| `BaseViewModel` | 纯 TS | 9 个生命周期钩子 + `emit()` 发送 + `@event` 接收 |
| `EventBus` | 纯 TS | 统一事件总线，VM 声明式收发，外部代码直接 `EventBus.emit/on/off` 共享同一命名空间 |
| `Reactive` | 纯 TS | Vue3 风格响应式：reactive/watch/computed/batch |
| `ErrorBoundary` | 纯 TS | try-catch 包裹器，绑定/回调异常不影响其他链路 |
| `MvvmNodePool` | Cocos | 基于 NodePool 封装，按模板分组缓存，出入池时自动调 suspend/resume |

### 2.4 运行时数据流

```
ViewModel.onUpdateData()
  → decoratorData.createInstance(name)    // 字符串名 → new
  → vm.onCreate()                         // reactive 包装前
  → reactive(vm)                          // 设为响应式
  → _bindEventDecorators()                // 自动订阅 @event
  → scheduleOnce → vm.onLoaded()          // 下一帧，UI 绑定就绪

Binding.onLoad()
  → DataContext.lookUp(node)              // 沿树向上找父 DataContext
  → parent.register(this, onUpdateData)   // 注册回调
  → _applyBindingMode()                   // TwoWay/OneWay/...
  → onUpdateData()                        // 读数据 + 设 watch

数据变更(View -> Model) → trigger → watch 回调 → 驱动 Binding.setElementValue → UI 更新
UI 交互(Model -> View)  → onElementValueChange → Reflect.set → trigger → 数据更新
```

---

## 3. 目录结构

```
mvvm/
├── components/
│   ├── Binding.ts               # UI 属性 ↔ 数据字段
│   ├── DataContext.ts           # 对象型嵌套上下文
│   ├── ItemsSource.ts           # 数组 → 模板列表 + 对象池 + 模板选择器
│   └── ViewModel.ts             # 根节点 VM 容器
│
├── core/
│   ├── BaseViewModel.ts         # VM 生命周期基类
│   ├── CCElement.ts             # UI 组件适配层
│   ├── CCResources.ts           # 资源加载（bundle/远程/SpriteFrame）
│   ├── Decorator.ts             # @vm/@model/@prop/@func/@event
│   ├── DecoratorData.ts         # 装饰器元数据注册表
│   ├── ErrorBoundary.ts         # try-catch 隔离
│   ├── EventBus.ts              # 统一事件总线（公开导出，供 ViewModel 及外部模块使用）
│   ├── NodePool.ts              # 对象池 + IPoolable 接口
│   ├── Reactive.ts              # 响应式内核
│   └── mvvmType.ts              # 类型工具（ViewModelOf / PropType / BindingKeys）
│
├── index.ts                     # Cocos 运行时入口
└── pure.ts                      # 纯 TS 入口（零 cc 依赖）
```

---

## 4. 快速开始

### 4.1 定义 ViewModel

```ts
import * as mvvm from '../../brief-toolkit/mvvm/pure';
const { vm, prop, func, event } = mvvm._decorator;

@vm('HelloVM')
class HelloVM extends mvvm.BaseViewModel {
  @prop        title = 'Hello';
  @prop(Number) count = 0;

  // 声明式接收其他 VM 的事件
  @event('score-changed')
  onScoreChanged(score: number) {
    this.count += score;
  }

  onLoaded(): void {
    // 数据绑定就绪后执行
  }

  @func
  onClick() {
    this.count++;
    this.title = `Clicked ${this.count}`;
    // 向其他 VM 发送事件
    this.emit('count-updated', this.count);
  }
}
```

### 4.2 场景挂载

1. 根节点挂 `ViewModel`，viewModel 下拉选 `HelloVM`
2. Label 节点挂 `Binding`：`mode=OneWay`，`binding=title`
3. Button 节点挂 `Binding`：`mode=OneWayToSource`，`binding=onClick`

### 4.3 列表（ItemsSource）

1. ViewModel 加 `@prop([Item]) list`
2. 列表容器挂 `ItemsSource`，`binding=list`，`templates=[模板节点]`
3. 模板子节点挂 `Binding` 访问 item 属性

---

## 5. ViewModel 与生命周期

### 5.1 BaseViewModel（纯 TS 抽象类）

| 钩子 | 调用时机 |
| --- | --- |
| `onCreate()` | 构造后、reactive 包装前 |
| `onLoaded()` | 首帧渲染前、数据绑定就绪 |
| `onEnable()` | 节点 activeInHierarchy 变为 true |
| `onDisable()` | 节点 activeInHierarchy 变为 false |
| `onUpdate(dt)` | 每帧 |
| `onDestroy()` | 销毁前 |
| `onAppShow()` | 应用回前台 |
| `onAppHide()` | 应用进后台 |
| `onError(e)` | VM 内部异常 |

### 5.2 ViewModel 组件

| 属性 | 说明 |
| --- | --- |
| `viewModel` | 下拉选择已注册的 VM 类 |
| 全局 VM | `@vm('Name', true)` → 单例，所有场景共享同一实例 |

### 5.3 静态查找 API（ViewModelData）

```ts
ViewModelData.getFirstTarget<MyVM>('MyVM');
ViewModelData.getTargetByNode<MyVM>('MyVM', someNode);
ViewModelData.getNodes(vmInstance);
ViewModelData.getStats(); // { names, targets, nodes }
```

---

## 6. 统一事件总线 (EventBus)

EventBus 是 brief-toolkit 的统一事件基础设施，ViewModel 和外部模块共享同一事件命名空间。

**两种使用方式**：

| 场景 | 方式 | 说明 |
| --- | --- | --- |
| ViewModel 内部 | `this.emit()` + `@event` | 声明式，框架自动管理订阅生命周期 |
| 外部模块 | `EventBus.emit/on/off` | 直接调用，与 VM 在同一命名空间通信 |

### 6.1 ViewModel 声明式（推荐）

```ts
@vm('SenderVM')
class SenderVM extends BaseViewModel {
  @func
  onButtonClick() {
    this.emit('score-changed', 100);  // 发送
  }
}

@vm('ReceiverVM')
class ReceiverVM extends BaseViewModel {
  @prop score = 0;

  @event('score-changed')            // 声明式接收
  onScoreChanged(payload: number) {
    this.score += payload;
  }
}
```

### 6.2 外部模块直接调用

```ts
import { EventBus } from 'db://assets/brief-toolkit/mvvm/pure';

// 订阅（与 ViewModel 的 @event 接收同一事件）
const token = EventBus.on('score-changed', (score) => {
  console.log(`Score: ${score}`);
});

// 发送（ViewModel 的 @event 可接收）
EventBus.emit('achievement:check', { type: 'score', value: 100 });

// 一次性订阅
EventBus.once('startup-complete', () => { /* ... */ });

// 取消订阅
EventBus.offByToken(token);
```

### 6.3 API 速查

| 方法 | 说明 |
| --- | --- |
| `EventBus.emit(name, payload?)` | 发送事件 |
| `EventBus.on(name, callback)` | 订阅，返回 `SubscriptionToken` |
| `EventBus.once(name, callback)` | 一次性订阅 |
| `EventBus.off(name, callback)` | 取消订阅 |
| `EventBus.offByToken(token)` | 通过令牌取消 |
| `EventBus.clear(name?)` | 清空指定事件 / 全部 |
| `EventBus.subscriberCount(name)` | 订阅者数量 |

### 6.4 事件命名建议

使用 `module:action` 格式避免冲突：`inventory:item-acquired`、`player:level-up`、`network:disconnected`。

> **设计原则**：EventBus 是统一事件总线。ViewModel 用 `@event` 声明式 + `this.emit()` 收发，外部模块用 `EventBus` 静态方法。两者共享同一 Map，互通无阻。各子系统自身的事件接口（如 `I18n.on`、`Scenes.onBeforeLeave`）仍独立运作，不经过 EventBus。

---

## 7. 响应式（Reactive）

### 7.1 API

| 函数 | 说明 |
| --- | --- |
| `reactive(obj)` | 深层响应式代理 |
| `shallowReactive(obj)` | 仅顶层响应式 |
| `readonly(obj)` | 深层只读代理 |
| `shallowReadonly(obj)` | 仅顶层只读 |
| `isReactive / isReadonly / isProxy` | 类型判断 |
| `toRaw(proxy)` | 获取原始对象 |
| `computed(getter)` | 惰性求值派生状态 |
| `watchEffect(fn, opts?)` | 立即执行 + 自动追踪依赖 |
| `watch(source, cb, opts?)` | 监听特定值变化 |
| `batch(fn)` | 批量更新（合并触发） |
| `setReactiveErrorHandler(fn)` | 设置异步回调错误处理 |

### 7.2 选项

| 选项 | 值 | 说明 |
| --- | --- | --- |
| `flush` | `'sync'`（默认） | 同步触发回调 |
| | `'post'` | 微任务合并，同一轮同步变更只触发一次 |
| `immediate` | `false`（默认） | 仅变更时触发 |
| | `true` | 立即执行一次 |

### 7.3 数组变更信息（ReactionOperation）

```ts
interface ReactionOperation<T = unknown> {
  target?: T;
  type?: 'set' | 'add' | 'delete' | 'push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'set-length';
  property?: string | symbol;
  value?: unknown;
  oldValue?: unknown;
  inserted?: unknown[];    // 数组插入的值
  insertedStart?: number;  // 插入起始位置
  deleted?: unknown[];     // 数组删除的值
  deletedStart?: number;   // 删除起始位置
}
```

### 7.4 类型安全的 watch

```ts
const obj = reactive({ count: 0 });

// newVal / oldVal 类型自动推导
watch(() => obj.count, (newVal, oldVal) => {
  // newVal: number, oldVal: number | undefined
});
```

---

## 8. 装饰器

```ts
const { vm, model, prop, func, event } = mvvm._decorator;
```

| 装饰器 | 用途 | 示例 |
| --- | --- | --- |
| `@vm(name, global?)` | 注册 ViewModel 类 | `@vm('MyVM')` |
| `@model(name)` | 注册 Model 类 | `@model('Item')` |
| `@prop` | 属性（从默认值推导类型） | `@prop title = ''` |
| `@prop(Type)` | 属性（显式类型） | `@prop(String)` / `@prop(Number)` / `@prop([ItemModel])` |
| `@func` | 方法（供 Binding OneWayToSource） | `@func onClick()` |
| `@event(name)` | 声明式事件订阅 | `@event('score-changed')` |
| `SetEditor(data)` | 编辑器预览默认值 | `SetEditor(new MyVM())` |

装饰器由 TypeScript 实验性装饰器支持（`experimentalDecorators: true`）。

---

## 9. Binding

### 9.1 绑定模式

| 模式 | 方向 | 适用 |
| --- | --- | --- |
| `TwoWay` | Model ↔ View | EditBox、Toggle、Slider |
| `OneWay` | Model → View | Label、Sprite、ProgressBar |
| `OneTime` | Model → View（仅首次） | 静态标题、不变图片 |
| `OneWayToSource` | View → Model | Button.click、触摸事件 |

编辑器会根据所选 Element 和 Property 动态收敛可选的 mode。

### 9.2 CCElement 支持的元素

| 元素 | 可绑定属性 | 数据类型 |
| --- | --- | --- |
| `Label` | `string` | String / Number / Boolean |
| `RichText` | `string` | String / Number / Boolean |
| `EditBox` | `string` | String / Number / Boolean |
| `Toggle` | `isChecked` | Boolean |
| `Button` | `click` | Function |
| `Slider` | `progress` | Number |
| `ProgressBar`| `progress` | Number |
| `PageView` | `currentPageIndex` | Number |
| `Sprite` | `spriteFrame` | String（路径） |
| `ToggleContainer`| `checkedIndex` | Number |
| `Node` | `active` | Boolean / Number / String / Object |
| `Node` | `position` | Vec |
| `Node` | `touch-start/move/end` | Function |

### 9.3 静态访问 API

```ts
BindingData.get<MyVM>(node);          // 获取绑定数据
BindingData.get<MyVM>(node, true);    // 获取上级上下文
DataContextData.get<MyVM>(node);      // 获取 DataContext 数据
ItemsSourceData.get<Item[]>(node);    // 获取 ItemsSource 数组
```

---

## 10. ItemsSource（列表渲染）

### 10.1 核心机制

- 监听数组 `length` 变化（push/pop/splice/shift/unshift）
- 增量更新：`inserted/deleted` 精准增删节点
- 节点来自 `MvvmNodePool`（对象池），非 destroy
- 模板支持多选（模板选择器）

### 10.2 属性

| 属性 | 说明 |
| --- | --- |
| `templates` | 模板节点数组 |
| `templateField` | 数据字段名（item[field] → templates[n]），空则用 templates[0] |
| `isSelected` | 启用选中项双向绑定 |
| `bindingSelected` | 绑定选中项到哪个属性 |

### 10.3 模板选择器

```ts
// ViewModel 中
@model('ChatItem')
class ChatItem {
  @prop templateId = 0;  // 0=文本气泡, 1=图片气泡, 2=系统消息
  @prop sender = '';
  @prop content = '';
}

// 编辑器中 ItemsSource 配置
templates: [TextBubble预制, ImageBubble预制, SystemMsg预制]
templateField: 'templateId'
```

### 10.4 对象池

`MvvmNodePool` 自动处理节点复用，无需用户配置：

- `addItem` → 优先从池取，无则 `instantiate`
- `deleteItemByIndex` → 回池而非 `destroy`
- 回池前自动 `suspend()`（停 watch + 解注册 + 清事件）
- 出池后自动 `resume()`（重建上下文 + 重设监听）

---

## 11. 错误边界

```ts
// 包裹无参函数
ErrorBoundary.wrap(() => this.riskyOperation(), this, 'context');

// 包裹回调
const safeCb = ErrorBoundary.wrapCallback(callback, this, 'watch:title');

// 直接执行
ErrorBoundary.tryRun(() => fn(), this, 'onUpdate');
```

异常处理链：`ErrorBoundary` → `BaseViewModel.onError()` → 全局 `reactiveErrorHandler`（通过 `setReactiveErrorHandler` 设置）。

---

## 12. 类型工具（pure.ts only）

```ts
import type { ViewModelOf, PropType, BindingKeys } from '.../mvvm';

class MyVM extends BaseViewModel {
  @prop title = '';
  @prop count = 0;
  @func onClick() { }
}

type VM = ViewModelOf<typeof MyVM>;  // MyVM
type T  = PropType<VM, 'title'>;     // string
type B  = BindingKeys<VM>;           // 'title' | 'count'
```

---

## 13. IPoolable 接口

`DataContext`、`Binding`、`CCElement` 均实现此接口，配合 `MvvmNodePool`：

```ts
interface IPoolable {
  suspend(): void;  // 入池前：停 watch + 解注册 + 清事件
  resume(): void;   // 出池后：重建上下文 + 重设监听
}
```

---

## 14. 入口 API 对照

| API | pure.ts | index.ts |
| --- | :---: | :---: |
| `reactive` / `watch` / `watchEffect` / `computed` / `batch` | ✅ | ✅ |
| `BaseViewModel`（含 `emit` / `@event` VM 间通信） | ✅ | ✅ |
| `EventBus`（统一事件总线） | ✅ | ✅ |
| `_decorator`（@vm/@prop/@func/@event） | ✅ | ✅ |
| `ErrorBoundary` | ✅ | ✅ |
| 类型工具（ViewModelOf 等） | ✅ | ✅ |
| `ViewModelData` / `BindingData` / `DataContextData` / `ItemsSourceData` | ❌ | ✅ |
| `MvvmNodePool` / `IPoolable` | ❌ | ✅ |

---

## 15. 常见注意事项

1. `Binding` 根据元素和属性动态收敛可选 `mode`，看不到某个 mode 说明该元素不支持
2. `ItemsSource` 的 `templates` 在运行时移出场景树并隐藏，模板本体不会直接显示
3. `DataContext`/`ItemsSource` 提示"找不到上级 DataContext"，检查节点层级和挂载顺序
4. 方法绑定统一使用 `OneWayToSource`
5. `@prop` 无参时必须设默认值（用于运行时类型推导）
6. pure.ts 不导出任何 Cocos 组件，可安全用于单元测试
7. ViewModel 内部推荐 `this.emit()` + `@event` 声明式通信；外部模块可直接 `import { EventBus }` 调用

---

## 📄 协议

MIT License
