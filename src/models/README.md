# Live2D 模型系统

这是一个灵活的 Live2D 模型管理系统，支持模型注册、动态加载和运行时切换。

## 核心组件

### 1. Live2DModelDefinition
模型定义类，包含模型的所有元数据：
- `id`: 唯一标识
- `name`: 显示名称
- `url`: 模型文件URL（支持本地路径和在线URL）
- `version`: Cubism版本（2或4）
- `scale`: 缩放比例
- `expressions`: 预定义表情列表（可选）
- `motions`: 预定义动作列表（可选）
- `defaultExpression/defaultMotion`: 默认状态
- `offset`: 位置偏移

### 2. ModelRegistry
全局模型注册表，管理所有可用模型：
```typescript
// 注册单个模型
ModelRegistry.register({
  id: "my-model",
  name: "My Model",
  url: "/models/my-model/model.json",
  version: 2,
});

// 批量注册
ModelRegistry.registerMany([...]);

// 获取模型
const model = ModelRegistry.get("my-model");

// 获取所有模型
const allModels = ModelRegistry.getAll();
```

### 3. 预设模型
`presets.ts` 包含4个预设的在线模型：
- Senko (Cubism 4)
- Hiyori (Cubism 4)
- Shizuku (Cubism 2)
- Tororo (Cubism 2)

## 使用方式

### 方式1：使用预设模型
```typescript
import { initPresetModels } from "@models/presets";

// 初始化预设模型（在 App.tsx 中）
initPresetModels();

// 预设模型会自动注册，useLive2D 会使用第一个模型
```

### 方式2：从配置文件加载
创建 `public/models/models.json`：
```json
{
  "models": [
    {
      "id": "custom-model",
      "name": "My Custom Model",
      "url": "/models/custom/model.json",
      "version": 2,
      "scale": 0.15
    }
  ]
}
```

在代码中加载：
```typescript
import { loadModelsFromConfig } from "@models/loader";

await loadModelsFromConfig("/models/models.json");
```

### 方式3：编程方式添加
```typescript
import { ModelRegistry, Live2DModelDefinition } from "@models";

const myModel = new Live2DModelDefinition({
  id: "my-model",
  name: "My Model",
  url: "https://example.com/model.json",
  version: 4,
  scale: 0.2,
  expressions: ["normal", "happy", "sad"],
  motions: ["idle", "tap"],
  defaultExpression: "normal",
  defaultMotion: "idle",
});

ModelRegistry.register(myModel);
```

## 在 Live2DManager 中使用

### 加载指定模型
```typescript
// 方式1：使用模型ID
const manager = new Live2DManager({
  container: element,
  modelId: "senko",
});

// 方式2：使用模型定义对象
const model = ModelRegistry.get("hiyori");
const manager = new Live2DManager({
  container: element,
  model: model,
});
```

### 运行时切换模型
```typescript
// 通过ID切换
await manager.switchModelById("shizuku");

// 通过模型定义切换
const model = ModelRegistry.get("tororo");
await manager.switchModel(model);

// 获取当前模型
const currentModelId = manager.getCurrentModelId();
const currentModel = manager.getCurrentModelDefinition();
```

## 模型切换UI

`ModelSwitcher` 组件提供可视化的模型切换界面：

```typescript
import { ModelSwitcher } from "@components/ModelSwitcher";

<ModelSwitcher
  currentModelId={currentModelId}
  onSwitch={(modelId) => manager.switchModelById(modelId)}
/>
```

## 最佳实践

1. **应用启动时初始化**
   ```typescript
   // App.tsx
   useEffect(() => {
     initPresetModels(); // 加载预设
     loadModelsFromConfig("/models/models.json").catch(console.warn); // 加载自定义
   }, []);
   ```

2. **模型文件组织**
   ```
   public/models/
     ├── models.json          # 配置文件
     ├── my-model/
     │   ├── model.json
     │   ├── textures/
     │   └── motions/
     └── another-model/
         └── ...
   ```

3. **错误处理**
   ```typescript
   try {
     await manager.switchModelById("unknown-model");
   } catch (err) {
     console.error("模型切换失败:", err);
   }
   ```

4. **性能优化**
   - 预设模型按稳定性排序（Cubism 2优先于Cubism 4）
   - 模型切换会自动清理旧模型资源
   - 支持懒加载（只加载选中的模型）

## 扩展功能

### 添加模型元数据
```typescript
ModelRegistry.register({
  id: "advanced-model",
  name: "Advanced Model",
  url: "/models/advanced/model.json",
  version: 4,
  scale: 0.18,
  offset: { x: 10, y: -20 }, // 位置微调
  expressions: ["normal", "happy", "sad", "angry"],
  motions: ["idle", "tap_body", "tap_head"],
  defaultExpression: "normal",
  defaultMotion: "idle",
  metadata: {
    author: "Artist Name",
    license: "CC BY 4.0",
    tags: ["anime", "girl"],
  },
});
```

### 按类型筛选模型
```typescript
// 获取所有在线模型
const onlineModels = ModelRegistry.getOnlineModels();

// 获取所有本地模型
const localModels = ModelRegistry.getLocalModels();

// 自定义筛选
const cubism4Models = ModelRegistry.getAll().filter(m => m.version === 4);
```

## 注意事项

1. 模型ID必须唯一
2. URL必须可访问（本地路径或有效的在线URL）
3. Cubism 2模型使用 `.model.json`，Cubism 4使用 `.model3.json`
4. 切换模型会清空当前动作和表情状态
5. 配置文件加载是异步的，需要正确处理错误

