/**
 * Service Initialization
 * Initializes all multi-agent HITL services
 * Call this during application startup
 */

import { registerAllTools } from './tools/registerTools';
import { toolRegistry } from './tools/ToolRegistry';
import { agentRegistry } from './agents/AgentRegistry';
import { AIServiceFactory } from './ai/AIServiceFactory';

/**
 * Initialize all services
 */
export async function initializeServices(): Promise<void> {
  console.log('\n==============================================');
  console.log('🤖 Initializing Multi-Agent HITL System');
  console.log('==============================================\n');

  try {
    // 1. Initialize AI Service
    console.log('1. Initializing AI Service...');
    const aiService = AIServiceFactory.getInstance();
    console.log('   ✓ AI Service initialized (using mock provider)\n');

    // 2. Register all tools
    console.log('2. Registering Tools...');
    registerAllTools();
    const toolStats = toolRegistry.getStats();
    console.log(`   ✓ Tools registered successfully`);
    console.log(`     - Total: ${toolStats.totalTools}`);
    console.log(`     - By category:`, JSON.stringify(toolStats.byCategory, null, 2));
    console.log('');

    // 3. Register all agents (done automatically by singleton)
    console.log('3. Registering Agents...');
    // AgentRegistry automatically registers agents on instantiation
    const agentStats = agentRegistry.getStats();
    console.log(`   ✓ Agents registered successfully`);
    console.log(`     - Total: ${agentStats.totalAgents}`);
    console.log(`     - By role:`, JSON.stringify(agentStats.byRole, null, 2));
    console.log(`     - By capability:`, JSON.stringify(agentStats.byCapability, null, 2));
    console.log('');

    // 4. Verify system readiness
    console.log('4. Verifying System Components...');
    const verification = verifySystemComponents();
    if (verification.ready) {
      console.log('   ✓ All components operational\n');
    } else {
      console.log('   ⚠️  Some components missing:');
      verification.missing.forEach(item => console.log(`      - ${item}`));
      console.log('');
    }

    console.log('==============================================');
    console.log('✅ Multi-Agent HITL System Initialized');
    console.log('==============================================\n');

    printSystemInfo();
  } catch (error) {
    console.error('❌ Error initializing services:', error);
    throw error;
  }
}

/**
 * Verify all system components are ready
 */
function verifySystemComponents(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];

  // Check AI Service
  try {
    AIServiceFactory.getInstance();
  } catch (error) {
    missing.push('AI Service');
  }

  // Check Tool Registry
  if (toolRegistry.getAll().length === 0) {
    missing.push('Tools (none registered)');
  }

  // Check Agent Registry
  if (agentRegistry.getAll().length === 0) {
    missing.push('Agents (none registered)');
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Print system information
 */
function printSystemInfo(): void {
  console.log('📊 System Information:');
  console.log('   Provider: Mock AI (ready for OpenAI/Claude integration)');
  console.log('   Features:');
  console.log('   ✓ Multi-agent orchestration');
  console.log('   ✓ Human-in-the-loop interventions');
  console.log('   ✓ Policy guardrails');
  console.log('   ✓ Tool execution framework');
  console.log('   ✓ Context management');
  console.log('   ✓ Agent handoffs');
  console.log('   ✓ Intervention detection');
  console.log('   ✓ Conversation memory');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Test the system with sample interactions');
  console.log('   2. Configure AI provider (OpenAI/Claude) when ready');
  console.log('   3. Customize agent prompts for your use case');
  console.log('   4. Set up professor monitoring dashboard');
  console.log('   5. Review and adjust policy guardrails');
  console.log('');
  console.log('📚 Documentation:');
  console.log('   See MULTI_AGENT_HITL_README.md for details');
  console.log('');
}

/**
 * Get system status
 */
export function getSystemStatus(): {
  initialized: boolean;
  aiProvider: string;
  toolCount: number;
  agentCount: number;
  features: string[];
} {
  try {
    const aiService = AIServiceFactory.getInstance();
    const toolStats = toolRegistry.getStats();
    const agentStats = agentRegistry.getStats();

    return {
      initialized: true,
      aiProvider: 'mock', // Will change when real provider is configured
      toolCount: toolStats.totalTools,
      agentCount: agentStats.totalAgents,
      features: [
        'Multi-Agent Orchestration',
        'Human-in-the-Loop',
        'Policy Guardrails',
        'Tool Execution',
        'Context Management',
        'Agent Handoffs',
        'Intervention Detection',
      ],
    };
  } catch (error) {
    return {
      initialized: false,
      aiProvider: 'none',
      toolCount: 0,
      agentCount: 0,
      features: [],
    };
  }
}
