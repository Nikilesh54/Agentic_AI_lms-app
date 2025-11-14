import { BaseAgent } from './BaseAgent';
import { AgentType, AgentMetadata } from './types';

// Import agent implementations
import { TutorAgent } from './implementations/TutorAgent';
import { QuizMasterAgent } from './implementations/QuizMasterAgent';
import { GradingAssistantAgent } from './implementations/GradingAssistantAgent';

/**
 * Agent Registry - Manages all available agents
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentType, BaseAgent> = new Map();

  private constructor() {
    this.registerDefaultAgents();
  }

  static getInstance(): AgentRegistry {
    if (!this.instance) {
      this.instance = new AgentRegistry();
    }
    return this.instance;
  }

  /**
   * Register default agents
   */
  private registerDefaultAgents(): void {
    console.log('Registering default agents...');

    // Student-facing agents
    this.register(new TutorAgent());
    this.register(new QuizMasterAgent());

    // Professor-facing agents
    this.register(new GradingAssistantAgent());

    console.log(`✓ Registered ${this.agents.size} agents`);
  }

  /**
   * Register an agent
   */
  register(agent: BaseAgent): void {
    const metadata = agent.getMetadata();
    this.agents.set(metadata.agentType, agent);
    console.log(`  - ${metadata.name} (${metadata.agentType})`);
  }

  /**
   * Get an agent by type
   */
  get(agentType: AgentType): BaseAgent | undefined {
    return this.agents.get(agentType);
  }

  /**
   * Get agent metadata
   */
  getMetadata(agentType: AgentType): AgentMetadata | undefined {
    const agent = this.agents.get(agentType);
    return agent?.getMetadata();
  }

  /**
   * Get all agents
   */
  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents available for a specific role
   */
  getForRole(role: string): BaseAgent[] {
    return Array.from(this.agents.values()).filter(agent => {
      const metadata = agent.getMetadata();
      return metadata.allowedRoles.includes('*') || metadata.allowedRoles.includes(role);
    });
  }

  /**
   * Check if an agent type exists
   */
  has(agentType: AgentType): boolean {
    return this.agents.has(agentType);
  }

  /**
   * Get the most appropriate agent for a task
   */
  selectAgent(task: string, userRole: string): BaseAgent | null {
    const availableAgents = this.getForRole(userRole);

    if (availableAgents.length === 0) {
      return null;
    }

    // Simple rule-based selection (can be enhanced with ML later)
    const taskLower = task.toLowerCase();

    // Quiz/Practice questions -> Quiz Master
    if (taskLower.includes('quiz') || taskLower.includes('practice questions')) {
      const quizMaster = this.agents.get(AgentType.QUIZ_MASTER);
      if (quizMaster && quizMaster.canHandle(task, userRole)) {
        return quizMaster;
      }
    }

    // Grading/Assessment -> Grading Assistant
    if (taskLower.includes('grade') || taskLower.includes('grading') ||
        taskLower.includes('rubric') || taskLower.includes('assessment')) {
      const gradingAssistant = this.agents.get(AgentType.GRADING_ASSISTANT);
      if (gradingAssistant && gradingAssistant.canHandle(task, userRole)) {
        return gradingAssistant;
      }
    }

    // Default to Tutor for students
    if (userRole === 'student') {
      const tutor = this.agents.get(AgentType.TUTOR);
      if (tutor) {
        return tutor;
      }
    }

    // Default to first available agent
    return availableAgents[0];
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAgents: number;
    byRole: Record<string, number>;
    byCapability: Record<string, number>;
  } {
    const byRole: Record<string, number> = {};
    const byCapability: Record<string, number> = {};

    for (const agent of this.agents.values()) {
      const metadata = agent.getMetadata();

      // Count by role
      for (const role of metadata.allowedRoles) {
        byRole[role] = (byRole[role] || 0) + 1;
      }

      // Count by capability
      const capabilities = metadata.capabilities;
      for (const [capability, hasCapability] of Object.entries(capabilities)) {
        if (hasCapability) {
          byCapability[capability] = (byCapability[capability] || 0) + 1;
        }
      }
    }

    return {
      totalAgents: this.agents.size,
      byRole,
      byCapability,
    };
  }
}

// Export singleton instance
export const agentRegistry = AgentRegistry.getInstance();
