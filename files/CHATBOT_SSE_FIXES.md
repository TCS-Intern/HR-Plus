# Chatbot SSE Streaming - Additional Fixes

## Issues Fixed for Frontend Integration

### 1. EventSource URL Issue
**Problem**: Frontend was trying to connect to `localhost:3000/api/v1/...` (frontend port) instead of `localhost:8000/api/v1/...` (backend port).

**Error**:
```
GET http://localhost:3000/api/v1/sourcing-chat/message... 404 (Not Found)
```

**Fix**:
- Added `API_URL` constant to ChatContainer.tsx
- Changed EventSource URL from relative to absolute:
  ```typescript
  // Before:
  `/api/v1/sourcing-chat/message?...`

  // After:
  `${API_URL}/api/v1/sourcing-chat/message?...`
  ```

### 2. HTTP Method Mismatch
**Problem**: EventSource only makes GET requests, but the `/message` endpoint was defined as POST.

**Fix**: Changed endpoint from POST to GET in `sourcing_chat.py`:
```python
# Before:
@router.post("/message")

# After:
@router.get("/message")
```

### 3. Headers vs Query Parameters
**Problem**: EventSource doesn't support custom headers in browsers, but the endpoint expected `X-User-ID` header.

**Fix**: Changed user_id from Header parameter to Query parameter:
```python
# Before:
user_id: str = Header("...", alias="X-User-ID")

# After:
user_id: str = Query("00000000-0000-0000-0000-000000000001")
```

Frontend now passes it in URL:
```typescript
`${API_URL}/api/v1/sourcing-chat/message?conversation_id=${conversationId}&message=${encodeURIComponent(message)}&user_id=00000000-0000-0000-0000-000000000001`
```

### 4. Error Event Handling
**Problem**: Frontend was trying to `JSON.parse(e.data)` on error events, but network errors don't have data.

**Error**:
```
Uncaught SyntaxError: "undefined" is not valid JSON
```

**Fix**: Added null check before parsing:
```typescript
eventSource.addEventListener("error", (e: any) => {
  let data: any = {};
  try {
    if (e.data) {
      data = JSON.parse(e.data);
    }
  } catch (err) {
    console.error("Failed to parse error data:", err);
  }
  // ... rest of handler
});
```

### 5. Async Generator Issue
**Problem**: Using `async for` with synchronous generator from Google ADK.

**Error**:
```
'async for' requires an object with __aiter__ method, got generator
```

**Fix**: Changed `async for` to regular `for` in `sourcing_assistant.py`:
```python
# Before:
async for chunk in client.models.generate_content_stream(...):

# After:
for chunk in client.models.generate_content_stream(...):
```

### 6. More Await Issues in Agent
**Problem**: Agent code had `await` statements on synchronous Supabase operations.

**Fix**: Removed all `await` keywords from Supabase calls in `sourcing_assistant.py`:
```bash
perl -i -pe 's/await supabase\./supabase./g' app/agents/sourcing_assistant.py
```

## Files Modified

### Backend
1. `/backend/app/api/v1/sourcing_chat.py`
   - Changed `/message` endpoint from POST to GET
   - Changed `user_id` from Header to Query parameter

2. `/backend/app/agents/sourcing_assistant.py`
   - Changed `async for` to `for` in streaming loop
   - Removed `await` from all Supabase operations

### Frontend
1. `/frontend/components/sourcing-chat/ChatContainer.tsx`
   - Added `API_URL` constant
   - Updated EventSource URL to use full backend URL
   - Added user_id query parameter
   - Fixed error event handler to check for data before parsing

## Testing

```bash
# Start services
cd /Users/hadihijazi/TCS/HR-Plus
make restart  # or manually start both services

# Backend should be on port 8000
# Frontend should be on port 3000

# Test in browser
open http://localhost:3000/jobs/new

# Test SSE endpoint directly
curl -N "http://localhost:8000/api/v1/sourcing-chat/message?conversation_id=YOUR_ID&message=Hello&user_id=00000000-0000-0000-0000-000000000001"
```

## Current Status

✅ Backend running on http://localhost:8000
✅ Frontend running on http://localhost:3000
✅ SSE streaming endpoint working (GET method)
✅ EventSource connecting from browser to backend
✅ Error handling improved
✅ Test user has 10 credits

## Next Steps

1. **Test the full chat flow** in the browser at http://localhost:3000/jobs/new
2. **Send test messages** like:
   - "I need a Senior Backend Engineer"
   - "I need someone with Python and Django"
   - "5+ years experience"
3. **Verify agent responses** are streamed correctly
4. **Test candidate search** (if agent triggers search)
5. **Test reveal flow** when candidates are found

## Known Limitations (MVP Mode)

- No real authentication (using test user ID)
- RLS policies disabled for testing
- Foreign key constraints removed
- No real payment integration (direct credit addition)
- Agent is using placeholder logic (needs Google ADK tools implementation)

## Production TODO

- Re-enable RLS policies
- Add proper authentication
- Restore foreign key constraints
- Implement real payment provider (Stripe)
- Complete agent tool implementations (search_candidates, extract_criteria)
- Add rate limiting
- Add logging and monitoring
