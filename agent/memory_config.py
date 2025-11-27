"""
记忆系统配置
"""

#-------------- 短期记忆配置 --------------
# 保留的最近对话轮数
SHORT_TERM_MEMORY_TURNS = 20

# SQLite 数据库路径
MEMORY_DB_PATH = "./data/memory.db"

# 默认用户 ID（单用户场景）
DEFAULT_USER_ID = "user_default"


#-------------- 长期记忆配置 --------------
# 触发长期记忆保存的频率（每 N 轮对话）
LONG_TERM_MEMORY_INTERVAL = 20

# Chroma 向量数据库路径
CHROMA_DB_PATH = "./data/chroma_db"

# 检索长期记忆时返回的结果数量
MEMORY_RETRIEVAL_TOP_K = 3

# 摘要生成时的最大 token 数
SUMMARY_MAX_TOKENS = 500


#-------------- 其他配置 --------------
# 是否启用记忆功能（用于调试）
ENABLE_MEMORY = True

# 是否打印记忆相关的调试信息
DEBUG_MEMORY = True

