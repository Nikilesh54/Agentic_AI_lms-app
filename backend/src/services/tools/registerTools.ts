import { toolRegistry } from './ToolRegistry';
import { ToolCategory } from './types';

// Course Materials Tools
import {
  SearchCourseMaterialsTool,
  GetCourseMaterialsTool,
} from './implementations/CourseMaterialsTools';

// Assignment Tools
import {
  GetActiveAssignmentsTool,
  GetAssignmentDetailsTool,
  GetGradingCriteriaTool,
} from './implementations/AssignmentTools';

// Content Generation Tools
import {
  GenerateQuizTool,
  CreateStudyPlanTool,
  ExplainConceptTool,
} from './implementations/ContentGenerationTools';

/**
 * Register all available tools
 * Call this function during application initialization
 */
export function registerAllTools(): void {
  console.log('Registering agent tools...');

  // Course Materials Tools
  toolRegistry.register(new SearchCourseMaterialsTool(), {
    name: 'searchCourseMaterials',
    description: 'Search through course materials using keywords or topics',
    category: ToolCategory.COURSE_MATERIALS,
    requiresAuth: true,
    allowedRoles: ['*'], // All authenticated users
  });

  toolRegistry.register(new GetCourseMaterialsTool(), {
    name: 'getCourseMaterials',
    description: 'Get a list of all course materials',
    category: ToolCategory.COURSE_MATERIALS,
    requiresAuth: true,
    allowedRoles: ['*'],
  });

  // Assignment Tools
  toolRegistry.register(new GetActiveAssignmentsTool(), {
    name: 'getActiveAssignments',
    description: 'Get all active assignments for the current course',
    category: ToolCategory.ASSIGNMENTS,
    requiresAuth: true,
    allowedRoles: ['student', 'professor', 'root'],
  });

  toolRegistry.register(new GetAssignmentDetailsTool(), {
    name: 'getAssignmentDetails',
    description: 'Get detailed information about a specific assignment',
    category: ToolCategory.ASSIGNMENTS,
    requiresAuth: true,
    allowedRoles: ['student', 'professor', 'root'],
  });

  toolRegistry.register(new GetGradingCriteriaTool(), {
    name: 'getGradingCriteria',
    description: 'Get or suggest grading criteria for an assignment',
    category: ToolCategory.ASSIGNMENTS,
    requiresAuth: true,
    allowedRoles: ['professor', 'root'],
  });

  // Content Generation Tools
  toolRegistry.register(new GenerateQuizTool(), {
    name: 'generateQuiz',
    description: 'Generate practice quiz questions on a specific topic',
    category: ToolCategory.CONTENT_GENERATION,
    requiresAuth: true,
    allowedRoles: ['*'],
    rateLimit: {
      maxCalls: 10,
      windowMs: 60 * 60 * 1000, // 10 calls per hour
    },
  });

  toolRegistry.register(new CreateStudyPlanTool(), {
    name: 'createStudyPlan',
    description: 'Create a personalized study plan for the student',
    category: ToolCategory.CONTENT_GENERATION,
    requiresAuth: true,
    allowedRoles: ['student', 'professor', 'root'],
    rateLimit: {
      maxCalls: 5,
      windowMs: 24 * 60 * 60 * 1000, // 5 calls per day
    },
  });

  toolRegistry.register(new ExplainConceptTool(), {
    name: 'explainConcept',
    description: 'Provide a detailed explanation of a concept',
    category: ToolCategory.CONTENT_GENERATION,
    requiresAuth: true,
    allowedRoles: ['*'],
  });

  const stats = toolRegistry.getStats();
  console.log(`✓ Registered ${stats.totalTools} tools`);
  console.log(`  By category:`, stats.byCategory);
  console.log(`  By role:`, stats.byRole);
}
