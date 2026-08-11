# Multi-User RAG Chatbot - Quick Start Guide

## 🎬 Getting Started

### Prerequisites
- Python 3.8+ with virtual environment
- Node.js 16+
- Ollama running with models: `llama:latest`, `nomic-embed-text:latest`
- Backend running at http://localhost:3000
- Frontend running at http://localhost:3000

---

## 📋 Step-by-Step Setup

### 1. Start the Backend

```bash
cd rag-chatbot/backend
source env/bin/activate
python app.py
```

**Expected Output:**
```
✓ Embedding model (nomic-embed-text) initialized successfully
✓ Loaded X conversations from disk
✓ Loaded 1 users from disk
Uvicorn running on http://0.0.0.0:8000
```

### 2. Start the Frontend (in a new terminal)

```bash
cd rag-chatbot
npm run dev
```

**Expected Output:**
```
> next dev
  ▲ Next.js 14.x.x
  - ready on http://localhost:3000
```

### 3. Open Browser
Visit: **http://localhost:3000**

---

## 🔑 Default Credentials

The system creates a default admin user on first startup:

| Field | Value |
|-------|-------|
| **Username** | `admin` |
| **Password** | `admin123` |
| **Role** | Admin |

---

## 👤 User Workflows

### **WORKFLOW 1: Admin User Flow**

#### Step 1: Login
1. Go to http://localhost:3000/login
2. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
3. Click "Sign In"

#### Step 2: Access Main Chat
- You're now logged in
- Can upload documents and chat like regular user
- User profile visible in top-right corner

#### Step 3: Open Admin Dashboard
1. Click the user profile icon (top-right)
2. Select "Admin Dashboard"
3. You'll see all users in the system

#### Step 4: Manage Users
- **View User**: Click on any username to see details
  - Email, company, role, join date
  - All conversations (active + deleted)
- **Monitor Conversations**: See what each user has discussed
  - Active conversations: normal background
  - Deleted conversations: red background with badge
  - Each shows creation date and (if deleted) deletion date
- **Delete User**: Click trash icon next to username
  - User is soft-deleted (data preserved)
  - Can still be recovered from conversations.json

---

### **WORKFLOW 2: Regular User Flow**

#### Step 1: Register New Account
1. Go to http://localhost:3000/login
2. Click "Sign up" link
3. Fill in registration form:
   - Username (required)
   - Email (required)
   - Password (6+ characters)
   - Company (optional, defaults to "Default Company")
4. Click "Create Account"
5. You'll be automatically logged in

#### Step 2: Upload Documents
- Documents are visible in the left sidebar
- Drag & drop files into the upload box or click to select
- Supported formats: PDF, TXT, DOCX, CSV, JSON
- Files are processed and indexed for RAG

#### Step 3: Start Chatting
1. Type a question about your documents
2. Click "Send" (or press Enter)
3. Watch the response stream in real-time with typing effect
4. Sources are shown below each response

#### Step 4: Manage Conversations
- **Create New**: Click "New Chat" button (top of sidebar)
- **View History**: Conversations list below upload area
- **Switch Conversation**: Click any conversation title
- **Rename Conversation**: (Available in conversation management)
- **Delete Conversation**: (Marked as deleted, data preserved)

#### Step 5: View Profile
1. Click user icon (top-right)
2. Shows your username and email
3. Can logout using "Sign Out" button

---

## 🔐 Security & Privacy

### User Data Isolation
- ✅ Users only see their own conversations
- ✅ Users only see their own documents
- ✅ Conversations cannot be accessed by other users
- ✅ Admins can override to view any user's data

### Data Preservation
- ✅ Deleted conversations can be recovered by admins
- ✅ Deleted users' conversations preserved
- ✅ No data is permanently lost (soft deletes only)

### Authentication
- ✅ Sessions validated on backend
- ✅ User data stored in browser localStorage
- ✅ Passwords hashed with SHA256
- ✅ Role-based access control enforced

---

## 💬 Chat Features

### Streaming Responses
- Responses appear character-by-character (like Claude)
- Status indicator shows "Responding..." while processing
- Real-time feedback during generation

### Source Attribution
- Every response shows sources from uploaded documents
- Includes document name and page number (if available)
- Click to understand context of answer

### Conversation Management
- **Auto-Save**: All messages saved automatically
- **Timestamps**: Each message shows when it was sent
- **Full History**: Access complete conversation history

---

## 📊 Admin Dashboard Features

### Users Section (Left Panel)
- List of all active users
- Click to select and view details
- Delete button for user management
- Search/filter (future feature)

### User Details (Right Panel)
When you select a user:
- **Profile Info**: Email, Company, Role, Joined Date
- **Conversations**: All conversations for this user
  - Active conversations (normal styling)
  - Deleted conversations (red, with "Deleted" badge)
  - Click to view conversation details
- **Statistics**: (Future: message count, activity, etc.)

### Admin Actions
- View all user data
- Monitor conversations
- Delete users (soft delete)
- Recover deleted conversations
- Check user activity history

---

## 🐛 Troubleshooting

### Issue: "Not authenticated" on page load
**Solution:**
1. Clear browser cache and localStorage
2. Go to http://localhost:3000/login
3. Login again

**Command to clear localStorage:**
```javascript
// In browser console
localStorage.clear()
// Then reload the page
```

### Issue: Backend returns 401 Unauthorized
**Possible Causes:**
1. Backend session lost
2. Token expired (if using JWT)
3. User deleted from system

**Solution:**
- Logout and login again
- Check if backend is running: http://localhost:3000/api/status

### Issue: Can't create new users
**Possible Causes:**
1. Not logged in as admin
2. Backend registration endpoint error

**Solution:**
- Make sure you're logged in as admin
- Check backend logs for errors

### Issue: Documents not indexed
**Possible Causes:**
1. Ollama embeddings service not running
2. Document format not supported
3. File too small to chunk

**Solution:**
1. Check Ollama: `ollama list`
2. Verify model: `nomic-embed-text:latest` is installed
3. Try with a different document
4. Check backend logs

### Issue: Conversations not loading
**Possible Causes:**
1. conversations.json file corrupted
2. Backend not responding

**Solution:**
1. Backup conversations.json
2. Restart backend
3. Check file permissions

---

## 🔄 Common Tasks

### Create a New User Account
1. Logout (click profile → Sign Out)
2. Click "Sign up" on login page
3. Fill in form and submit
4. Auto-logged in after registration

### Add User to Admin Panel View
- Automatic - all users appear in admin dashboard

### View Specific User's Conversations
1. Open Admin Dashboard
2. Click on username in left panel
3. See all conversations (active + deleted) in right panel

### Recover a Deleted Conversation
1. Open Admin Dashboard
2. Select the user who owned the conversation
3. Find conversation with "Deleted" badge
4. (Note: Currently read-only, restoration coming soon)

### Check Backend Status
1. Admin Dashboard shows "Active" status
2. Or visit: http://localhost:3000/api/status
3. Or call: `GET http://localhost:3000/api/status`

### Export Conversation
- Currently: Copy/paste from UI
- Future: PDF export from admin dashboard

---

## 📊 System Information

### Stored Data
**Location**: `rag-chatbot/backend/`

| File | Contents |
|------|----------|
| `users.json` | User accounts, emails, hashed passwords |
| `conversations.json` | All conversations, messages, metadata |
| `chroma_db/` | Vector embeddings for RAG |
| `data/` | Uploaded documents |

### Backend Endpoints

**Auth:**
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

**Admin:**
- `GET /api/admin/users`
- `POST /api/admin/users`
- `DELETE /api/admin/users/{username}`
- `GET /api/admin/users/{username}/conversations`

**Chat:**
- `POST /api/chat/stream`
- `GET /api/conversations`
- `POST /api/conversations`
- `DELETE /api/conversations/{id}`

**Documents:**
- `GET /api/documents`
- `POST /api/upload`
- `DELETE /api/documents/{name}`

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Backend starts without errors
- [ ] Frontend loads at localhost:3000
- [ ] Can login with admin/admin123
- [ ] Can register new user
- [ ] Can upload documents
- [ ] Can ask questions and get responses
- [ ] Responses stream in real-time
- [ ] Sources display below responses
- [ ] Can view conversations list
- [ ] Can switch between conversations
- [ ] Can logout and login as different user
- [ ] New user only sees own conversations
- [ ] Admin can view all users
- [ ] Admin can view all conversations
- [ ] Deleted conversations show with red badge
- [ ] Profile dropdown shows in top-right
- [ ] Status indicator shows "Active"

---

## 🚀 Performance Tips

1. **Use PDFs over TXT** - Better chunking and page tracking
2. **Keep documents under 50MB** - Faster indexing
3. **Ask specific questions** - Better RAG results
4. **Check documents before asking** - Ensure data is uploaded

---

## 📖 Additional Resources

- **Backend Logs**: Check terminal running `python app.py`
- **Frontend Logs**: Browser console (F12)
- **Ollama Status**: `ollama ps`
- **Database Files**: `rag-chatbot/backend/*.json`

---

## 🎓 Architecture Notes

- **All data is stored locally** - No cloud services
- **Conversations are per-user** - Complete privacy
- **Admins can audit everything** - Compliance features
- **Soft deletes preserve data** - Recovery possible
- **Real-time streaming** - Better UX than instant responses

---

## 💡 Tips & Tricks

### Faster Login
- Browser stores credentials in localStorage
- Clear localStorage if you want to switch users quickly

### Better RAG Results
1. Upload relevant documents first
2. Use specific, detailed questions
3. System will show sources - verify they match your intent

### Admin Monitoring
- Regularly check Admin Dashboard for user activity
- Review deleted conversations for compliance
- Monitor document uploads per user

### Database Maintenance
- Backup conversations.json before deleting data
- Check users.json for active users
- Monitor chroma_db/ size (grows with documents)

---

**System Ready! Start chatting with your documents.** 🚀
