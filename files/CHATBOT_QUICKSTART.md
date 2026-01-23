# Chatbot Sourcing - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Apply Database Migrations
```bash
cd /Users/hadihijazi/TCS/HR-Plus

# Apply migrations
make db-push

# Or manually:
supabase db push --local
```

### Step 2: Start Backend & Frontend
```bash
# Option 1: Start both together
make dev

# Option 2: Start separately
cd backend && uv run uvicorn app.main:app --reload
cd frontend && npm run dev
```

### Step 3: Open Chat Interface
Navigate to: **http://localhost:3000/jobs/new**

---

## 💬 Example Conversation

```
🤖 Hi! I'll help you find great candidates. What role are you looking to fill?

👤 I need a Senior Backend Engineer

🤖 What are the must-have skills for this role?

👤 Python, Django, PostgreSQL, AWS

🤖 How many years of experience should they have?

👤 At least 5 years

🤖 Where should they be located?

👤 San Francisco or fully remote

🤖 Let me confirm - Senior Backend Engineer, 5+ years, Python/Django/PostgreSQL/AWS, SF Bay Area or remote. Should I start searching?

👤 Yes, please!

🤖 [Searching LinkedIn... Found 18 candidates!]

🤖 Here are the top 10:
[Shows 10 anonymized candidate cards]

👤 [Clicks "Reveal Identity & Contact" on top 3 candidates]

🤖 [3 candidates revealed - 3 credits used. New balance: 7 credits]

👤 [Clicks "Create Job from this Search"]

🤖 [Job created successfully! Redirects to job page]
```

---

## 📋 Key Features

### 1. Anonymized Candidates
**What You See (Free):**
- Role: "Senior Backend Engineer"
- Company: "Tech Company Inc."
- Location: "San Francisco" (city only)
- Skills: Python, Django, PostgreSQL, AWS, Docker
- Experience: 7 years
- Summary: "Experienced backend engineer specializing in..."
- Fit Score: 87%

**What's Hidden (1 credit to reveal):**
- Full Name
- Email Address
- Phone Number
- LinkedIn Profile URL

### 2. Smart Agent
- Asks ONE question at a time
- Extracts criteria as you go
- Natural conversation (not robotic)
- Remembers context across messages

### 3. Multi-Platform Search
- ✅ LinkedIn (via Apify)
- 🚧 GitHub (ready)
- 🚧 Indeed (ready)

### 4. Credits System
- **Starter**: 10 credits for $49 ($4.90/reveal)
- **Professional**: 50 credits for $199 ($3.98/reveal)
- **Enterprise**: 200 credits for $699 ($3.50/reveal)

---

## 🔧 Quick Fixes

### "Connection Error" in Chat
```bash
# Check backend is running
curl http://localhost:8000/health

# Check SSE endpoint
curl http://localhost:8000/api/v1/sourcing-chat/start
```

### "Insufficient Credits" Error
```bash
# Add test credits directly (MVP mode)
curl -X POST http://localhost:8000/api/v1/credits/purchase \
  -H "Content-Type: application/json" \
  -d '{"package": "starter"}'
```

### Agent Not Searching
```bash
# Check GOOGLE_API_KEY is set
echo $GOOGLE_API_KEY

# Check Apify key for LinkedIn
# Verify in backend/.env: APIFY_API_KEY=...
```

### Migrations Failed
```bash
# Reset database (⚠️ destroys data)
supabase db reset --local

# Reapply migrations
make db-push
```

---

## 📱 Testing Checklist

- [ ] Chat UI loads at `/jobs/new`
- [ ] Greeting message appears
- [ ] Can send messages
- [ ] Agent responds with questions
- [ ] Search returns candidates
- [ ] Candidates are anonymized (no real names)
- [ ] Reveal button works
- [ ] Credits deducted correctly
- [ ] Full contact info shown after reveal
- [ ] "Create Job" button works
- [ ] "Add to Job" button works
- [ ] Credit balance updates in UI

---

## 🐛 Common Issues

### 1. SSE Events Not Streaming
**Problem:** No response from agent after sending message

**Solution:**
- Check browser console for errors
- Verify EventSource API is supported (Chrome, Edge, Firefox)
- Disable nginx buffering if using proxy: `X-Accel-Buffering: no`

### 2. Candidates Not Appearing
**Problem:** Search completes but no candidates shown

**Solution:**
- Check `sourced_candidates` table has data
- Verify Apify API key is valid
- Check backend logs: `tail -f backend/logs/app.log`

### 3. Reveal Button Doesn't Work
**Problem:** Click reveal but nothing happens

**Solution:**
- Check credit balance > 0
- Verify `reveal_candidate_with_credits()` function exists
- Check browser network tab for 402 error (insufficient credits)

---

## 📊 Database Tables

Quick reference for debugging:

```sql
-- Check conversations
SELECT * FROM sourcing_conversations ORDER BY created_at DESC LIMIT 10;

-- Check messages
SELECT * FROM sourcing_messages WHERE conversation_id = 'xxx' ORDER BY created_at;

-- Check candidates
SELECT * FROM sourced_candidates ORDER BY created_at DESC LIMIT 10;

-- Check reveals
SELECT * FROM candidate_reveals ORDER BY revealed_at DESC LIMIT 10;

-- Check credits
SELECT * FROM user_credits;

-- Check transactions
SELECT * FROM credit_transactions ORDER BY created_at DESC LIMIT 10;
```

---

## 🎯 Next Steps After Setup

1. **Test the conversation flow** - Go through a full sourcing session
2. **Verify anonymization** - Ensure no PII leaks in chat
3. **Test reveal flow** - Reveal a candidate and check credits
4. **Create a job** - Convert conversation to formal job
5. **Add to pipeline** - Link candidates to job applications

---

## 📞 Need Help?

**Documentation:**
- Full implementation details: `/files/CHATBOT_SOURCING_IMPLEMENTATION.md`
- Original plan: See plan transcript

**Code Locations:**
- Backend agent: `/backend/app/agents/sourcing_assistant.py`
- Backend API: `/backend/app/api/v1/sourcing_chat.py`
- Frontend chat: `/frontend/components/sourcing-chat/`
- Database schema: `/supabase/migrations/20260123000000_*.sql`

**Debugging:**
- Backend logs: Check terminal running uvicorn
- Frontend logs: Browser console (F12)
- Database: `supabase db` commands
- API: http://localhost:8000/docs (Swagger UI)

---

**Ready to Source Candidates? Start at:** http://localhost:3000/jobs/new

🎉 Happy recruiting!
