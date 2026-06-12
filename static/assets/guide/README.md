# 引导管理

> Cocos Creator 3.8.8 的轻量级 UI 引导模块。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.3.0` |
| Cocos 版本 | `v3.8.8` |

## 简介

基于「任务-步骤」模式的引导流程引擎，定位为 **UI 层教学演示播放器**——接收步骤数据，播放遮罩高亮、指示器、对话框，等待用户交互后推进。

支持：

- 遮罩高亮目标节点 + 点击穿透控制
- 多种聚焦形状（矩形 / 圆形 / 圆角矩形 / 椭圆）+ 外扩边距
- 步骤切换平滑动画（镂空位移 + 大小过渡）
- 对话框 / 指示器自动定位 + 方向避让
- 5 种交互触发类型 + 3 种完成条件
- 步骤前进 / 回退 / 跳转 / 暂停 / 恢复
- 步骤回调出口（埋点、音效等外部逻辑注入）
- 步骤进度指示器 + 点击跳步 + 导航按钮（`GuideDialogProgress` 附件）
- 轻量完成标记（对接外部存盘系统）

## 目录结构

```shell
guide
├── components
│   ├── GuideDialogBase.ts       # 对话框基类（标题 + 描述 + 自动定位）
│   ├── GuideDialogProgress.ts   # 进度对话框（步骤指示器 + Prev/Next/Finish 导航）
│   ├── GuidePointerBase.ts      # 指示器基类（自动定位 + 方向翻转 + 动画）
│   └── GuideSetting.ts          # 编辑器装配组件（挂载到场景，含聚焦 + 对话 + 指示器配置）
├── core
│   ├── CCLocatorLoop.ts         # 节点定位器（分段路径 + 超时轮询）
│   ├── GuideFocus.ts            # 遮罩高亮（镂空 + 多形状 + 切换动画 + 触摸拦截）
│   ├── GuideInteractionHandler.ts # 交互处理器（trigger 解析 + 条件校验 + 事件监听）
│   ├── GuideManager.ts          # 引导管理器（纯逻辑单例，状态机驱动）
│   ├── GuidePosition.ts         # 位置计算工具（多方向尝试 + 屏幕边界适配 + 包围盒共享）
│   ├── GuideStepAction.ts       # 步骤编排（定位 → 显示 → 委托交互）
│   ├── Guider.ts                # 全局静态门面 + 完成标记 API
│   └── IGuideManager.ts         # 类型与接口定义
├── index.ts                     # 模块导出入口
└── README.md
```

## 架构

```
Guider (静态门面 + 完成标记 API)
  └─ GuideManager (单例，状态机驱动)
       ├─ GuideStepAction (步骤编排)
       │    ├─ CCLocatorLoop (定位目标节点)
       │    ├─ GuideFocus (遮罩高亮，多形状 + 动画)
       │    ├─ IGuidePointer → GuidePointerBase (指示器)
       │    ├─ IGuideDialog → GuideDialogBase (对话框)
       │    └─ GuideInteractionHandler (trigger + 条件 + 交互)
       └─ GuidePosition (方向计算 + 包围盒，被 dialog/pointer/focus 共用)
```

**状态机**：

```
idle → startTask() → running → 最后一步完成 → completed
                 running → jumpTo(n)    → running (重新进入目标步骤)
                 running → previousStep → running (回退)
                 running → nextStep     → running (前进)
                 running → pauseTask()  → paused
                 paused  → resumeTask() → running
                 running → stopTask()   → stopped
                 paused  → stopTask()   → stopped
```

## 边界说明

引导系统是 **UI 播放器**，不负责以下任务系统职责：

| 不属于引导系统 | 应由任务系统处理 |
| --- | --- |
| 何时触发引导 | 任务系统判断条件，满足后调 `Guider.startTask()` |
| 多引导串行/队列 | 任务系统管理顺序 |
| 进度持久化存储 | 任务系统通过 `Guider.setCompletionStorage()` 注入存储 |
| 步骤数据动态化 | 任务系统在调用前将动态数据写入 dialog 字段 |

## GuideSetting 配置

编辑器装配组件，挂载到场景根节点或常驻节点（如 Canvas）上。

### 聚焦配置

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `Mask` | `boolean` | `true` | 显示遮罩（关闭后镂空区域外无颜色遮挡） |
| `Mask Color` | `Color` | `(0,0,0,180)` | 遮罩颜色 |
| `Focus Shape` | `enum` | `rectangle` | 聚焦窗口形状：`rectangle` / `circle` / `rounded_rect` / `ellipse` |
| `Switch Duration` | `number` | `0.5` | 步骤切换动画时长（秒，0 = 无动画/snap） |
| `Focus Margin` | `number` | `8` | 聚焦窗口外扩距离（px） |
| `Focus Gap` | `number` | `8` | 聚焦窗口与对话框/指示器的间距（px） |

### 对话 & 指示器配置

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `Dialog` | `boolean` | `true` | 启用引导对话 |
| `Dialog Prefab` | `Prefab` | — | 对话框 Prefab（根节点需挂载 GuideDialogBase 子类组件） |
| `Pointer` | `boolean` | `true` | 启用引导指示器 |
| `Pointer Prefab` | `Prefab` | — | 指示器 Prefab（根节点需挂载 GuidePointerBase 子类组件） |

## 任务数据格式

```json
{
  "key": "task_01",
  "steps": [
    {
      "target": "Canvas>Panel>StartButton",
      "dialog": {
        "title": "第一步",
        "description": "点击开始按钮"
      }
    },
    {
      "id": "step_volume",
      "target": "Canvas>Panel>VolumeSlider",
      "focus": { "shape": "rounded_rect", "margin": 12 },
      "condition": {
        "type": "property_equal",
        "params": { "property": "progress", "operator": "gte", "value": 0.8 }
      },
      "dialog": { "title": "将音量调到 80% 以上" },
      "pointer": { "position": "right" }
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `key` | `string` | 任务唯一标识 |
| `index` | `number` | 当前进度（自动维护） |
| `steps[].id` | `string` | 步骤唯一标识，用于 `jumpTo()` 跳转（不配置则使用数组索引） |
| `steps[].target` | `string` | 目标节点路径，`>` 分段 |
| `steps[].trigger` | `StepTriggerType` | 触发类型（不配则根据组件推断） |
| `steps[].condition` | `StepCondition` | 完成条件（不配则交互即完成） |
| `steps[].focus` | `FocusStyleOverride` | 聚焦样式覆盖（不配则使用 GuideSetting 全局配置） |
| `steps[].dialog` | `DialogConfig` | 对话配置，存在即显示 |
| `steps[].pointer` | `PointerConfig \| false` | 指示器配置，`false` 强制不显示 |

### 聚焦样式覆盖（FocusStyleOverride）

步骤级 `focus` 字段可覆盖 GuideSetting 全局配置中的任意子集，未指定的字段自动 fallback 到全局值：

```json
{
  "focus": {
    "shape": "rounded_rect",
    "margin": 12,
    "switchDuration": 0.3
  }
}
```

| 子字段 | 类型 | 说明 |
| --- | --- | --- |
| `shape` | `'rectangle' \| 'circle' \| 'rounded_rect' \| 'ellipse'` | 聚焦窗口形状 |
| `margin` | `number` | 目标区域外扩（px） |
| `switchDuration` | `number` | 步骤切换动画时长（秒，0 = 无动画） |
| `maskColor` | `{ r, g, b, a }` | 遮罩颜色 |

### 触发类型

| trigger | 组件推断 | 交互方式 |
| --- | --- | --- |
| `click` | Button / 其他 | 点击目标节点 |
| `input_done` | EditBox | 进入编辑态后退出（失焦/回车） |
| `slide` | Slider | 拖拽 Handle / 点击背景条松手 |
| `toggle` | ToggleContainer | 点击任意子 Toggle 切换选项 |
| `page_turn` | PageView | 滑动翻页（PAGE_TURNING 事件） |

### 条件类型

| type | 适用 trigger | 参数 |
| --- | --- | --- |
| `property_equal` | 所有 | `{ property, value?, operator?, tolerance? }` |
| `toggle_index` | `toggle` | `{ index }` |
| `page_index` | `page_turn` | `{ index }` |

`property_equal` 支持的 operator：

| operator | 含义 |
| --- | --- |
| `eq`（默认） | `===` |
| `neq` | `!==` |
| `gt` / `gte` / `lt` / `lte` | 数值比较 |
| `notEmpty` | 非空（不需要 value） |

## 快速开始

1. 场景挂载 `GuideSetting`，配置 `dialogPrefab` / `pointerPrefab` / `guideConfig`
2. 在编辑器中将 prefab 上的组件替换为自定义子类（如 `GuideDialogProgress`），绑定属性
3. 业务代码通过 `Guider` 调用：

```ts
import { Guider } from 'db://assets/brief-toolkit/guide';

// 启动引导
Guider.startTask(0);          // 从步骤 0 开始
Guider.nextStep();            // 前进到下一步
Guider.previousStep();        // 回退到上一步
Guider.jumpTo('step_volume'); // 跳转到指定步骤（按 id 或索引）
Guider.jumpTo(3);             // 按索引跳转
Guider.stopTask();            // 停止
Guider.pauseTask();           // 暂停
Guider.resumeTask();          // 恢复
```

## 步骤回调

`GuideTask` 支持步骤级回调，用于埋点、音效等外部逻辑注入。

```ts
const task: GuideTask = {
  key: 'newbie',
  steps: [...],
  onStepEnter: (index, step) => {
    Analytics.track('guide_step', { step: index });
  },
  onStepLeave: (index, step) => {
    console.log(`离开步骤 ${index}`);
  },
  onComplete: () => {
    RedDotManager.refresh();
  },
  onStop: () => {
    console.log('引导被中断');
  },
};

// 在 GuideSetting.initGuide() 中注入回调后 setup
GuideManager.instance.setup(task, stepAction);
```

## 完成标记

轻量完成标记 API，引导走完后自动标记，无需手动调用。

```ts
import { Guider } from 'db://assets/brief-toolkit/guide';

// 游戏初始化时注入存储实现
Guider.setCompletionStorage({
  markCompleted: (key) => sys.localStorage.setItem(`guide:${key}`, '1'),
  isCompleted:  (key) => sys.localStorage.getItem(`guide:${key}`) === '1',
});

// 启动前检查
if (!Guider.isCompleted('newbie')) {
  Guider.startTask(0);
}
// 引导完成后自动调用 markCompleted(key)
```

## 自定义组件

### 自定义对话框

继承 `GuideDialogBase`，重写 `show()` 即可：

```ts
class MyDialog extends GuideDialogBase {
  override show(...args): GuidePositionResult {
    const result = super.show(...args);
    // 自定义 UI 逻辑（进度条、步骤指示器、按钮等）
    return result;
  }
}
```

`GuideDialogProgress` 是内置的子类实现，提供：

- Prev / Next / Finish 导航按钮
- 步骤进度指示器（圆点），点击可跳转到指定步骤
- 首尾步骤自动隐藏 Prev/Next 按钮

### 自定义指示器

继承 `GuidePointerBase`，可用 `currentDirection` 实现自定义翻转。

## 对外 API

通过 `index.ts` 导出：

| 导出 | 类型 | 说明 |
| --- | --- | --- |
| `GuideManager` | 单例 | 运行时管理器 |
| `Guider` | 静态门面 | 便捷调用入口 + 完成标记 API |
| `GuideSetting` | Component | 编辑器装配组件 |
| `GuideFocus` | Class | 遮罩高亮（多形状 + 动画） |
| `GuideDialogBase` | Component | 对话框基类 |
| `GuidePointerBase` | Component | 指示器基类 |
| `GuidePosition` | 工具类 | 位置计算 + 包围盒共享 |
| `IGuideCompletionStorage` | type | 完成标记存储接口 |
| `Direction` / `CalcOptions` / `GuidePositionResult` | type | 位置计算相关类型 |
| `GuideTask` / `GuideStep` / `*` | type | 通过 `export * from IGuideManager` |

### Guider 完整 API

| 方法 | 说明 | 版本 |
| --- | --- | --- |
| `startTask(stepIndex?)` | 开始引导 | v1.0 |
| `stopTask()` | 停止当前引导 | v1.0 |
| `pauseTask()` | 暂停 | v1.0 |
| `resumeTask()` | 恢复 | v1.0 |
| `previousStep()` | 回退到上一步 | v1.0 |
| `nextStep()` | 前进到下一步 | v1.3.0 |
| `jumpTo(stepIdOrIndex)` | 跳转到指定步骤 | v1.3.0 |
| `isRunning()` | 是否正在执行 | v1.0 |
| `getTaskRecord()` | 获取当前进度 | v1.0 |
| `setCompletionStorage(s)` | 注入完成标记存储 | v1.3.0 |
| `isCompleted(key)` | 查询引导是否已完成 | v1.3.0 |

## 📄 协议

MIT License
