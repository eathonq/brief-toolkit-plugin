# i18n 国际化

> 基于 Cocos Creator 3.8.8 的轻量级国际化模块（文本 + 图片）。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.0.0` |
| Cocos 版本 | `v3.8.8` |

## 简介
i18n 模块用于统一管理语言数据、文本取值和图片路径映射。

核心设计分为三层：
- `LocalizedManager`：场景侧配置入口（默认语言、资源目录、编辑器显示模式）。
- `LocalizedRenderer`：运行时核心（加载语言 JSON、扁平化 key、切换语言、刷新组件）。
- `LocalizedLabel` / `LocalizedSprite`：组件绑定层（自动把 key 映射到 Label 文本或 SpriteFrame）。

## 当前目录结构
```shell
├── i18n
│   ├── components
│   │   ├── LocalizedLabel.ts         # 文本本地化组件（Label/RichText/EditBox）
│   │   ├── LocalizedManager.ts       # 场景中的语言管理组件
│   │   └── LocalizedSprite.ts        # 图片本地化组件（Sprite）
│   ├── core
│   │   ├── CCResources.ts            # 资源加载封装（json/spriteFrame）
│   │   ├── I18n.ts                   # i18n 静态门面
│   │   ├── I18nEditorBridge.ts       # 编辑器模式下的图片解析桥接
│   │   ├── ILocalizedRenderer.ts     # 渲染器接口与编辑模式枚举
│   │   ├── LocalizedRenderer.ts      # 本地化核心实现
│   │   └── StringUtil.ts             # 字符串工具（通用工具）
│   └── index.ts                      # 导出入口（I18nLabel/I18nSprite/I18nSwitch 等）
```

## 语言资源规范

默认资源目录为 `resources/i18n`，可在 `LocalizedManager.assetPath` 中修改。

### 1. 语言 JSON（示例：`resources/i18n/zh.json`）
```json
{
	"meta": {
		"code": "zh",
		"name": "中文",
		"version": "1.0.0"
	},
	"common": {
		"confirm": "确认"
	},
	"args": {
		"welcome": "欢迎来到{0}!"
	},
	"image": {
		"home": "home"
	}
}
```

说明：
- `meta.code` / `meta.name` 为必填。
- 文本 key 支持点语法，如 `common.confirm`。
- 参数占位符使用 `{0}`、`{1}`。
- 图片 key 的值是相对文件名（不带后缀），最终会拼成：`{assetPath}/{language}/{value}`。

### 2. 图片资源目录（示例）
```shell
resources
└── i18n
		├── zh
		│   └── home.png
		├── en
		│   └── home.png
		├── zh.json
		└── en.json
```

## 快速开始

### 1. 场景中挂载 LocalizedManager
- 将 `LocalizedManager` 挂到场景常驻节点。
- 在 `defaultAsset` 指向一个默认语言 JSON（例如 `resources/i18n/zh`）。
- `assetPath` 默认 `i18n`，对应 `resources/i18n`。

### 2. 文本本地化
- 在含有 `Label` / `RichText` / `EditBox` 的节点挂 `LocalizedLabel`。
- 设置 `key`（如 `common.confirm`）。
- 需要参数时填写 `args`（如 `Game` -> 匹配 `{0}`）。

### 3. 图片本地化
- 在含有 `Sprite` 的节点挂 `LocalizedSprite`。
- 设置 `key`（如 `image.home`）。

### 4. 代码切换语言
```ts
import { I18n } from "../brief-toolkit/i18n/core/I18n";

// 切换到英文
await I18n.switch("en");

// 获取文本
const confirmText = I18n.text("common.confirm");
const welcomeText = I18n.text("args.welcome", ["Game"]);
```

## 运行机制说明
- `LocalizedRenderer` 在设置 `languageAsset` 时会读取 JSON 并扁平化为 `Map`，提升 key 查找效率。
- `switch(language)` 会加载 `{assetPath}/{language}` 对应的 `JsonAsset`，成功后释放旧语言资源并刷新。
- `LocalizedLabel` 会在 `onLoad` 与语言切换刷新时更新文本。
- 编辑器下可通过 `LocalizedManager.labelModel` 在“显示实际文本”和“显示 key 路径”之间切换。

## 注意事项
- 语言 JSON 的 `meta` 节点必须合法（至少包含 `code` 和 `name`），否则会报错并无法切换。
- `LocalizedLabel` 仅在节点上存在 `Label` / `RichText` / `EditBox` 时生效。
- `LocalizedSprite` 仅在节点上存在 `Sprite` 时生效。
- 当前实现中，运行时与预览模式下 `switch()` 会自动刷新文本与图片组件。
- 纯编辑器模式（`EDITOR`）下，`LocalizedSprite` 没有加载图片（除非使用了编辑器桥接）。

## 编辑器桥接（可选）
如果你希望在纯编辑器模式下也实时看到 `LocalizedSprite` 切图：

说明：
- 该通道默认未注册，不影响运行时逻辑。
- 建议仅在 Editor Extension 中使用，避免把编辑器 API 混入运行时代码。

本仓库已提供一个最小扩展：
- `extensions/brief-toolkit-i18n-editor`

启用步骤：
1. 打开 Cocos Creator。
2. 进入 `扩展 -> 扩展管理器 -> 项目`。
3. 启用 `brief-toolkit-i18n-editor`。
4. 刷新扩展（必要时重启编辑器）。

## 导出别名（index.ts）
- `I18nRenderer` -> `LocalizedRenderer`
- `I18nSwitch` -> `LocalizedManager`
- `I18nLabel` -> `LocalizedLabel`
- `I18nSprite` -> `LocalizedSprite`
- `I18n` -> 静态门面

## 📄 协议
MIT License