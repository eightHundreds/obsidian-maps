# 自定义属性类型实现笔记

## Obsidian 属性系统的内部机制

Obsidian 没有公开文档化属性类型系统的 API。以下信息来自逆向工程和参考其他插件（obsidian-better-properties、obsidian-sets）。

### 类型持久化

属性类型分配存储在 `.obsidian/types.json`，格式为 `{ "propertyName": "typeName" }`。当用户在属性类型下拉菜单中选择类型时，Obsidian 内部调用 `metadataTypeManager.setType()`。

### `render` 函数的 `data` 参数

这是最大的坑。Obsidian 传给 `render` 的 `data` 参数格式**不一致**：

- 首次渲染（用户刚选择类型时）：`{ value: "actual-value" }`
- 重新打开笔记时：直接是 `"actual-value"`

没有任何文档说明这一点。我们最初假设总是 `{ value: ... }` 格式，导致重新打开笔记后值显示为空。

### `default` 方法是必需的

虽然 TypeScript 类型定义中 `default` 看起来是可选的，但实际上**必须提供**。缺少它会导致类型选择无法正确持久化。这个行为没有文档，只能通过对比其他插件发现。

## 注册时机

必须在 `onLayoutReady` 中注册，不能在 `onload` 中直接注册。原因是 `metadataTypeManager` 在 layout ready 之前可能还没完全初始化。

## 图标系统

`getIconIds()` 返回的是 Obsidian 内置的 Lucide 图标 ID 列表。图标 ID 格式为 `lucide-xxx`，但 `setIcon()` 也接受不带前缀的格式。为保持一致性，我们统一使用带 `lucide-` 前缀的格式。

## 颜色系统

Obsidian 主题使用 CSS 变量定义颜色。我们的预设颜色包含 `var(--color-red)` 等格式，这样用户选择的颜色会跟随主题变化。但要注意：

- `var(--color-xxx)` 在原生颜色选择器中无法预览（显示为默认色）
- 只有在实际渲染到 DOM 时才能正确显示

## 参考的开源项目

- **obsidian-better-properties**：最完整的参考，但代码量大、抽象层多，不容易直接复用
- **obsidian-sets**：简单直接，password 和 link 类型的实现是很好的起点

## 未解决的问题

- `metadataTypeManager` 是内部 API，未来版本可能变化
- 没有官方方式监听属性类型变更事件
