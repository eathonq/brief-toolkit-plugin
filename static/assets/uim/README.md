# UIM 视图管理器

> 面向 Cocos Creator 3.8.8 的轻量 UI 管理模块，统一处理视图、消息框、提示框、场景切换、音频与皮肤。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.2.0` |
| Cocos 版本 | `v3.8.8` |

## 简介

UIM 提供一套以静态门面为核心的 UI 流程方案，支持 **两个入口**：

| 入口 | 路径 | 适用场景 |
|------|------|----------|
| `index.ts` | `brief-toolkit/uim` | 完整导出（含 Cocos Component），场景层使用 |
| `pure.ts` | `brief-toolkit/uim/pure` | **零 Cocos 依赖**，ViewModel / 单元测试 / Node.js 脚本使用 |

### 核心设计模式

```
                     UIM 统一模式 (Manager / Setting 分离)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  core/  (全局单例 + 接口 + 静态门面 + Null Object)             │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Audios ─bind─→ AudioManager ─implements─→ IAudioManager   │
│  │ Skins  ─bind─→ SkinManager  ─implements─→ ISkinManager    │
│  │ Scenes ─bind─→ SceneManager  ─implements─→ ISceneManager  │
│  │ Views  ─bind─→ ViewNavigator ─implements─→ IViewManager   │
│  │                                                    │     │
│  │ 未绑定时自动回退 → DefaultAudioManager / DefaultSkinMgr..   │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  components/  (场景级可选配置组件)                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ AudioSetting / SkinSetting (轻量 @property 配置)       │
│  │ ViewNavigator (场景级视图导航，每场景独立挂载)          │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 目录结构

```text
uim/
  components/
    AudioSetting.ts          可选组件 — 音频配置（defaultMusicClip / playOnLoad）
    MessageBoxBase.ts        消息框基类（继承 ViewBase）
    SkinSetting.ts           可选组件 — 皮肤配置（skinItem JSON）
    SkinSprite.ts            皮肤精灵组件
    TooltipBase.ts           提示框基类（继承 ViewBase）
    TooltipMultiple.ts       多提示框基类
    ViewBase.ts              视图基类（继承 ViewSort）
    ViewNavigator.ts         场景级视图导航组件（每场景独立挂载）
    ViewSort.ts              视图排序组件
  core/
    AudioManager.ts          音频管理器（全局单例，persistRootNode）
    Audios.ts                音频静态门面（pure）
    DateFormatter.ts         日期格式化（pure，i18n 模块）
    DefaultAudioManager.ts   音频默认空实现（pure）
    DefaultSceneManager.ts   场景管理默认空实现（pure）
    DefaultSkinManager.ts    皮肤默认空实现（pure）
    DefaultViewManager.ts    视图管理默认空实现（pure）
    EventMutex.ts            事件互斥锁（pure）
    IAudioManager.ts         音频管理接口（pure）
    ISceneManager.ts         场景管理接口 + 生命周期类型（pure）
    ISkinManager.ts          皮肤管理接口 + 类型定义（pure）
    IViewManager.ts          视图管理接口 + 枚举/类型（pure）
    MessageBox.ts            消息框静态门面（pure）
    SceneManager.ts          场景管理器（依赖 cc，init() 初始化）
    Scenes.ts                场景管理静态门面（pure）
    SkinManager.ts           皮肤管理器（全局单例）
    Skins.ts                 皮肤静态门面（pure）
    SkinStore.ts             皮肤数据存储（pure）
    Tooltip.ts               提示框静态门面（pure）
    Views.ts                 视图静态门面（pure）
  index.ts                   完整入口（Cocos Component + pure 全量导出）
  pure.ts                    纯 TS 入口（零 Cocos 依赖，ViewModel 专用）
```

## 快速开始

### 1. 场景层初始化

在场景 UI 根节点挂载 `ViewNavigator` 并配置 `viewContent`、`viewList`、`messageBoxList`、`tooltipList`。

在应用启动代码中初始化场景管理器：

```ts
import { SceneManager } from 'db://assets/brief-toolkit/uim';
SceneManager.init();
```

可选配置组件（仅编辑器便利，Manager 本身已是全局单例）：

- 需要音频时，挂载 `AudioSetting` 组件配置默认背景音乐。
- 需要皮肤时，挂载 `SkinSetting` 组件配置 `skinItem` JSON。

### 2. 场景层调用（Cocos Component 中）

```ts
import { Views, MessageBox, MessageBoxButtons, MessageBoxResult, Tooltip, ViewEvent } from 'db://assets/brief-toolkit/uim';

// 页面显示
Views.showView('HomeView', { from: 'boot' });

// 替换当前页面
Views.showAsReplace('ShopView');

// 消息框
const result = await MessageBox.show('是否退出？', '提示', MessageBoxButtons.YesNo);
if (result === MessageBoxResult.Yes) {
    Views.backView();
}

// 提示框（3 秒后自动关闭）
Tooltip.show('购买成功', 3);

// 监听视图事件
this.node.on(ViewEvent, (state, data) => { /* ViewState.Show / Hide / Close / Data */ });
```

### 3. ViewModel 层调用（纯 TS）

```ts
import { Views, MessageBox, Tooltip, Scenes, Audios, Skins } from 'db://assets/brief-toolkit/uim/pure';

// 视图操作
Views.showView('ShopView');

// 消息框
const result = await MessageBox.show('确认删除？', '警告', MessageBoxButtons.YesNo);

// 提示框
Tooltip.show('操作成功', 2);

// 场景切换
Scenes.onBeforeLeave.push(async (info) => {
    console.log(`Leaving ${info.fromScene} → ${info.toScene}`);
});
await Scenes.loadScene('BattleScene', { level: 5 });

// 音频
await Audios.playMusic('sound/bgm/main');
await Audios.playOneShot('sound/ui/click');

// 皮肤
Skins.switchTheme('summer');
```

### 4. 错误监控

```ts
import { Views } from 'db://assets/brief-toolkit/uim/pure';

Views.onError = (name, reason) => {
    console.error(`[UI] View "${name}" failed: ${reason}`);
};
```

### 5. 事件监听

```ts
// 语言切换（i18n）
I18n.on(I18nEventType.LANGUAGE_SWITCHED, ({ language }) => {
    console.log(`语言切换完成: ${language}`);
});
```

## 运行机制

### 全局单例自举

```
AudioManager / SkinManager / SceneManager
  └── constructor: Facade.bind(this)  ← 首次 instance 即自动绑定
      └── 未绑定时门面回退 Null Object，调用永不崩溃

ViewNavigator (场景级 Component)
  └── onLoad: __viewsBind(this)        ← 每场景独立绑定
```

### 静态门面统一接口

所有门面使用一致的 `get current()` 模式：

```ts
// 以 Views 为例
static get current(): IViewManager {
    return Views._currentViewManager ?? DefaultViewManager.instance;
}

// 代理方法直接委托
static showView(name, data): void {
    Views.current.showView(name, data);
}
```

### 事件驱动刷新

- **Skin**：状态变更 → 遍历活跃 `SkinSprite` 集合精确刷新，O(活跃数)
- **ViewEvent**：基于 `ViewState`（Show/Hide/Close/Data）驱动视图生命周期

## Demo

完整 Demo 见 [assets/demo/uim/](../../../demo/uim/)，包含：

| 组件 | 功能 |
|------|------|
| `MenuComponent` | Views 视图切换菜单（showView / backView / isTopView） |
| `ViewAComponent` | ViewEvent 事件监听示例（接收 pre-view 数据） |
| `MessageBoxComponent` | MessageBox 调用示例（EditBox 输入 → 按钮回调 → Result 日志） |
| `TooltipComponent` | Tooltip 调用示例（EditBox 输入 + Slider 超时控制） |
| `AudiosTestComponent` | Audios 音频播放/开关示例（按键音效 + 顺序/随机播放 + 音量/开关控制） |
| `SkinsTestComponent` | Skins 主题切换示例（ToggleGroup 切换主题 key） |

## 📄 协议

MIT License
