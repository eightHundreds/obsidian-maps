# Obsidian Maps (Fork)

> Fork 自 [Obsidian 官方 Maps 插件](https://github.com/obsidianmd/obsidian-maps)，增加了高德地图支持和弹窗编辑功能。

需要 [Obsidian 1.10](https://obsidian.md/changelog/2025-11-11-desktop-v1.10.3/) 或更高版本。

## 新增功能

### 高德地图支持

- 内置高德地图瓦片预设（矢量、卫星、卫星+路网）
- 支持 GCJ-02 坐标系（中国地图标准坐标系）
- 自动坐标转换，确保中国地图标注位置准确

### 弹窗形态编辑

- 地图点位支持弹窗形态展示
- 悬停显示笔记属性信息
- 点击可直接跳转到对应笔记

## 原有功能

为 [Obsidian Bases](https://help.obsidian.md/bases) 添加[地图布局](https://help.obsidian.md/bases/views/map)，让你可以将笔记以交互式地图视图展示。

![Map view for Obsidian Bases](/images/map-view.png)

- 动态显示符合筛选条件的标记点
- 使用属性定义标记图标和颜色
- 加载自定义背景瓦片
- 定义默认缩放选项

## 使用说明

### 添加高德地图背景

1. 打开 **设置 → Maps**
2. 在「背景」部分，从预设下拉菜单中选择：
   - 高德矢量
   - 高德卫星
   - 高德卫星 + 路网
3. 在地图视图中切换背景即可使用

### 自定义瓦片源

支持添加任意 XYZ 瓦片源，并可选择坐标系：
- **WGS-84**：国际标准坐标系（适用于 OpenStreetMap 等）
- **GCJ-02**：中国国测局坐标系（适用于高德、腾讯地图等）

## 安装

### 手动安装

1. 下载最新 release 中的 `main.js`、`manifest.json`、`styles.css`
2. 复制到 `<Vault>/.obsidian/plugins/maps/` 目录
3. 重启 Obsidian 并在 **设置 → 第三方插件** 中启用

## 相关链接

- [官方文档](https://help.obsidian.md/bases/views/map)
- [原版插件](https://github.com/obsidianmd/obsidian-maps)
