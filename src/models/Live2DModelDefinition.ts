/**
 * Live2D 模型定义 - 定义模型的元数据和行为
 */

/** Live2D 模型定义接口 */
export interface ILive2DModelDefinition {
  /** 模型唯一标识 */
  id: string;
  /** 模型名称 */
  name: string;
  /** 模型描述 */
  description?: string;
  /** 模型URL（支持本地路径或在线URL） */
  url: string;
  /** 模型版本（Cubism 2/4） */
  version: 2 | 4;
  /** 预定义的表情列表（可选，为空则运行时动态读取） */
  expressions?: string[];
  /** 预定义的动作列表（可选，为空则运行时动态读取） */
  motions?: string[];
  /** 默认表情 */
  defaultExpression?: string;
  /** 默认动作 */
  defaultMotion?: string;
  /** 模型缩放比例（可选） */
  scale?: number;
  /** 模型位置偏移（可选） */
  offset?: { x?: number; y?: number };
  /** 其他元数据 */
  metadata?: Record<string, any>;
}

/** Live2D 模型定义类 */
export class Live2DModelDefinition implements ILive2DModelDefinition {
  id: string;
  name: string;
  description?: string;
  url: string;
  version: 2 | 4;
  expressions?: string[];
  motions?: string[];
  defaultExpression?: string;
  defaultMotion?: string;
  scale?: number;
  offset?: { x?: number; y?: number };
  metadata?: Record<string, any>;

  constructor(config: ILive2DModelDefinition) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.url = config.url;
    this.version = config.version;
    this.expressions = config.expressions;
    this.motions = config.motions;
    this.defaultExpression = config.defaultExpression;
    this.defaultMotion = config.defaultMotion;
    this.scale = config.scale;
    this.offset = config.offset;
    this.metadata = config.metadata;
  }

  /** 是否为在线模型 */
  isOnline(): boolean {
    return this.url.startsWith("http://") || this.url.startsWith("https://");
  }

  /** 是否为本地模型 */
  isLocal(): boolean {
    return !this.isOnline();
  }

  /** 获取完整的模型URL */
  getFullUrl(): string {
    // 如果是本地路径，确保以 / 开头
    if (this.isLocal() && !this.url.startsWith("/")) {
      return `/${this.url}`;
    }
    return this.url;
  }
}

