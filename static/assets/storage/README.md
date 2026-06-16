# Storage 本地存储

> Cocos Creator 3.8.8 的轻量级本地存储模块，纯 TS 零依赖。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.0.0` |
| Cocos 版本 | `v3.8.8` |

## 简介

Storage 模块在 `sys.localStorage` 之上提供薄封装，解决新项目反复重写的痛点：
- **自动 JSON 序列化/反序列化** — 告别 `JSON.stringify` / `JSON.parse` 样板代码
- **类型安全的默认值回退** — `get(key, defaultValue)`，key 不存在时自动返回默认值
- **存储不可用时的内存降级** — 微信小游戏等环境下 `localStorage` 可能不可用，自动 fallback 到内存存储
- **可注入后端接口** — 可通过 `setBackend()` 替换底层实现

**边界声明**：这是一个**薄封装**，不包含加密、事务、版本迁移、多后端同步等高级功能。这些属于项目层职责。

## 目录结构

```
storage/
├── core/
│   ├── IStorage.ts          # 存储后端接口
│   ├── MemoryStorage.ts     # 内存 fallback 实现
│   └── Storage.ts           # 核心实现（静态门面）
├── index.ts                 # Cocos 运行时入口
├── pure.ts                  # 纯 TS 入口（零 cc 依赖）
└── README.md
```

## 快速开始

```ts
import { Storage } from 'db://assets/brief-toolkit/storage/pure';

// 写入（自动 JSON.stringify）
Storage.set('user.profile', { name: 'Player1', level: 5 });

// 读取（自动 JSON.parse）
const profile = Storage.get<{ name: string; level: number }>('user.profile');

// 带默认值（key 不存在或解析失败时返回默认值）
const volume = Storage.get('settings.volume', 0.8);

// 检查是否存在
if (Storage.has('user.profile')) { /* ... */ }

// 删除 / 列出 / 清空
Storage.remove('user.profile');
Storage.keys();      // 所有 key
Storage.clear();     // 清空全部
```

## 后端管理

### 默认行为

模块初始化时自动探测运行环境：
1. 优先使用 `sys.localStorage`（Cocos）或 `localStorage`（浏览器/Node.js）
2. 不可用时静默降级为 `MemoryStorage`（数据不持久化，进程重启丢失）

### 注入自定义后端

```ts
import { Storage, IStorageBackend } from 'db://assets/brief-toolkit/storage/pure';

// 自定义后端（如加密存储、云端同步等）
const encryptedBackend: IStorageBackend = {
  getItem(key) { /* 解密读取 */ },
  setItem(key, value) { /* 加密写入 */ },
  removeItem(key) { /* 删除 */ },
};

Storage.setBackend(encryptedBackend);
```

### 关闭自动降级

```ts
Storage.allowFallback = false;  // 后端异常将向上传播，不再静默忽略
```

## 与其他模块的配合

Storage 是推荐选项，不是强制规范。现有模块可以自由选择持久化方式：

```ts
// Guide 完成标记（可直接用 Storage）
Guider.setCompletionStorage({
  markCompleted: (key) => Storage.set(`guide:${key}`, true),
  isCompleted:  (key) => Storage.get(`guide:${key}`, false),
});

// i18n 语言记忆
Storage.set('i18n:language', 'en');
const lastLang = Storage.get('i18n:language', 'zh');

// 用户设置
Storage.set('settings', { volume: 0.8, theme: 'dark' });
```

## API 速查

| 方法 | 说明 |
| --- | --- |
| `set(key, value)` | 写入值（自动 JSON.stringify） |
| `get<T>(key, defaultValue?)` | 读取值（自动 JSON.parse + 类型泛型） |
| `has(key)` | 检查 key 是否存在 |
| `remove(key)` | 删除 key |
| `keys()` | 获取所有 key |
| `clear()` | 清空所有数据 |
| `setBackend(backend)` | 注入自定义后端 |
| `getBackend()` | 获取当前后端 |

## 📄 协议

MIT License
