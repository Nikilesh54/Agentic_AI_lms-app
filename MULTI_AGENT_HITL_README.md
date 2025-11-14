# Multi-Agent Human-in-the-Loop (HITL) System

## 🎯 Overview

A complete **multi-agent AI system with human oversight** for your Learning Management System. Built using the **adapter pattern** to support any AI provider (OpenAI, Claude, or custom) without code changes.

## ✅ What's Implemented

### 1. **AI Service Layer** (Provider-Agnostic)
- ✅ **IAIService Interface** - Works with any AI provider
- ✅ **MockAIService** - Sophisticated rule-based AI (works without external APIs)
- ✅ **AIServiceFactory** - Switch providers via configuration
- ✅ **Ready for OpenAI/Claude** - Just add API key and uncomment provider code

**Location:** `backend/src/services/ai/`

### 2. **Tool/Action Framework**
Agents can execute real actions:
- ✅ `searchCourseMaterials` - Full-text search through course content
- ✅ `getCourseMaterials` - List all course materials
- ✅ `getActiveAssignments` - Fetch student assignments
- ✅ `getAssignmentDetails` - Get detailed assignment info
- ✅ `getGradingCriteria` - Suggest grading rubrics (professors only)
- ✅ `generateQuiz` - Create practice questions
- ✅ `createStudyPlan` - Personalized study schedules
- ✅ `explainConcept` - Detailed concept explanations

**Features:**
- Tool registry with metadata
- Permission-based access control
- Rate limiting support
- Execution logging to database
- Easy to add new tools

**Location:** `backend/src/services/tools/`

### 3. **Multi-Agent Architecture**

#### **Specialized Agents:**

**Student-Facing Agents:**
- **TutorAgent** - Explains concepts, answers questions, guides learning
- **QuizMasterAgent** - Generates practice questions and quizzes
- **StudyCoachAgent** - Creates study plans (ready to implement)
- **AssignmentHelperAgent** - Helps understand assignments without giving answers (ready to implement)

**Professor-Facing Agents:**
- **GradingAssistantAgent** - Suggests grading criteria and rubrics
- **ContentCreatorAgent** - Helps create assignments (ready to implement)
- **AnalyticsAgent** - Analyzes student performance (ready to implement)

**Admin-Facing Agents:**
- **SystemMonitorAgent** - Monitors AI usage (ready to implement)
- **PolicyAdvisorAgent** - Ensures policy compliance (ready to implement)

#### **Agent Capabilities:**
- ✅ Automatic agent selection based on task
- ✅ Agent handoffs (Tutor → Quiz Master → Study Coach)
- ✅ Tool execution per agent permissions
- ✅ Confidence scoring
- ✅ Escalation detection

**Location:** `backend/src/services/agents/`

### 4. **Agent Orchestration**
- ✅ **AgentOrchestrator** - Routes conversations to appropriate agents
- ✅ **Intelligent routing** - Selects agent based on message content & user role
- ✅ **Seamless handoffs** - Agents transfer conversations when needed
- ✅ **Context preservation** - Conversation history maintained during handoffs
- ✅ **Handoff logging** - All collaborations tracked in database

**Location:** `backend/src/services/agents/AgentOrchestrator.ts`

### 5. **Human-in-the-Loop (HITL) System**

#### **Intervention Detection:**
Automatically detects when human oversight is needed:
- ✅ Direct answer requests (student asking for assignment solutions)
- ✅ Grade discussions (requires professor approval)
- ✅ Low confidence responses (AI is unsure)
- ✅ Repeated questions (student stuck on same problem)
- ✅ Sensitive topics (disabilities, complaints, withdrawals)
- ✅ Extended conversations (long interaction without resolution)
- ✅ Student frustration (negative sentiment detection)
- ✅ Policy inquiries (syllabus, deadlines, etc.)

#### **Intervention Queue:**
- ✅ Priority-based queue (critical, high, medium, low)
- ✅ Automatic professor assignment
- ✅ Status tracking (pending, in_progress, resolved, dismissed)
- ✅ Resolution logging
- ✅ Statistics and analytics

**Location:** `backend/src/services/intervention/`

### 6. **Policy Guardrails**
Prevents AI from violating academic integrity:
- ✅ Blocks direct answers to assignments
- ✅ Prevents grade disclosure
- ✅ Detects academic dishonesty requests
- ✅ Protects student privacy (FERPA compliance)
- ✅ Filters inappropriate content
- ✅ Prevents unauthorized promises

**Features:**
- Rule-based detection (no AI needed)
- Severity levels (low, medium, high, critical)
- Auto-block or flag for review
- Safe fallback responses

**Location:** `backend/src/services/policy/PolicyGuardrails.ts`

### 7. **Context & Memory Management**
- ✅ **ContextBuilder** - Pulls relevant info for AI responses
- ✅ Course material search and retrieval
- ✅ Active assignment tracking
- ✅ Student progress analysis
- ✅ Conversation history management
- ✅ Context storage (short-term memory)
- ✅ Session-based context persistence

**Location:** `backend/src/services/context/ContextBuilder.ts`

### 8. **Database Schema**
New tables for multi-agent HITL:
- ✅ `agent_collaborations` - Agent handoff tracking
- ✅ `message_approvals` - Message review workflow
- ✅ `intervention_queue` - Human intervention requests
- ✅ `agent_learnings` - Learning from human corrections
- ✅ `tool_executions` - Tool usage logging
- ✅ `ai_monitoring_metrics` - Performance tracking
- ✅ `context_materials` - Chunked course materials for search
- ✅ `agent_conversation_context` - Conversation memory
- ✅ **Database views** for analytics

**Location:** `backend/src/db/migrations/multi-agent-hitl-schema.sql`

### 9. **Monitoring & Analytics**
- ✅ Agent performance metrics
- ✅ Intervention statistics
- ✅ Tool usage tracking
- ✅ Response confidence tracking
- ✅ Daily usage statistics (via database views)

---

## 🏗️ Architecture

```
User Message
     ↓
AgentOrchestrator → Select Agent (Tutor, QuizMaster, etc.)
     ↓
BaseAgent.execute()
     ↓
├─→ AIService.generateResponse() → MockAI (or OpenAI/Claude)
├─→ ToolExecutor.execute() → Run tools (search, assignments, etc.)
├─→ ContextBuilder.buildContext() → Get relevant materials
└─→ PolicyGuardrails.check() → Validate response
     ↓
InterventionManager.checkForIntervention()
     ↓
├─→ [No Issues] → Return response to user
└─→ [Issue Detected] → Create intervention → Notify professor
```

---

## 🚀 Getting Started

### **1. Database Setup**

The migration runs automatically on server start. To manually run:

```bash
cd backend
npm run dev
# Migration runs on startup
```

### **2. Service Initialization**

Services auto-initialize when server starts. You'll see:

```
==============================================
🤖 Initializing Multi-Agent HITL System
==============================================

1. Initializing AI Service...
   ✓ AI Service initialized (using mock provider)

2. Registering Tools...
   ✓ Registered tool: searchCourseMaterials (course_materials)
   ✓ Registered tool: getCourseMaterials (course_materials)
   ...
   ✓ Tools registered successfully

3. Registering Agents...
   - Tutor (tutor)
   - Quiz Master (quiz_master)
   - Grading Assistant (grading_assistant)
   ✓ Agents registered successfully

4. Verifying System Components...
   ✓ All components operational

==============================================
✅ Multi-Agent HITL System Initialized
==============================================
```

### **3. Test the System**

The system works **immediately** with the mock AI:

```bash
# Start backend
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend
npm run dev
```

**Test Flow:**
1. Log in as a student
2. Go to "AI Agent Hub"
3. Start a chat session
4. Try these messages:
   - "Explain [concept] to me" → Routes to Tutor
   - "Generate practice questions" → Routes to Quiz Master
   - "Give me the answer to assignment 1" → **Triggers intervention**
   - "What's my grade?" → **Triggers intervention**

---

## 🔌 Adding Real AI Provider

### **Option 1: OpenAI**

1. **Add API Key:**
```bash
# In backend/.env
AI_PROVIDER=openai
AI_API_KEY=sk-your-openai-key
AI_MODEL=gpt-4
```

2. **Install SDK:**
```bash
cd backend
npm install openai
```

3. **Create Provider:**
```typescript
// backend/src/services/ai/providers/OpenAIService.ts
import OpenAI from 'openai';
import { IAIService, AIMessage, AIResponse, AIContext } from '../types';

export class OpenAIService implements IAIService {
  private client: OpenAI;

  constructor(config: any) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async generateResponse(
    messages: AIMessage[],
    context: AIContext,
    systemPrompt?: string
  ): Promise<AIResponse> {
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt || '' },
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      ],
      tools: this.getToolDefinitions(),
    });

    const response = completion.choices[0].message;

    return {
      content: response.content || '',
      confidence: 0.8, // Calculate based on logprobs if available
      requiresReview: false,
      toolCalls: response.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }

  // Implement other methods...
}
```

4. **Register in Factory:**
```typescript
// backend/src/services/ai/AIServiceFactory.ts
import { OpenAIService } from './providers/OpenAIService';

export class AIServiceFactory {
  static createService(config: AIServiceConfig): IAIService {
    switch (config.provider) {
      case 'openai':
        return new OpenAIService(config);
      case 'mock':
        return new MockAIService(config);
      // ...
    }
  }
}
```

### **Option 2: Anthropic Claude**

Similar process - implement `AnthropicService` using `@anthropic-ai/sdk`.

---

## 📊 How It Works

### **Example: Student asks for assignment answer**

1. **User Message:** "Give me the answer to question 3 in assignment 1"

2. **Agent Orchestrator** routes to **TutorAgent**

3. **TutorAgent** calls **AIService.generateResponse()**

4. **MockAIService** analyzes intent:
   - Detects: `DIRECT_ANSWER_REQUEST`
   - Generates refusal response
   - Sets `requiresReview = true`

5. **PolicyGuardrails** checks response:
   - Validates no direct answers given
   - Passes guardrails

6. **TutorAgent** checks for escalation:
   - Detects: Direct answer request
   - Returns: `shouldEscalate = { priority: 'critical' }`

7. **AgentOrchestrator** receives response:
   - Calls **InterventionManager.createIntervention()**

8. **InterventionManager**:
   - Creates entry in `intervention_queue`
   - Assigns to professor
   - Sends notification (if configured)

9. **Response to Student:**
```
I appreciate your question, but I can't provide direct answers to assignment questions.

Here's why: The goal is for you to develop understanding...

What I CAN do:
- Help you understand the concepts
- Break down the problem into steps
- Guide you through the thinking process
...

This conversation has been flagged for your instructor to review.
```

10. **Professor Dashboard** shows:
   - New intervention (priority: critical)
   - Student name, course, trigger reason
   - Full conversation history
   - Options: Resolve, Assign, Dismiss

---

## 🧪 Testing Without Real AI

The **MockAIService** is surprisingly sophisticated:

### **What it can do:**
✅ Intent detection (quiz, explanation, help, etc.)
✅ Generate realistic responses using templates
✅ Execute tools correctly
✅ Detect policy violations
✅ Calculate confidence scores
✅ Trigger interventions appropriately
✅ Support agent handoffs

### **Test Scenarios:**

```javascript
// 1. Normal tutoring
"Explain the concept of recursion"
→ TutorAgent provides explanation
→ Searches course materials
→ No intervention

// 2. Quiz generation
"Generate 5 practice questions on arrays"
→ Routes to QuizMasterAgent
→ Calls generateQuiz tool
→ Returns formatted questions

// 3. Direct answer request
"What's the answer to question 5?"
→ TutorAgent detects violation
→ Refuses politely
→ **Creates intervention (priority: critical)**

// 4. Grade inquiry
"What grade did I get on the midterm?"
→ Detects sensitive topic
→ Refuses to discuss grades
→ **Creates intervention (priority: high)**

// 5. Student frustration
"I've been stuck on this for hours, this makes no sense"
→ Detects frustration
→ Provides empathetic response
→ **Creates intervention (priority: medium)**
```

---

## 🎓 For Professors: Monitoring Dashboard

### **What Professors Can See:**

(Frontend components ready to build - backend fully functional)

1. **Intervention Queue**
   - Pending interventions sorted by priority
   - Student name, course, trigger reason
   - Time pending
   - Quick actions: View, Assign, Resolve

2. **Active Conversations**
   - All ongoing AI chats
   - Real-time message count
   - Agent being used
   - Confidence scores

3. **Analytics Dashboard**
   - Total AI interactions
   - Intervention frequency
   - Common triggers
   - Agent performance
   - Student engagement metrics

4. **Message Review**
   - View full conversation history
   - See AI confidence scores
   - Review flagged messages
   - Approve/reject/modify responses

### **API Endpoints (Ready to use):**

```typescript
// Get pending interventions
GET /api/interventions/queue
Query: ?priority=high&professorId=123

// Assign intervention
POST /api/interventions/:id/assign
Body: { professorId: 123 }

// Resolve intervention
POST /api/interventions/:id/resolve
Body: { resolutionNotes: "Addressed with student" }

// Get statistics
GET /api/interventions/stats
Query: ?startDate=2024-01-01&endDate=2024-12-31
```

---

## 🛠️ Adding New Tools

**Example: Add "Get Student Grades" tool**

```typescript
// backend/src/services/tools/implementations/StudentProgressTools.ts

export class GetStudentGradesTool implements ITool {
  name = 'getStudentGrades';
  description = 'Get student grades for a course (professors only)';
  parameters = {
    type: 'object' as const,
    properties: {
      studentId: {
        type: 'number',
        description: 'Student ID',
      },
      courseId: {
        type: 'number',
        description: 'Course ID',
      },
    },
    required: ['studentId', 'courseId'],
  };

  async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput> {
    // Only professors can access
    if (context.userRole !== 'professor' && context.userRole !== 'root') {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    const result = await pool.query(
      `SELECT
        a.title,
        asub.grade,
        asub.submitted_at,
        asub.graded_at
      FROM assignments a
      JOIN assignment_submissions asub ON a.id = asub.assignment_id
      WHERE a.course_id = $1 AND asub.student_id = $2
      ORDER BY asub.graded_at DESC`,
      [input.courseId, input.studentId]
    );

    return {
      success: true,
      data: result.rows,
    };
  }

  validate(input: ToolInput): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (!input.studentId) errors.push('studentId required');
    if (!input.courseId) errors.push('courseId required');
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
```

**Register it:**
```typescript
// backend/src/services/tools/registerTools.ts

toolRegistry.register(new GetStudentGradesTool(), {
  name: 'getStudentGrades',
  description: 'Get student grades',
  category: ToolCategory.STUDENT_PROGRESS,
  requiresAuth: true,
  allowedRoles: ['professor', 'root'], // Only professors
});
```

---

## 🤖 Adding New Agents

**Example: Create "Study Coach" agent**

```typescript
// backend/src/services/agents/implementations/StudyCoachAgent.ts

export class StudyCoachAgent extends BaseAgent {
  protected metadata: AgentMetadata = {
    name: 'Study Coach',
    description: 'Creates personalized study plans and motivates students',
    agentType: AgentType.STUDY_COACH,
    systemPrompt: `You are a Study Coach AI agent.

Your role is to:
- Create personalized study plans
- Provide study strategies and techniques
- Motivate and encourage students
- Help with time management
- Track study progress

Be supportive, motivational, and practical.`,
    capabilities: {
      canExplainConcepts: false,
      canGenerateQuizzes: false,
      canAccessGrades: false,
      canCreateContent: true,
      canAnalyzeProgress: true,
      canProvideGradingFeedback: false,
    },
    allowedRoles: ['student'],
    tools: ['createStudyPlan', 'getActiveAssignments', 'getStudentProgress'],
  };

  protected shouldHandoff(
    aiResponse: any,
    context: AgentExecutionContext
  ): { toAgent: AgentType; reason: string } | null {
    // Hand off to tutor if student needs concept help
    if (aiResponse.content.toLowerCase().includes('don\'t understand')) {
      return {
        toAgent: AgentType.TUTOR,
        reason: 'Student needs concept explanation',
      };
    }
    return null;
  }
}
```

**Register it:**
```typescript
// backend/src/services/agents/AgentRegistry.ts

private registerDefaultAgents(): void {
  this.register(new TutorAgent());
  this.register(new QuizMasterAgent());
  this.register(new StudyCoachAgent()); // Add here
  this.register(new GradingAssistantAgent());
}
```

---

## 📈 Database Views for Analytics

Already created:

```sql
-- View active interventions
SELECT * FROM active_interventions_summary;

-- View agent performance
SELECT * FROM agent_performance_summary;

-- View daily usage
SELECT * FROM daily_ai_usage_stats;
```

---

## 🔒 Security & Privacy

✅ **Role-based access control** - Tools/agents restricted by user role
✅ **FERPA compliance** - No sharing of student info
✅ **Academic integrity** - Direct answers blocked
✅ **Rate limiting** - Prevent abuse
✅ **Audit logging** - All actions tracked
✅ **Policy enforcement** - Automatic guardrails

---

## 📚 Key Files Reference

```
backend/src/
├── services/
│   ├── ai/                          # AI service layer
│   │   ├── types.ts                 # Core types
│   │   ├── AIServiceFactory.ts      # Provider factory
│   │   └── providers/
│   │       └── MockAIService.ts     # Mock implementation
│   ├── agents/                      # Multi-agent system
│   │   ├── types.ts                 # Agent types
│   │   ├── BaseAgent.ts             # Base agent class
│   │   ├── AgentRegistry.ts         # Agent registry
│   │   ├── AgentOrchestrator.ts     # Orchestration
│   │   └── implementations/         # Specialized agents
│   ├── tools/                       # Tool framework
│   │   ├── types.ts                 # Tool types
│   │   ├── ToolRegistry.ts          # Tool registry
│   │   ├── ToolExecutor.ts          # Tool executor
│   │   ├── registerTools.ts         # Tool registration
│   │   └── implementations/         # Tool implementations
│   ├── intervention/                # HITL system
│   │   ├── InterventionManager.ts   # Intervention management
│   │   └── TriggerDetector.ts       # Trigger detection
│   ├── policy/                      # Policy enforcement
│   │   └── PolicyGuardrails.ts      # Guardrails
│   ├── context/                     # Context management
│   │   └── ContextBuilder.ts        # Context builder
│   └── initializeServices.ts        # Service initialization
├── db/
│   └── migrations/
│       ├── multi-agent-hitl-schema.sql  # Database schema
│       └── runMigrations.ts         # Migration runner
└── index.ts                         # Entry point (calls initializeServices)
```

---

## 🎯 Next Steps

### **Immediate (System is Functional):**
1. ✅ Test with mock AI
2. ✅ Create test conversations
3. ✅ Verify interventions work
4. ✅ Review policy guardrails

### **Short Term (Add Real AI):**
1. Choose provider (OpenAI/Claude)
2. Add API key to `.env`
3. Implement provider class
4. Test with real AI
5. Tune system prompts

### **Medium Term (Build Frontend):**
1. Create professor monitoring dashboard
2. Build intervention queue UI
3. Add message approval interface
4. Implement analytics visualizations

### **Long Term (Enhancements):**
1. Add vector search for materials
2. Implement learning from interventions
3. Add more specialized agents
4. Create student feedback mechanism
5. Implement A/B testing for agents

---

## 💡 Why This Approach Works

### **1. No Vendor Lock-in**
- Interface-based design
- Swap AI providers anytime
- Test without external dependencies

### **2. Scalable Architecture**
- Easy to add new agents
- Simple tool registration
- Modular components

### **3. Educational Focus**
- Policy guardrails prevent cheating
- Human oversight for sensitive topics
- Learning-focused, not answer-giving

### **4. Production Ready**
- Database logging
- Error handling
- Rate limiting
- Audit trails

---

## 🆘 Troubleshooting

### **Services don't initialize:**
```bash
# Check logs for errors
npm run dev

# Verify database migration ran
# Check for "Multi-Agent HITL schema migration completed"
```

### **Agents not working:**
```typescript
// Test agent registry
import { agentRegistry } from './services/agents/AgentRegistry';
console.log(agentRegistry.getStats());
```

### **Tools not executing:**
```typescript
// Test tool registry
import { toolRegistry } from './services/tools/ToolRegistry';
console.log(toolRegistry.getStats());
```

---

## 📞 Support

For questions or issues:
1. Check this README
2. Review code comments (extensively documented)
3. Check database schema comments
4. Review console logs on startup

---

**Built with ❤️ for educational excellence**
**No AI required to get started • Add real AI when ready • Fully functional today**
