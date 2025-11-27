"""
长期记忆管理器 - 使用向量数据库存储和检索历史对话摘要
"""
import os
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from .logger import log
from .memory_config import (
    CHROMA_DB_PATH,
    MEMORY_RETRIEVAL_TOP_K,
    SUMMARY_MAX_TOKENS,
    DEBUG_MEMORY
)


load_dotenv()


class MemoryManager:
    """长期记忆管理器"""
    
    def __init__(self, user_id: str):
        """
        初始化记忆管理器
        
        Args:
            user_id: 用户 ID
        """
        self.user_id = user_id
        self.db_path = CHROMA_DB_PATH
        
        # 初始化豆包模型（用于生成摘要）
        ark_api_key = os.getenv("ARK_API_KEY")
        ark_model_id = os.getenv("ARK_MODEL_ID")
        
        if not ark_api_key or not ark_model_id:
            raise ValueError("缺少必要的环境变量: ARK_API_KEY 或 ARK_MODEL_ID")
        
        self.llm = ChatOpenAI(
            model=ark_model_id,
            api_key=ark_api_key,
            base_url="https://ark.cn-beijing.volces.com/api/v3",
            temperature=0.1,  # 低温度，生成更稳定的摘要
            max_tokens=SUMMARY_MAX_TOKENS
        )
        
        # 初始化 Embedding 模型
        # 优先使用 OpenAI，如果失败则使用本地模型
        self.embeddings = self._init_embeddings()
        
        # 初始化向量数据库
        self.vectorstore = Chroma(
            collection_name=f"memory_{user_id}",
            embedding_function=self.embeddings,
            persist_directory=self.db_path
        )
        
        if DEBUG_MEMORY:
            log(f"✅ MemoryManager 初始化完成 (用户: {user_id})")
    
    def _init_embeddings(self):
        """
        初始化 Embedding 模型，支持多种备选方案
        
        优先级：
        1. OpenAI Embeddings（如果有 OPENAI_API_KEY）
        2. HuggingFace 本地模型（sentence-transformers）
        3. 简单的文本向量化（作为最后的备选）
        """
        # 方案 1: OpenAI Embeddings
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            try:
                from langchain_openai import OpenAIEmbeddings
                embeddings = OpenAIEmbeddings(
                    model="text-embedding-ada-002",
                    api_key=openai_key
                )
                if DEBUG_MEMORY:
                    log("✅ 使用 OpenAI Embeddings")
                return embeddings
            except Exception as e:
                log(f"⚠️ OpenAI Embeddings 初始化失败: {str(e)}")
        
        # 方案 2: HuggingFace 本地模型
        try:
            from langchain_huggingface import HuggingFaceEmbeddings
            embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
            if DEBUG_MEMORY:
                log("✅ 使用 HuggingFace 本地 Embeddings (首次使用会自动下载模型)")
            return embeddings
        except Exception as e:
            log(f"⚠️ HuggingFace Embeddings 初始化失败: {str(e)}")
        
        # 方案 3: 如果都失败，抛出错误并提示
        error_msg = """
❌ 无法初始化 Embedding 模型！

请选择以下任一方案：

方案 1 - 使用 OpenAI Embeddings（推荐）:
  1. 在 .env 中设置: OPENAI_API_KEY=your_key
  2. 重启应用

方案 2 - 使用本地模型（免费）:
  1. 安装依赖: pip install sentence-transformers
  2. 重启应用（首次会自动下载模型约 100MB）

方案 3 - 暂时禁用长期记忆:
  在 agent/memory_config.py 中设置: ENABLE_MEMORY = False
"""
        log(error_msg)
        raise RuntimeError("无法初始化 Embedding 模型")
    
    def generate_summary(self, messages: List[BaseMessage]) -> str:
        """
        生成对话摘要
        
        Args:
            messages: 消息列表
            
        Returns:
            摘要文本
        """
        if not messages:
            return ""
        
        # 格式化对话历史
        conversation = self._format_messages(messages)
        
        # 构建摘要 prompt
        prompt = f"""请总结以下对话的关键信息，包括：
1. 用户提到的重要事实、偏好、计划
2. 重要的讨论主题和上下文
3. 需要记住的信息

对话内容：
{conversation}

请用简洁的语言总结（300字以内），重点突出需要记住的信息："""
        
        try:
            if DEBUG_MEMORY:
                log(f"🤔 生成摘要中... (消息数: {len(messages)})")
            
            response = self.llm.invoke([HumanMessage(content=prompt)])
            summary = response.content
            
            if DEBUG_MEMORY:
                log(f"✅ 摘要生成完成 ({len(summary)} 字符)")
            
            return summary
        except Exception as e:
            log(f"❌ 摘要生成失败: {str(e)}")
            # 降级方案：直接返回对话内容的截断版本
            return conversation[:500] + "..."
    
    def save_summary(self, summary: str, start_turn: int, end_turn: int):
        """
        保存摘要到向量数据库
        
        Args:
            summary: 摘要文本
            start_turn: 起始轮数
            end_turn: 结束轮数
        """
        if not summary:
            return
        
        try:
            metadata = {
                "user_id": self.user_id,
                "start_turn": start_turn,
                "end_turn": end_turn,
                "timestamp": datetime.now().isoformat(),
                "type": "conversation_summary"
            }
            
            self.vectorstore.add_texts(
                texts=[summary],
                metadatas=[metadata]
            )
            
            # Chroma 会自动持久化
            
            if DEBUG_MEMORY:
                log(f"💾 摘要已保存到向量数据库 (第 {start_turn}-{end_turn} 轮)")
        except Exception as e:
            log(f"❌ 保存摘要失败: {str(e)}")
    
    def retrieve_relevant_memories(self, query: str, k: int = MEMORY_RETRIEVAL_TOP_K) -> str:
        """
        检索相关的长期记忆
        
        Args:
            query: 查询文本（通常是用户的当前输入）
            k: 返回的结果数量
            
        Returns:
            格式化的记忆文本
        """
        try:
            results = self.vectorstore.similarity_search(query, k=k)
            
            if not results:
                return ""
            
            memories = []
            for doc in results:
                meta = doc.metadata
                start = meta.get("start_turn", "?")
                end = meta.get("end_turn", "?")
                memories.append(f"[第 {start}-{end} 轮对话] {doc.page_content}")
            
            return "\n\n".join(memories)
        except Exception as e:
            log(f"❌ 检索记忆失败: {str(e)}")
            return ""
    
    def get_all_memories(self) -> List[dict]:
        """获取所有记忆（用于调试和管理）"""
        try:
            # Chroma 没有直接的"获取所有"方法，这里使用一个技巧
            results = self.vectorstore.similarity_search("", k=100)
            
            memories = []
            for doc in results:
                memories.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata
                })
            
            return memories
        except Exception as e:
            log(f"❌ 获取所有记忆失败: {str(e)}")
            return []
    
    def clear_all_memories(self):
        """清除所有记忆（慎用）"""
        try:
            # 删除并重新创建 collection
            self.vectorstore.delete_collection()
            
            # 重新创建
            self.vectorstore = Chroma(
                collection_name=f"memory_{self.user_id}",
                embedding_function=self.embeddings,
                persist_directory=self.db_path
            )
            
            log(f"🗑️ 已清除所有长期记忆 (用户: {self.user_id})")
        except Exception as e:
            log(f"❌ 清除记忆失败: {str(e)}")
    
    def _format_messages(self, messages: List[BaseMessage]) -> str:
        """
        格式化消息列表为文本
        
        Args:
            messages: 消息列表
            
        Returns:
            格式化的文本
        """
        lines = []
        for msg in messages:
            if isinstance(msg, HumanMessage):
                lines.append(f"用户: {msg.content}")
            elif isinstance(msg, AIMessage):
                lines.append(f"助手: {msg.content}")
            else:
                # 其他类型的消息
                lines.append(f"{msg.__class__.__name__}: {msg.content}")
        
        return "\n".join(lines)
    
    def get_memory_stats(self) -> dict:
        """获取记忆统计信息"""
        try:
            all_memories = self.get_all_memories()
            
            return {
                "user_id": self.user_id,
                "total_memories": len(all_memories),
                "db_path": self.db_path
            }
        except Exception as e:
            log(f"❌ 获取记忆统计失败: {str(e)}")
            return {"error": str(e)}

