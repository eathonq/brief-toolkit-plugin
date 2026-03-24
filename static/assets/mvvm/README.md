# MVVM 框架

> Cocos Creator 3.8.8 的轻量级 MVVM 数据绑定模块。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.0.0` |
| Cocos 版本 | `v3.8.8` |

## 简介
MVVM 框架是基于 Cocos Creator 引擎开发的一个轻量级的前端架构，
旨在简化数据与视图的绑定过程，提高开发效率。
通过使用 MVVM 框架，开发者可以更专注于业务逻辑的实现，而无需过多关注视图的更新和数据的同步。

## 核心能力
- 视图与数据双向绑定
- 集合数据驱动的列表渲染
- 响应式数据更新机制

## 框架类设计（按当前实现）

### 组件层继承关系

```text
Component
└─ DataContext
	├─ ViewModel
	└─ ItemsSource

CCElement
└─ Binding
```

### 核心类职责

| 类 | 角色 | 关键职责 |
| --- | --- | --- |
| `ViewModel` | 页面根数据上下文 | 创建并持有 `@vm` 声明的视图模型实例，包装为 `reactive`，转发 `onLoaded/onUpdate/onDestroy` 生命周期。 |
| `DataContext` | 对象型上下文桥接 | 从上级上下文取对象字段并注册更新回调；维护父子上下文注册关系。 |
| `ItemsSource` | 集合型上下文桥接 | 监听数组变更并驱动模板节点增删；支持可选“选中项”双向回写。 |
| `Binding` | 组件属性绑定器 | 连接 UI 组件属性与数据字段，支持 `TwoWay/OneWay/OneTime/OneWayToSource`。 |
| `CCElement` | UI 元素适配层 | 识别 Cocos 组件可绑定属性，统一读写与事件监听能力。 |
| `Decorator` + `DecoratorData` | 元数据系统 | 管理 `@vm/@model/@prop/@func` 元数据，供编辑器枚举和运行时实例化使用。 |
| `Reactive` | 响应式内核 | 提供代理、依赖追踪、侦听调度、批处理与只读/浅层模式。 |
| `CCResources` | 资源辅助 | 统一资源路径解析、bundle 与远程资源加载、SpriteFrame 设置。 |

### 运行时数据流

1. `ViewModel` 在根节点创建视图模型实例并转为响应式对象。
2. 子节点 `DataContext` / `ItemsSource` 通过注册机制拿到上级上下文数据。
3. `Binding` 绑定到具体字段或方法，建立 UI <-/-> 数据联动。
4. `Reactive` 在属性变化时触发侦听，驱动上下文和界面刷新。

## 目录结构
```shell
├── mvvm
│   ├── components
│   │   ├── Binding.ts            # 基础组件与基础数据类型的绑定组件
│   │   ├── DataContext.ts        # Node节点与对象类型数据绑定组件
│   │   ├── ItemsSource.ts        # Node节点与集合数据绑定组件
│   │   └── ViewModel.ts          # 视图模型组件
│   ├── core
│   │   ├── CCElement.ts          # 识别组件元素，并提供设置值和监听值变化的功能
│   │   ├── CCResources.ts        # 资源加载工具
│   │   ├── Decorator.ts          # 装饰器
│   │   ├── DecoratorData.ts      # 装饰器类数据信息
│   │   └── Reactive.ts           # 一个类似 Vue 的响应式系统实现
│   ├── index.ts                  # MVVM 框架入口
│   └── pure.ts                   # 纯 TS 装饰器入口（不依赖 Cocos 组件导出）
├── others
```

## 快速开始
1. 导入 `brief-toolkit` 资源到项目中。
2. 在页面上层节点挂载 `ViewModel`。
3. 在页面子节点上使用 `Binding` 或 `DataContext` 或 `ItemsSource` 完成界面绑定。

## 最小可运行示例

### 1) 定义 ViewModel（TypeScript）

```ts
import * as mvvm from "../../brief-toolkit/mvvm/pure";

const { vm, prop, func } = mvvm._decorator;

@vm("HelloViewModel")
export class HelloViewModel implements mvvm.IViewModel {
	@prop
	title = "Hello MVVM";

	@prop(Number)
	count = 0;

	onLoaded(): void {
		mvvm.watchEffect(() => {
			// 示例：可在这里做派生状态计算或调试输出
			const _debug = `${this.title}: ${this.count}`;
			void _debug;
		});
	}

	@func
	onClickAdd() {
		this.count += 1;
		this.title = `Hello MVVM (${this.count})`;
	}
}
```

### 2) 场景挂载（Editor）

1. 在页面根节点挂载 `mvvm.ViewModel`，`viewModel` 选择 `HelloViewModel`。
2. 在显示文本的 `Label` 节点挂载 `mvvm.Binding`：
	 - `DataContext` 指向根节点 `ViewModel`
	 - `mode` 选择 `OneWay`
	 - `binding` 选择 `title`
3. 在按钮节点挂载 `mvvm.Binding`（或按钮子节点）触发方法：
	 - `DataContext` 指向根节点 `ViewModel`
	 - `mode` 选择 `OneWayToSource`
	 - `binding` 选择 `onClickAdd`

### 3) 列表扩展示例（可选）

- 根节点 `ViewModel` 提供数组字段（如 `@prop([ItemModel]) list`）。
- 列表容器挂载 `mvvm.ItemsSource`，绑定到 `list`，并设置 `template`。
- 模板子节点继续挂载 `mvvm.Binding` / `mvvm.DataContext` 访问每一项数据。

## 组件绑定推荐配置

下表按当前实现的 `CCElement` + `Binding` 规则整理，优先使用“推荐 mode”。

| 元素 | Property | 数据类型 | 推荐 mode | 说明 |
| --- | --- | --- | --- | --- |
| `Label` / `RichText` | `string` | `String/Number/Boolean` | `OneWay` | 文本展示一般是模型驱动视图。 |
| `EditBox` | `string` | `String/Number/Boolean` | `TwoWay` | 输入框常用双向绑定。 |
| `Toggle` | `isChecked` | `Boolean` | `TwoWay` | 适合开关状态双向同步。 |
| `Slider` | `progress` | `Number` | `TwoWay` | 滑动条与数值通常双向联动。 |
| `ProgressBar` | `progress` | `Number` | `OneWay` | 进度展示通常只读。 |
| `PageView` | `currentPageIndex` | `Number` | `TwoWay` | 页码可由逻辑或交互共同驱动。 |
| `Sprite` | `spriteFrame` | `String` | `OneWay` | 字符串路径映射资源。 |
| `ToggleContainer` | `checkedIndex` | `Number` | `TwoWay` | 常与索引状态双向同步。 |
| `Button` | `click` | `Function` | `OneWayToSource` | 按钮只做事件上行。 |
| `Node` | `active` | `Boolean/Number/String/Object` | `TwoWay` | 支持显隐双向；展示场景也可用 `OneWay`。 |
| `Node` | `position` | `Vec` | `TwoWay` | 位置联动交互场景可双向。 |
| `Node` | `touch-start/move/end` | `Function` | `OneWayToSource` | 触摸事件回调上行到 ViewModel。 |

## 常见注意事项

1. `Binding` 会根据所选元素和属性动态收敛可选 `mode`，若看不到某个 mode，通常是该元素属性不支持。
2. `ItemsSource` 的 `template` 节点会在运行时作为克隆模板移出内容节点，模板本体不会直接显示。
3. 如果 `DataContext` / `ItemsSource` 在编辑器下提示“找不到上级 DataContext”，优先检查节点层级和挂载顺序。
4. 方法绑定（`Function`）建议统一使用 `OneWayToSource`，避免把事件型字段误配置成值同步模式。

## 入口导出

- `index.ts`：导出 `ViewModelData`、`BindingData`、`DataContextData`、`ItemsSourceData`，并转导出 `pure.ts` 的 API。
- `pure.ts`：导出装饰器与响应式 API（可用于纯 TS 场景，不依赖 Cocos 组件导出）。

## Reactive API

### 代理模式矩阵

| API | 顶层可写 | 深层可写 | 深层自动代理 |
| --- | --- | --- | --- |
| `reactive` | 是 | 是 | 是 |
| `shallowReactive` | 是 | 是（原始对象） | 否 |
| `readonly` | 否 | 否 | 是（深层 readonly） |
| `shallowReadonly` | 否 | 是（原始对象） | 否 |

### 常用函数

- 状态创建：`reactive` / `shallowReactive` / `readonly` / `shallowReadonly`
- 状态判断：`isReactive` / `isReadonly` / `isProxy`
- 原始对象：`toRaw`
- 派生状态：`computed`
- 侦听：`watchEffect` / `watch`（支持 `flush: 'sync' | 'post'`）
- 批处理：`batch`
- 错误处理：`setReactiveErrorHandler`（处理 `flush: 'post'` 的异步回调错误）

### 调度说明

- `watchEffect` 和 `watch` 默认 `flush: 'sync'`。
- 设置 `flush: 'post'` 后，会在微任务中合并同一轮同步更新。
- `computed` 采用惰性求值，仅在读取 `.value` 时重新计算。

## 📄 协议
MIT License