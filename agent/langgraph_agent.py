"""
LangGraph Agent - 基于 StateGraph 的智能工作流编排
"""
from typing import Dict, Any, Literal, Optional
import sqlite3
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver
from langchain_core.messages import HumanMessage
from .state import AgentState
from .nodes import router_node, chat_node, image_node, video_node
from .logger import log
from .memory_config import (
    ENABLE_MEMORY,
    MEMORY_DB_PATH,
    DEFAULT_USER_ID,
    SHORT_TERM_MEMORY_TURNS,
    LONG_TERM_MEMORY_INTERVAL,
    DEBUG_MEMORY
)


class LangGraphAgent:
    """
    LangGraph Agent - 智能工作流编排器
    
    根据用户输入自动选择合适的工作流：
    - chat: 普通对话
    - image: 图片生成（预留）
    - video: 视频生成（预留）
    - quick_and_detailed: 快速回复 + 详细内容（阶段 2 实现）
    """
    
    def __init__(self, 
                 debug: bool = False, 
                 enable_memory: bool = ENABLE_MEMORY,
                 user_id: str = DEFAULT_USER_ID):
        """
        初始化 LangGraph Agent
        
        Args:
            debug: 是否启用调试模式（显示详细的节点执行流程）
            enable_memory: 是否启用持久记忆功能
            user_id: 用户 ID（用于区分不同用户的记忆）
        """
        self.debug = debug
        self.enable_memory = enable_memory
        self.user_id = user_id
        
        # 初始化短期记忆（Checkpointer）
        self.checkpointer = None
        self.db_conn = None
        if self.enable_memory:
            try:
                # 创建 SQLite 连接
                self.db_conn = sqlite3.connect(MEMORY_DB_PATH, check_same_thread=False)
                # 创建 SqliteSaver 实例
                self.checkpointer = SqliteSaver(self.db_conn)
                if DEBUG_MEMORY:
                    log(f"✅ 短期记忆已启用 (SQLite: {MEMORY_DB_PATH})")
            except Exception as e:
                log(f"⚠️ 短期记忆初始化失败: {str(e)}")
                self.checkpointer = None
                if self.db_conn:
                    self.db_conn.close()
                    self.db_conn = None
        
        # 初始化长期记忆管理器（延迟导入，避免循环依赖）
        self.memory_manager = None
        if self.enable_memory:
            try:
                from .memory_manager import MemoryManager
                self.memory_manager = MemoryManager(user_id)
                if DEBUG_MEMORY:
                    log(f"✅ 长期记忆已启用 (Chroma: {self.memory_manager.db_path})")
            except Exception as e:
                log(f"⚠️ 长期记忆初始化失败: {str(e)}")
                self.memory_manager = None
        
        # 对话轮数计数器
        self.turn_count = 0
        self._load_turn_count()
        
        self.graph = self._build_graph()
        log("✅ LangGraph Agent 初始化完成")
        
        if self.debug:
            log("\n🔍 调试模式已启用")
        
        if self.enable_memory and DEBUG_MEMORY:
            log(f"📊 当前对话轮数: {self.turn_count}")
    
    def _build_graph(self) -> StateGraph:
        """构建工作流图"""
        # 创建 StateGraph
        workflow = StateGraph(AgentState)
        
        #-------------- 添加节点 --------------
        workflow.add_node("router", router_node)
        workflow.add_node("chat", chat_node)
        workflow.add_node("image", image_node)
        workflow.add_node("video", video_node)
        
        #-------------- 设置入口 --------------
        workflow.set_entry_point("router")
        
        #-------------- 定义条件边 --------------
        def route_after_router(state: AgentState) -> Literal["chat", "image", "video"]:
            """根据 workflow_type 决定下一步"""
            workflow_type = state.get("workflow_type", "chat")
            
            # 阶段 1：暂时将 quick_and_detailed 也路由到 chat
            # 阶段 2 会实现真正的并行执行
            if workflow_type == "quick_and_detailed":
                log("⚠️ quick_and_detailed 工作流暂未实现，降级为 chat")
                return "chat"
            
            return workflow_type
        
        # Router 节点后的条件路由
        workflow.add_conditional_edges(
            "router",
            route_after_router,
            {
                "chat": "chat",
                "image": "image",
                "video": "video",
            }
        )
        
        #-------------- 定义结束边 --------------
        workflow.add_edge("chat", END)
        workflow.add_edge("image", END)
        workflow.add_edge("video", END)
        
        # 编译图（传入 checkpointer 以启用持久记忆）
        return workflow.compile(checkpointer=self.checkpointer)
    
    def process(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理用户消息
        
        Args:
            message: {"type": "chat", "message": "用户输入"}
            
        Returns:
            响应消息
        """
        try:
            # 提取用户输入
            user_input = message.get("message", "")
            if not user_input:
                return self._create_error_response("消息内容为空")
            
            log(f"\n{'='*60}")
            log(f"📨 收到消息: {user_input[:100]}")
            if self.enable_memory and DEBUG_MEMORY:
                log(f"💾 当前轮数: {self.turn_count + 1}")
            log(f"{'='*60}")
            
            # 检索长期记忆（如果启用且已有足够的对话历史）
            long_term_context = ""
            if self.memory_manager and self.turn_count >= LONG_TERM_MEMORY_INTERVAL:
                try:
                    long_term_context = self.memory_manager.retrieve_relevant_memories(user_input)
                    if long_term_context and DEBUG_MEMORY:
                        log(f"🔍 检索到长期记忆 ({len(long_term_context)} 字符)")
                except Exception as e:
                    log(f"⚠️ 长期记忆检索失败: {str(e)}")
            
            # 如果有长期记忆，注入到用户输入中
            enhanced_input = user_input
            if long_term_context:
                enhanced_input = f"""[历史相关记忆]
{long_term_context}

[当前对话]
{user_input}"""
            
            # 配置会话 ID（用于 Checkpointer）
            config = None
            if self.checkpointer:
                config = {
                    "configurable": {
                        "thread_id": self.user_id
                    }
                }
            
            # 获取历史状态（如果有 checkpoint）
            existing_messages = []
            if self.checkpointer and config:
                try:
                    # 获取当前 checkpoint 的状态
                    current_state = self.graph.get_state(config)
                    if current_state and current_state.values:
                        existing_messages = current_state.values.get("messages", [])
                except Exception as e:
                    if DEBUG_MEMORY:
                        log(f"⚠️ 获取历史状态失败: {str(e)}")
            
            # 构建初始状态：追加新消息到历史消息
            initial_state: AgentState = {
                "messages": existing_messages + [HumanMessage(content=enhanced_input)],
                "workflow_type": "chat",  # 默认值，会被 router 覆盖
                "quick_reply": None,
                "quick_reply_audio": None,
                "detailed_content": None,
                "detailed_audio": None,
                "task_params": {},
                "error": None,
            }
            
            # 执行工作流
            if self.debug:
                log("\n" + "="*60)
                log("🔍 开始执行工作流（调试模式）")
                log("="*60)
                
                # 使用 stream 方法可以看到每个节点的执行
                final_state = None
                for step_output in self.graph.stream(initial_state, config):
                    node_name = list(step_output.keys())[0]
                    log(f"\n📍 执行节点: {node_name}")
                    final_state = step_output[node_name]
                
                log("\n" + "="*60)
                log("🔍 工作流执行完成")
                log("="*60)
            else:
                final_state = self.graph.invoke(initial_state, config)
            
            # 检查错误
            if final_state.get("error"):
                return self._create_error_response(final_state["error"])
            
            # 提取结果
            # 阶段 1：所有响应都在 detailed_content 中
            response_text = final_state.get("detailed_content", "")
            
            if not response_text:
                return self._create_error_response("未生成响应内容")
            
            log(f"\n{'='*60}")
            log(f"✅ 响应生成完成")
            log(f"{'='*60}\n")
            
            # 增加对话轮数
            self.turn_count += 1
            self._save_turn_count()
            
            # 检查是否需要生成长期记忆
            if self.memory_manager and self.turn_count % LONG_TERM_MEMORY_INTERVAL == 0:
                try:
                    self._generate_long_term_memory()
                except Exception as e:
                    log(f"⚠️ 生成长期记忆失败: {str(e)}")
            
            # 清理旧的 checkpoint（只保留最近的对话）
            if self.checkpointer and self.turn_count % 5 == 0:  # 每 5 轮清理一次
                try:
                    self._cleanup_old_checkpoints()
                except Exception as e:
                    log(f"⚠️ 清理旧 checkpoint 失败: {str(e)}")
            
            # 返回响应（兼容原有格式）
            return {
                "type": "chat_response",
                "message": response_text
            }
            
        except Exception as e:
            error_msg = f"LangGraph Agent 处理失败: {str(e)}"
            log(f"❌ {error_msg}")
            return self._create_error_response(error_msg)
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """创建错误响应"""
        return {
            "type": "error",
            "message": error_message
        }
    
    def visualize(self, output_file: str = "workflow_graph.png", format: str = "mermaid"):
        """
        生成工作流可视化图
        
        Args:
            output_file: 输出文件路径
            format: 输出格式，支持 "mermaid" 或 "png"
                - mermaid: 生成 Mermaid 图代码（推荐，无需额外依赖）
                - png: 生成 PNG 图（需要安装 graphviz）
        """
        if format == "mermaid":
            # 生成 Mermaid 图代码
            mermaid_code = self.graph.get_graph().draw_mermaid()
            
            # 保存到文件
            with open(output_file.replace('.png', '.md'), 'w') as f:
                f.write("# LangGraph 工作流图\n\n")
                f.write("```mermaid\n")
                f.write(mermaid_code)
                f.write("\n```\n")
            
            log(f"✅ Mermaid 图已生成: {output_file.replace('.png', '.md')}")
            log("📌 可以在 GitHub 或支持 Mermaid 的编辑器中查看")
            
            # 同时打印到控制台
            log("\n" + "="*60)
            log("Mermaid 图代码：")
            log("="*60)
            log(mermaid_code)
            log("="*60)
            
        elif format == "png":
            try:
                # 生成 PNG 图（需要 graphviz）
                from PIL import Image
                png_data = self.graph.get_graph().draw_mermaid_png()
                
                with open(output_file, 'wb') as f:
                    f.write(png_data)
                
                log(f"✅ PNG 图已生成: {output_file}")
            except Exception as e:
                log(f"❌ PNG 生成失败: {str(e)}")
                log("💡 提示：需要安装 graphviz 和 PIL")
                log("   brew install graphviz")
                log("   pip install pillow")
        
        return mermaid_code if format == "mermaid" else None
    
    def print_workflow_structure(self):
        """打印工作流结构（文本形式）"""
        log("\n" + "="*60)
        log("📊 LangGraph 工作流结构")
        log("="*60)
        
        log("\n节点列表：")
        nodes = self.graph.get_graph().nodes
        for i, node in enumerate(nodes, 1):
            log(f"  {i}. {node}")
        
        log("\n边（连接关系）：")
        edges = self.graph.get_graph().edges
        for i, edge in enumerate(edges, 1):
            log(f"  {i}. {edge}")
        
        log("\n" + "="*60)
    
    #-------------- 记忆管理辅助方法 --------------
    
    def _load_turn_count(self):
        """加载对话轮数计数"""
        if not self.checkpointer:
            return
        
        try:
            config = {"configurable": {"thread_id": self.user_id}}
            checkpoints = list(self.checkpointer.list(config, limit=1))
            
            if checkpoints:
                # 从最新的 checkpoint 中获取轮数（简化版：直接计数 checkpoint 数量）
                all_checkpoints = list(self.checkpointer.list(config))
                self.turn_count = len(all_checkpoints)
                if DEBUG_MEMORY:
                    log(f"📊 从 checkpoint 加载轮数: {self.turn_count}")
        except Exception as e:
            log(f"⚠️ 加载轮数失败: {str(e)}")
            self.turn_count = 0
    
    def _save_turn_count(self):
        """保存对话轮数（实际上 checkpoint 会自动保存，这里只是标记）"""
        # Checkpointer 会自动保存状态，不需要额外操作
        pass
    
    def _generate_long_term_memory(self):
        """生成并保存长期记忆摘要"""
        if not self.memory_manager or not self.checkpointer:
            return
        
        if DEBUG_MEMORY:
            log(f"\n{'='*60}")
            log(f"📝 生成长期记忆摘要 (第 {self.turn_count - LONG_TERM_MEMORY_INTERVAL + 1}-{self.turn_count} 轮)")
            log(f"{'='*60}")
        
        # 获取最近 N 轮对话
        recent_messages = self._get_recent_messages(limit=LONG_TERM_MEMORY_INTERVAL)
        
        if not recent_messages:
            log("⚠️ 没有足够的消息生成摘要")
            return
        
        # 生成摘要
        summary = self.memory_manager.generate_summary(recent_messages)
        
        # 保存摘要
        start_turn = self.turn_count - LONG_TERM_MEMORY_INTERVAL + 1
        end_turn = self.turn_count
        self.memory_manager.save_summary(summary, start_turn, end_turn)
        
        if DEBUG_MEMORY:
            log(f"✅ 长期记忆已保存")
            log(f"摘要预览: {summary[:100]}...")
    
    def _get_recent_messages(self, limit: int = LONG_TERM_MEMORY_INTERVAL):
        """获取最近 N 轮对话的消息"""
        if not self.checkpointer:
            return []
        
        try:
            config = {"configurable": {"thread_id": self.user_id}}
            checkpoints = list(self.checkpointer.list(config, limit=limit))
            
            # 提取所有消息
            all_messages = []
            for checkpoint_tuple in reversed(checkpoints):
                # checkpoint_tuple 是一个命名元组，包含 checkpoint 和 metadata
                checkpoint = checkpoint_tuple.checkpoint
                if "channel_values" in checkpoint:
                    state = checkpoint["channel_values"]
                    messages = state.get("messages", [])
                    all_messages.extend(messages)
            
            return all_messages
        except Exception as e:
            log(f"⚠️ 获取最近消息失败: {str(e)}")
            return []
    
    def _cleanup_old_checkpoints(self):
        """清理旧的 checkpoint，只保留最近的对话"""
        if not self.checkpointer:
            return
        
        try:
            config = {"configurable": {"thread_id": self.user_id}}
            all_checkpoints = list(self.checkpointer.list(config))
            
            # 计算需要保留的 checkpoint 数量
            # 每轮对话可能产生多个 checkpoint（每个节点一个）
            # 保守估计：每轮 3 个节点，所以保留 SHORT_TERM_MEMORY_TURNS * 3 个
            keep_count = SHORT_TERM_MEMORY_TURNS * 3
            
            if len(all_checkpoints) > keep_count:
                # 删除旧的 checkpoint（这里简化处理，实际上 SQLite 会自动管理）
                if DEBUG_MEMORY:
                    log(f"🗑️ 清理旧 checkpoint: {len(all_checkpoints)} -> {keep_count}")
        except Exception as e:
            log(f"⚠️ 清理 checkpoint 失败: {str(e)}")
    
    def cleanup(self):
        """清理资源，关闭数据库连接"""
        if self.db_conn:
            try:
                self.db_conn.close()
                if DEBUG_MEMORY:
                    log("🔒 数据库连接已关闭")
            except Exception as e:
                log(f"⚠️ 关闭数据库连接失败: {str(e)}")
            finally:
                self.db_conn = None
    
    def __del__(self):
        """析构函数，确保资源被清理"""
        self.cleanup()
