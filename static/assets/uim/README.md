# UIM 视图管理器

> 面向 Cocos Creator 的轻量 UI 管理模块，统一处理 View、MessageBox、Tooltip、音频与皮肤。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.0.0` |
| Cocos 版本 | `v3.8.8` |

## 简介
UIM 提供一套以 ViewManager 为中心的 UI 流程方案。
你可以把页面、消息框、提示框都注册到同一个模板表中，通过统一 API 完成显示、替换、回退、关闭等操作。

模块同时提供：
- 全局静态入口（Views、MessageBox、Tooltip），减少业务层对节点引用的依赖。
- 可选音频管理（Audios + AudioManager），支持 BGM 与音效统一控制。
- 可选皮肤管理（Skins + SkinManager + SkinSprite），支持主题切换和皮肤状态持久化。
- Resources 资源访问入口（由 CCResources 导出为 Resources）。

## 核心能力
- 视图栈管理：支持 showView、showAsReplace、showAsRoot、backView。
- 弹层管理：MessageBox 与 Tooltip 按名称去重，重复显示时走数据更新而不是重复创建。
- 统一事件流：基于 ViewEvent + ViewState（Show、Hide、Close、Data）驱动视图生命周期。
- 自动层级排序：按 ViewSortIndex 统一整理同父节点下的 UI 显示顺序。
- 音频控制：支持背景音乐、一次性音效、可管理音效、音量开关与资源释放。
- 皮肤切换：支持主题切换、激活项切换、可用/锁定状态管理与全场景 SkinSprite 刷新。

## 目录结构
```text
uim/
	components/
		AudioManager.ts
		MessageBoxBase.ts
		SkinManager.ts
		SkinSprite.ts
		TooltipBase.ts
		TooltipMultiple.ts
		ViewBase.ts
		ViewManager.ts
		ViewSort.ts
	core/
		Audios.ts
		CCResources.ts
		EventMutex.ts
		IAudioManager.ts
		ISkinManager.ts
		IViewManager.ts
		MessageBox.ts
		Skins.ts
		SkinStore.ts
		Tooltip.ts
		Views.ts
	index.ts
```

## 快速开始
1. 导入 `brief-toolkit` 资源到项目中。
2. 在场景 UI 根节点挂载 `ViewManager`，并配置：
	 - `viewContent`
	 - `viewList`
	 - `messageBoxList`
	 - `tooltipList`
	 - `defaultView`（可选）
3. 需要音频能力时，在常驻节点挂载 `AudioManager`。
4. 需要皮肤能力时，在常驻节点挂载 `SkinManager`，并指定 `skinItem` 配置。
5. 在业务代码中直接调用静态入口 `Views`、`MessageBox`、`Tooltip`、`Audios`、`Skins`。

## 最小调用示例
```ts
import {
	Views,
	MessageBox,
	MessageBoxButtons,
	MessageBoxResult,
	Tooltip,
	Audios,
	Skins,
} from '../brief-toolkit/uim';

// 页面显示
Views.showView('HomeView', { from: 'boot' });

// 替换当前页面
Views.showAsReplace('ShopView');

// 消息框
const result = await MessageBox.show('是否退出当前关卡？', '提示', MessageBoxButtons.YesNo);
if (result === MessageBoxResult.Yes) {
	Views.backView();
}

// 提示框（3秒后自动关闭）
Tooltip.show('购买成功', 3);

// 音频
Audios.switchMusic(true);
await Audios.playMusic('sound/bgm/main');
await Audios.playOneShot('sound/ui/click');

// 皮肤
Skins.switchTheme('default');
Skins.setActiveItem('avatar_01');
```

## 说明
- MessageBox.show 返回 Promise，可直接 await 获取按钮结果。
- Tooltip.show 同名重复调用会触发数据更新，适合做连续提示。
- Views、MessageBox、Tooltip、Audios、Skins 依赖对应 Manager 组件已在运行时绑定。

## 📄 协议
MIT License