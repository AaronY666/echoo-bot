# 🧠 Agent 持久记忆功能

> Agent 现在具备了持久记忆能力，可以记住历史对话并在未来的交流中引用！

## ⚡ 快速开始

```bash
# 1. 安装依赖
./install_memory_deps.sh

# 2. 运行测试
python3 test_memory.py

# 3. 开始使用
# 记忆功能默认已启用，无需额外配置
```

## ✨ 核心功能

### 短期记忆（自动）
- ✅ 记住最近 20 轮对话
- ✅ 重启应用后自动恢复
- ✅ 存储在本地 SQLite

### 长期记忆（自动）
- ✅ 每 20 轮自动生成摘要
- ✅ 语义检索历史记忆
- ✅ 存储在本地向量数据库

## 📖 文档

- **使用指南**：[plans/memory_usage_guide.md](plans/memory_usage_guide.md)
- **实施计划**：[plans/memory_implementation_plan.md](plans/memory_implementation_plan.md)
- **实施总结**：[plans/memory_implementation_summary.md](plans/memory_implementation_summary.md)

## ⚙️ 配置

所有配置在 `agent/memory_config.py`：

```python
SHORT_TERM_MEMORY_TURNS = 20        # 保留最近 20 轮对话
LONG_TERM_MEMORY_INTERVAL = 20      # 每 20 轮生成一次摘要
ENABLE_MEMORY = True                # 启用/禁用记忆功能
```

## 💡 使用示例

```python
from agent.langgraph_agent import LangGraphAgent

# 创建 Agent（记忆功能默认启用）
agent = LangGraphAgent()

# 第 1 次对话
agent.process({"message": "我叫小明，喜欢猫"})
# 回复：知道了...

# 第 2 次对话（记住了之前的内容）
agent.process({"message": "我刚才说我喜欢什么？"})
# 回复：你喜欢猫！

# 重启应用后仍然记得！
```

## 🔧 依赖说明

### 必需
- `langgraph` - 工作流编排
- `chromadb` - 向量数据库

### Embedding 模型（二选一）

**方案 A - OpenAI**（推荐）
```bash
# 在 .env 中设置
OPENAI_API_KEY=your_key
```

**方案 B - 本地模型**（免费）
```bash
pip install sentence-transformers torch
# 首次使用会自动下载模型（约 100MB）
```

## 📊 数据存储

```
data/
├── memory.db           # 短期记忆（SQLite）
└── chroma_db/         # 长期记忆（向量库）
```

## ❓ 常见问题

**Q: 记忆会占用多少空间？**
- 短期记忆：~40KB
- 长期记忆：~10KB/摘要
- 总计：对于个人使用可以忽略不计

**Q: 会影响响应速度吗？**
- 短期记忆：几乎无影响
- 长期记忆检索：增加 100-300ms

**Q: 如何清除记忆？**
```bash
# 删除数据目录
rm -rf data/
```

**Q: 如何禁用记忆？**
```python
agent = LangGraphAgent(enable_memory=False)
```

## 🎯 下一步

1. ✅ 运行测试：`python3 test_memory.py`
2. ✅ 查看详细文档：`plans/memory_usage_guide.md`
3. ✅ 调整配置：`agent/memory_config.py`
4. ✅ 开始使用！

---

📝 **更多细节请查看完整文档** → [plans/memory_usage_guide.md](plans/memory_usage_guide.md)

