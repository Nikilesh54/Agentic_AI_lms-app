# Trust Score Logic - Explanation & Key Files

## Files Your Teammate Should Focus On

### Core trust score files (in order of importance)

| # | File | Purpose |
|---|------|---------|
| 1 | `EnhancedIntegrityVerificationAgent.ts` | THE main file - calculates trust scores |
| 2 | `SubjectChatbotAgent.ts` | The chatbot that generates responses (trust score verifies these) |
| 3 | `vectorSearch.ts` | Vector similarity search used by chatbot |
| 4 | `constants.ts` | Trust score thresholds & config values |
| 5 | `chat.ts` | API routes - triggers verification in background |
| 6 | `MessageMetadata.tsx` | Frontend - displays trust badge to user |
| 7 | `agenticai.ts` | TypeScript types + helper functions for trust display |

### Supporting files for context

- `backend/src/services/ai/types.ts` - AI response types (confidence scores)
- `backend/src/services/embeddingService.ts` - Embedding generation
- `backend/src/db/migrations/rag-system-schema.sql` - DB schema for embeddings
- `backend/src/services/factcheck/GroqFactCheckService.ts` - Independent fact-check (separate from trust score)

---

## How the Trust Score Currently Works

Here's the full flow:

### 1. Chatbot responds to a student question (`chat.ts:454-456`)

- `SubjectChatbotAgent` generates a response with source citations
- It returns: response text, confidence (0-1), and claimed sources

### 2. Trust verification kicks off IN THE BACKGROUND (`chat.ts:500-558`)

- The API response is sent to the student immediately
- `EnhancedIntegrityVerificationAgent.verifyResponse()` runs asynchronously
- Has retry logic (up to 3 attempts with exponential backoff)

### 3. The verification process (all in `EnhancedIntegrityVerificationAgent.ts`)

**Step A - Fetch actual source content independently (lines 286-315):**

- For course materials: queries the database to get the actual stored chunks/text for that file
- For internet sources: web crawls the URL using axios + cheerio to extract the actual page content
- Key principle: *"NEVER trust the chatbot's claims - verify everything independently"*

**Step B - Build verification context (lines 538-575):**

- Extracts key factual claims from the chatbot response (sentences with numbers, percentages, citations)
- Pairs each claimed source with the actual fetched content

**Step C - AI-based comparison (lines 145-161):**

- Sends the claims vs actual content to Gemini to compare
- Gemini outputs a JSON with: `trust_score` (0-100), `trust_level`, `verification_details`, `hallucinations_detected`

**Step D - Parse the result (lines 674-727):**

Uses 5 fallback strategies to parse Gemini's response:

1. Direct JSON parse
2. Markdown code block extraction
3. Fuzzy JSON extraction (brace matching)
4. Partial extraction (regex for `trust_score`)
5. Heuristic analysis (keyword-based positive/negative scoring)

### 4. Trust Score Scale (from the system prompt, lines 65-69)

| Score | Meaning |
|-------|---------|
| 90-100 | Information found in source (exact or same meaning) |
| 70-89 | Accurate paraphrase, core info preserved |
| 50-69 | Partially accurate, some details differ |
| 30-49 | Significant discrepancies |
| 0-29 | Information absent or contradicts source |

### 5. Trust Levels (`constants.ts:204-213`)

| Level | Threshold |
|-------|-----------|
| highest | >= 90 |
| high | >= 70 |
| medium | >= 50 |
| lower | >= 30 |
| low | < 30 |

### 6. Result Storage & Display

- Result stored in DB as `message_trust_scores` table
- Frontend polls for it (`MessageMetadata.tsx:58-73`) with retry polling (up to 5 attempts)

### 7. Separate Fact-Check

There's also a **separate** fact-check using Groq/Llama that runs independently alongside the trust score - this is the second badge the user sees.

---

## What's Improvable (Focus Areas)

The current trust score logic has some areas to work on:

1. **Score is entirely AI-generated** - Gemini decides the number. There's no weighted formula combining multiple signals
2. **Fallback heuristic (lines 879-939) is very basic** - just counts positive/negative keywords
3. **No semantic similarity scoring** - it could use the actual cosine similarity scores from vector search as a factor
4. **Confidence defaults are static** - `aiResponse.confidence || 0.8` defaults to 0.8 when not provided; this could be more dynamic
5. **5-strategy JSON parsing is overly defensive** - could be simplified if the AI prompt was more constrained
