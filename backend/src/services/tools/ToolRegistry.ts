import { ITool, ToolMetadata, ToolCategory } from './types';

/**
 * Central registry for all agent tools
 * Manages tool registration, discovery, and metadata
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ITool> = new Map();
  private metadata: Map<string, ToolMetadata> = new Map();

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!this.instance) {
      this.instance = new ToolRegistry();
    }
    return this.instance;
  }

  /**
   * Register a tool
   */
  register(tool: ITool, metadata: ToolMetadata): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }

    this.tools.set(tool.name, tool);
    this.metadata.set(tool.name, metadata);

    console.log(`✓ Registered tool: ${tool.name} (${metadata.category})`);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get tool metadata
   */
  getMetadata(name: string): ToolMetadata | undefined {
    return this.metadata.get(name);
  }

  /**
   * Get all tools
   */
  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ITool[] {
    return Array.from(this.tools.values()).filter(tool => {
      const meta = this.metadata.get(tool.name);
      return meta?.category === category;
    });
  }

  /**
   * Get tools available for a specific role
   */
  getForRole(role: string): ITool[] {
    return Array.from(this.tools.values()).filter(tool => {
      const meta = this.metadata.get(tool.name);
      return meta?.allowedRoles.includes(role) || meta?.allowedRoles.includes('*');
    });
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool definitions for AI (OpenAI function calling format)
   */
  getToolDefinitions(role?: string): any[] {
    const tools = role ? this.getForRole(role) : this.getAll();

    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Get tool definitions for Anthropic Claude
   */
  getAnthropicToolDefinitions(role?: string): any[] {
    const tools = role ? this.getForRole(role) : this.getAll();

    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Clear all tools (useful for testing)
   */
  clear(): void {
    this.tools.clear();
    this.metadata.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    byCategory: Record<string, number>;
    byRole: Record<string, number>;
  } {
    const byCategory: Record<string, number> = {};
    const byRole: Record<string, number> = {};

    for (const [name, tool] of this.tools) {
      const meta = this.metadata.get(name);
      if (meta) {
        byCategory[meta.category] = (byCategory[meta.category] || 0) + 1;

        for (const role of meta.allowedRoles) {
          byRole[role] = (byRole[role] || 0) + 1;
        }
      }
    }

    return {
      totalTools: this.tools.size,
      byCategory,
      byRole,
    };
  }
}

// Export singleton instance
export const toolRegistry = ToolRegistry.getInstance();
