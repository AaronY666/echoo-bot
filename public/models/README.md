# Live2D 模型资源

## 使用说明

将 Live2D 模型文件放到此目录下，然后在代码中引用即可。

## 模型目录结构示例

```
public/models/
  ├── shizuku/
  │   ├── shizuku.model.json      (Cubism 2)
  │   ├── textures/
  │   └── motions/
  └── hiyori/
      ├── hiyori.model3.json      (Cubism 4)
      ├── textures/
      └── motions/
```

## 获取免费 Live2D 模型

### 1. 官方示例模型
下载地址：https://www.live2d.com/download/sample-data/

### 2. 开源模型资源
- https://github.com/xiazeyu/live2d-widget-models
- https://github.com/Eikanya/Live2d-model
- https://github.com/fghrsh/live2d_demo

### 3. 备选 CDN 模型（可能不稳定）

#### Cubism 2 模型
```javascript
// 示例 1
"https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json"

// 示例 2
"https://unpkg.com/live2d-widget-model-tororo@1.0.5/assets/tororo.model.json"
```

#### Cubism 4 模型
```javascript
// 示例 1
"https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Senko_Normals/senko.model3.json"

// 示例 2  
"https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/Hiyori/Hiyori.model3.json"
```

## 在代码中使用本地模型

修改 `src/components/Live2DPet/index.tsx` 中的模型路径：

```typescript
// 使用本地模型
const modelUrl = "/models/your-model-name/model.json";

// 或使用 CDN
const modelUrl = "https://unpkg.com/...";
```

## 注意事项

1. Cubism 2 模型使用 `.model.json` 格式
2. Cubism 4 模型使用 `.model3.json` 格式
3. 确保模型的所有资源文件（贴图、动作等）都在正确的相对路径下
4. 本地模型文件放在 `public/models/` 目录下会自动被 Vite 服务

