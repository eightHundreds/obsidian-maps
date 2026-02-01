# Obsidian Maps 插件

为 Obsidian Bases 提供交互式地图视图，支持中国地图服务（高德地图）和 GCJ-02 坐标转换。

## 快速开始

```bash
npm install
npm run dev    # 开发模式（带热重载）
npm run build  # 生产构建
```

## 项目结构

```
src/
  main.ts              # 插件入口，注册视图和命令
  map-view.ts          # 地图视图主类
  settings.ts          # 插件设置
  i18n.ts              # 国际化（中英文）
  map/
    coords.ts          # WGS-84 ↔ GCJ-02 坐标转换
    marker-manager.ts  # 标记管理
    popup-manager.ts   # 弹窗管理
    geolocation.ts     # 定位功能
    controls/          # 地图控件（缩放、背景切换、定位）
  property-types/      # 自定义属性类型（图标、颜色选择器）
```

## 技术栈

- **地图引擎**: MapLibre GL JS 5.8.0
- **构建工具**: ESBuild
- **语言**: TypeScript (strict mode)
- **框架**: Obsidian Plugin API

## 开发要点

### 坐标系统
- **WGS-84**: 国际标准（默认）
- **GCJ-02**: 中国地图（高德、腾讯）
- 使用中国瓦片时自动转换坐标

### 架构模式
- Manager 类封装功能模块
- 通过 Obsidian Plugin Data API 持久化设置
- 支持中英文国际化

### 测试
```bash
# 在测试库中测试
npm run dev
# 打开 examples/ 目录中的示例笔记
```

## 常见任务

- **添加新的地图控件**: 参考 `src/map/controls/` 中的现有控件
- **修改瓦片源**: 编辑 `src/settings.ts` 中的 `TILE_PRESETS`
- **调整样式**: 修改 `styles.css`
- **更新版本**: 运行 `npm run version`
