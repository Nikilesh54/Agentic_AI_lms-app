# 🚀 Quick Start Guide - Multi-Agent HITL System

## ✅ What Was Built (Without AI Provider)

Your LMS now has a **complete multi-agent system with human oversight** that works **immediately** without requiring OpenAI or Claude API keys.

## 🎯 Immediate Test (2 minutes)

### 1. Start the Backend

```bash
cd backend
npm install  # If not already done
npm run dev
```

You should see:
```
==============================================
🤖 Initializing Multi-Agent HITL System
==============================================

1. Initializing AI Service...
   ✓ AI Service initialized (using mock provider)

2. Registering Tools...
   ✓ Registered tool: searchCourseMaterials
   ✓ Registered tool: getActiveAssignments
   ... (8 tools total)

3. Registering Agents...
   - Tutor (tutor)
   - Quiz Master (quiz_master)
   - Grading Assistant (grading_assistant)

4. Verifying System Components...
   ✓ All components operational

✅ Multi-Agent HITL System Initialized
==============================================
```

### 2. Start the Frontend

```bash
cd frontend
npm run dev
```

### 3. Test It!

1. **Login as a student**
2. **Go to "AI Agent Hub"** (Chat interface)
3. **Start a chat with any course**
4. **Try these test messages:**

#### ✅ Normal Interactions (Should Work Fine)

```
"Explain recursion to me"
→ Tutor agent responds with explanation

"Generate 5 practice questions on arrays"
→ Routes to Quiz Master agent
→ Creates practice questions

"Help me understand this assignment"
→ Tutor provides guidance without direct answers

"Create a study plan for me"
→ Generates personalized study schedule
```

#### 🚨 Intervention Triggers (Should Flag for Professor Review)

```
"Give me the answer to question 3"
→ AI refuses politely
→ Creates CRITICAL priority intervention
→ Professor notified

"What grade did I get?"
→ AI redirects to professor
→ Creates HIGH priority intervention

"I've been stuck for hours, this is stupid"
→ AI responds empathetically
→ Creates MEDIUM priority intervention (frustration detected)
```

## 📊 Check Database After Testing

```sql
-- See intervention queue
SELECT * FROM intervention_queue ORDER BY created_at DESC LIMIT 10;

-- See agent collaborations (handoffs)
SELECT * FROM agent_collaborations ORDER BY created_at DESC LIMIT 10;

-- See tool executions
SELECT * FROM tool_executions ORDER BY executed_at DESC LIMIT 10;

-- See agent performance
SELECT * FROM agent_performance_summary;

-- See active interventions
SELECT * FROM active_interventions_summary;
```

## 🎓 What Each Component Does

### **Mock AI Service**
- Pattern-based intent detection
- Template-based responses
- Confidence scoring
- Tool calling
- **No external API needed!**

### **Agents**
1. **Tutor** - Explains concepts, helps students understand
2. **Quiz Master** - Generates practice questions
3. **Grading Assistant** - Helps professors with grading (professor-only)

### **Tools** (8 total)
1. Search course materials
2. Get course materials list
3. Get active assignments
4. Get assignment details
5. Get grading criteria (professor-only)
6. Generate quiz
7. Create study plan
8. Explain concept

### **Interventions** (8+ triggers)
1. Direct answer requests
2. Grade discussions
3. Low confidence responses
4. Repeated questions
5. Sensitive topics
6. Extended conversations
7. Student frustration
8. Policy inquiries

### **Policy Guardrails**
- Blocks direct answers to assignments
- Prevents grade disclosure
- Detects academic dishonesty
- Protects privacy
- Filters inappropriate content

## 🔄 How Agent Routing Works

```
Student: "Generate practice questions"
  ↓
AgentOrchestrator.selectAgent()
  ↓
Detects keywords: "generate", "practice", "questions"
  ↓
Routes to: QuizMasterAgent
  ↓
QuizMaster calls: generateQuiz tool
  ↓
Returns: 5 formatted practice questions
```

## 🔥 Advanced: Agent Handoffs

```
Student starts with Tutor:
"Explain arrays to me"
  → Tutor provides explanation

Student continues:
"Now generate some practice questions"
  → Tutor detects quiz request
  → Hands off to Quiz Master
  → Quiz Master generates questions

Student continues:
"I don't understand the first question"
  → Quiz Master detects need for explanation
  → Hands off back to Tutor
  → Tutor explains the concept
```

**All handoffs are logged in `agent_collaborations` table!**

## 📈 View System Status

Add this endpoint to test system status:

```typescript
// backend/src/routes/system.ts (create new file)
import { Router } from 'express';
import { getSystemStatus } from '../services/initializeServices';

const router = Router();

router.get('/status', (req, res) => {
  const status = getSystemStatus();
  res.json(status);
});

export default router;
```

```typescript
// backend/src/index.ts (add route)
import systemRoutes from './routes/system';
app.use('/api/system', systemRoutes);
```

Then visit: `http://localhost:5000/api/system/status`

Response:
```json
{
  "initialized": true,
  "aiProvider": "mock",
  "toolCount": 8,
  "agentCount": 3,
  "features": [
    "Multi-Agent Orchestration",
    "Human-in-the-Loop",
    "Policy Guardrails",
    "Tool Execution",
    "Context Management",
    "Agent Handoffs",
    "Intervention Detection"
  ]
}
```

## 🔌 When You're Ready: Add Real AI

### Option 1: OpenAI

```bash
# .env
AI_PROVIDER=openai
AI_API_KEY=sk-your-key-here
AI_MODEL=gpt-4

# Install SDK
npm install openai
```

### Option 2: Anthropic Claude

```bash
# .env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-your-key-here
AI_MODEL=claude-3-5-sonnet-20241022

# Install SDK
npm install @anthropic-ai/sdk
```

**See MULTI_AGENT_HITL_README.md for full implementation details**

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check database is running
# Check .env has correct database credentials
npm run dev  # Look for specific error
```

### Tables not created
```bash
# Migration runs automatically on startup
# Check logs for: "Multi-Agent HITL schema migration completed"
# If missing, check backend/src/db/migrations/runMigrations.ts
```

### Mock AI not responding
```typescript
// Test directly
import { getAIService } from './services/ai/AIServiceFactory';
const ai = getAIService();
const response = await ai.generateResponse([
  { role: 'user', content: 'Test message' }
], {});
console.log(response);
```

## 📚 Next Steps

1. ✅ **Test with mock AI** (do this now!)
2. ⬜ Build professor monitoring dashboard UI
3. ⬜ Add real AI provider (OpenAI/Claude)
4. ⬜ Customize agent prompts for your domain
5. ⬜ Add more specialized agents
6. ⬜ Implement vector search for materials
7. ⬜ Add student feedback mechanism

## 💡 Pro Tips

**For Testing:**
- Use database views for quick insights
- Check `intervention_queue` table after each test
- Monitor `tool_executions` for debugging
- Review agent handoffs in `agent_collaborations`

**For Development:**
- Mock AI is great for developing frontend
- Add tools before adding agents
- Test policy guardrails separately
- Use intervention triggers for edge cases

**For Production:**
- Start with mock, switch to real AI gradually
- Monitor intervention frequency
- Review policy violations regularly
- Collect feedback from professors & students

## 🎉 You're Ready!

The system is **fully functional** right now. Everything works without external AI APIs. When you're ready to add real AI, it's just:

1. Add API key to `.env`
2. Choose provider
3. Restart server

That's it! The entire system continues working with the new provider.

---

**Read MULTI_AGENT_HITL_README.md for complete documentation**
