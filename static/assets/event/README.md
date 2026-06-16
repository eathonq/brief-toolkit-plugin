# Event 事件总线

> Cocos Creator 3.8.8 的轻量级全局事件总线，纯 TS 零依赖。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.0.0` |
| Cocos 版本 | `v3.8.8` |

## 简介

Event 模块提供一个纯 TS 零依赖的全局静态发布/订阅（pub/sub），用于项目模块间的解耦通信。

## 目录结构

```
event/
├── core/
│   └── EventBus.ts        # 事件总线实现
├── index.ts               # Cocos 运行时入口
├── pure.ts                # 纯 TS 入口（零 cc 依赖）
└── README.md
```

## 快速开始

```ts
import { EventBus } from 'db://assets/brief-toolkit/event/pure';

// 发送事件
EventBus.emit('inventory:item-acquired', { id: 'sword_001', count: 1 });

// 订阅事件
const token = EventBus.on('inventory:item-acquired', (data) => {
  console.log(`获得物品: ${data.id} x${data.count}`);
});

// 取消订阅
EventBus.offByToken(token);

// 一次性订阅
EventBus.once('startup-complete', () => {
  console.log('启动完成，仅触发一次');
});

// 清空所有事件（慎用）
EventBus.clear();
```

## 与 MVVM 内部 EventBus 的关系

MVVM 模块内部有自己的 EventBus（`mvvm/core/EventBus.ts`），用于驱动 `this.emit()` + `@event` 装饰器的 VM 间通信。两者是独立副本，各自服务各自的边界：

| | event/EventBus | mvvm 内部 EventBus |
| --- | --- | --- |
| 使用入口 | `EventBus.emit/on/off`（直接调用） | `this.emit()` + `@event`（封装入口） |
| 适用场景 | 项目模块间解耦（游戏系统 ↔ 游戏系统） | ViewModel 间通信（VM ↔ VM） |
| 公开导出 | ✅ 从 pure.ts 公开 | ❌ 框架内部，不对外 |

这样设计保证每个模块可独立按需取用——项目只用 event 模块而不引入 MVVM 完全可行，反之亦然。

## API 速查

```ts
import { EventBus } from 'db://assets/brief-toolkit/event/pure';

// 发送
EventBus.emit('event-name', payload?);

// 订阅 / 一次性 / 取消
const token = EventBus.on('event-name', callback);
EventBus.once('event-name', callback);
EventBus.off('event-name', callback);
EventBus.offByToken(token);

// 管理
EventBus.clear('event-name');   // 清空指定事件
EventBus.clear();               // 清空全部
EventBus.subscriberCount('name');  // 订阅者数量
```

## 事件命名建议

使用 `module:action` 格式避免冲突：

```
inventory:item-acquired
achievement:unlocked
player:level-up
network:disconnected
```

## 📄 协议

MIT License
