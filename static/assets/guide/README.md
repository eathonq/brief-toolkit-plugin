# 引导管理

> Cocos Creator 3.8.8 的轻量级 UI 引导模块。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.0.0` |
| Cocos 版本 | `v3.8.8` |

## 简介
Guide 模块用于处理「任务-步骤」式引导流程，核心能力包括：

- 基于任务 key 的引导任务管理
- 基于节点路径的异步定位与等待
- 遮罩高亮与点击穿透控制
- 统一静态入口（Guider）调用

## 设计定位

本模块按单引导流程使用场景设计，默认不处理多引导并发执行。

任务数据建议在业务层完成前置校验后再注入（例如通过 `.schema.json` 校验），模块内部只做轻量判定与执行。

## 目录结构（当前实现）

```shell
guide
├── components
│   ├── GuideManager.ts          # 引导管理组件（任务加载、执行入口）
│   └── GuideStepAction.ts       # 单步动作执行（定位目标、监听交互）
├── core
│   ├── CCLocatorLoop.ts         # 节点定位器（支持分段路径 + 超时轮询）
│   ├── GuideMaskController.ts   # 遮罩控制器（高亮空洞 + 触摸拦截）
│   ├── Guider.ts                # 全局静态门面
│   └── IGuideManager.ts         # 类型与接口定义
├── index.ts                     # 模块导出入口
└── README.md
```

## 任务数据格式

`GuideTask` 基本结构如下：

```json
{
	"key": "task_01",
	"index": 0,
	"steps": [
		{
			"target": "Canvas>Panel>StartButton",
			"title": "第一步",
			"description": "点击开始按钮",
			"eventData": {
				"id": 1
			}
		}
	]
}
```

字段说明：

- `key`: 任务唯一标识
- `index`: 当前记录的步骤索引（可选）
- `steps`: 引导步骤列表
- `steps[n].target`: 目标节点路径，使用 `>` 分段

## 快速开始

1. 在场景中挂载 `GuideManager` 组件。
2. 在 `jsonTasks` 属性中配置一个或多个 JsonAsset 任务。
3. 在业务代码中通过 `Guider` 启动任务。

示例：

```ts
import { Guider } from 'db://assets/brief-toolkit/guide';

Guider.startTask('task_01', {
	stepIndex: 0,
	onFocusCallback: (focusData) => {
		// 每一步聚焦时回调，可用于放置手势图标/特效
	},
	onStepCallback: (step) => {
		// 每一步完成后回调
	},
});
```

## 对外 API

通过 `index.ts` 导出：

- `GuideManager`
- `Guider`
- `IGuideManager` 相关类型（`GuideTask`、`GuideStep`、`StartTaskOptions` 等）

## 说明

- `GuideManager` 负责任务注册、状态记录、步骤推进。
- `GuideStepAction` 负责识别目标节点并等待交互事件。
- `GuideMaskController` 负责遮罩绘制与点击区域控制。
- `CCLocatorLoop` 用于动态节点场景下的轮询定位。

## 📄 协议
MIT License