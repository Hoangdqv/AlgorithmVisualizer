# Admin & User Features - Implementation Plan

## Philosophy
**Focus**: Algorithm visualization is your core value - keep admin/user features lightweight and supportive of that goal.

---

## ✅ RECOMMENDED FEATURES

### User Profile (Simple & Essential)
**Why**: Expected functionality that adds credibility
**Scope**: Minimal - don't distract from main purpose

#### Features to Implement:
```
✓ Edit username/email
✓ Change password  
✓ View account details (created date, role)
? Optional: Default language preference
✗ Skip: Avatars, bio, social features
```

#### Backend Routes:
```python
GET    /api/user/profile          # Get current user
PUT    /api/user/profile          # Update profile
POST   /api/user/change-password  # Change password
```

#### Frontend Components:
```
- UserProfile.jsx (view/edit form)
- ChangePasswordModal.jsx
- Add "Profile" link in NavBar
```

---

### Admin Panel (Algorithm Content Management)
**Why**: Enables maintaining/expanding algorithm library without code deploys
**Scope**: CRUD operations on sample algorithms + explanations

#### Features to Implement:

**Priority 1 - Read/Edit:**
```
✓ View all categories/algorithms
✓ Edit explanation.txt files
✓ View algorithm implementations
```

**Priority 2 - Create/Update:**
```
✓ Add new algorithms to existing categories
✓ Upload/replace Python/JavaScript implementations
✓ Validate code structure (tracer markers)
```

**Priority 3 - Delete/Manage:**
```
✓ Remove algorithms
? Add new categories (rare operation)
✗ Skip: User management, analytics
```

#### Backend Routes:
```python
# Category Management
GET    /api/admin/categories              # List categories
POST   /api/admin/categories              # Create category (optional)

# Algorithm Management  
GET    /api/admin/algorithms              # List all algorithms
GET    /api/admin/algorithms/<cat>/<alg>  # Get specific algorithm
POST   /api/admin/algorithms              # Add new algorithm
PUT    /api/admin/algorithms/<cat>/<alg>  # Update algorithm
DELETE /api/admin/algorithms/<cat>/<alg>  # Delete algorithm

# File Operations
GET    /api/admin/algorithms/<cat>/<alg>/explanation  # Get explanation
PUT    /api/admin/algorithms/<cat>/<alg>/explanation  # Update explanation
GET    /api/admin/algorithms/<cat>/<alg>/code/<lang>  # Get code file
PUT    /api/admin/algorithms/<cat>/<alg>/code/<lang>  # Update code file
```

#### Frontend Components:
```
- AdminPanel.jsx (layout)
- AlgorithmList.jsx (browse algorithms)
- AlgorithmEditor.jsx (edit algorithm details)
- ExplanationEditor.jsx (rich text editor)
- CodeUploader.jsx (upload/edit code files)
- Add "Admin" link in NavBar (if role === 'admin')
```

---

## 🏗️ Implementation Notes

### File Structure
```
sample_algorithms/
├── Sorting/
│   ├── bubblesort/
│   │   ├── explanation.txt
│   │   ├── python/
│   │   │   └── bubblesort.py
│   │   └── javascript/
│   │       └── bubblesort.js
│   └── quicksort/
│       └── ...
├── Graphs/
└── Trees/
```

**Admin operations work directly with this structure**

### Security Considerations
```python
# Always validate:
- File paths (prevent directory traversal)
- File sizes (set reasonable limits)
- File extensions (.py, .js, .txt only)
- Code content (check for tracer markers)
- Role permissions (@admin_required decorator)
```

### Validation Rules
```python
def validate_algorithm_code(code, language):
    """Validate uploaded algorithm code"""
    # Check for tracer import
    if language == 'python':
        if 'from tracer import trace' not in code:
            return False, "Missing tracer import"
    elif language == 'javascript':
        if 'require' not in code and 'tracer' not in code:
            return False, "Missing tracer import"
    
    # Check for JSON marker
    if '[DOCKER_JSON]' not in code:
        return False, "Missing [DOCKER_JSON] marker"
    
    return True, "Valid"
```

### Useful Libraries
```python
# Backend
- os.path / pathlib (file operations)
- werkzeug.utils.secure_filename (sanitize filenames)
- validators (validate inputs)

# Frontend  
- monaco-editor or CodeMirror (code editing)
- react-markdown (preview explanations)
- react-dropzone (file uploads)
```

---

## 📋 Phased Rollout

### Phase 1: User Profile (Quick Win - 2-4 hours)
1. Create user profile backend routes
2. Build UserProfile component
3. Add profile link to NavBar
4. Test password change flow

### Phase 2: Admin Read-Only (4-6 hours)
1. Create admin routes (GET only)
2. Build AdminPanel layout
3. Add algorithm list view
4. Display explanations & code (read-only)
5. Add role-based nav visibility

### Phase 3: Admin Editing (6-8 hours)
1. Add PUT routes for updates
2. Implement explanation editor
3. Implement code file editor
4. Add save/cancel functionality
5. Add success/error notifications

### Phase 4: Admin Creation (4-6 hours)
1. Add POST routes for creation
2. Build "Add Algorithm" form
3. Implement file upload
4. Add validation
5. Handle directory creation

### Phase 5: Admin Deletion (2-3 hours)
1. Add DELETE routes
2. Add confirmation dialogs
3. Handle cascade delete (files + folders)
4. Test thoroughly

**Total Estimate: 18-27 hours for full implementation**

---

## ⚠️ Things to AVOID

### Don't Over-Engineer:
- ❌ Complex permission system (2 roles is enough)
- ❌ Version control for algorithms (git already does this)
- ❌ Approval workflows (admins are trusted)
- ❌ User management panel (not needed)
- ❌ Analytics / usage tracking (scope creep)
- ❌ File history / rollback (use git)

### Don't Add These User Features:
- ❌ Avatar uploads
- ❌ Bio / profile description
- ❌ Social features
- ❌ Email notifications
- ❌ Activity feed
- ❌ Favorites / bookmarks (file system already handles this)

---

## 🎯 Success Criteria

### User Profile Success:
- Users can update their email/username
- Password change works securely
- Profile data persists correctly
- No impact on core visualization functionality

### Admin Panel Success:
- Admins can view all algorithms
- Admins can edit explanations without redeploying
- Admins can upload new algorithm implementations
- Changes reflect immediately in the app
- File system stays organized and valid
- No security vulnerabilities (path traversal, code injection)

---

## 🤔 Decision Points

### Questions to Consider:

1. **Should users be able to delete their accounts?**
   - Pro: User privacy/control
   - Con: Orphaned files? Need cascade delete
   - **Recommendation**: Start without it, add if requested

2. **Should there be a category management system?**
   - Pro: More flexible
   - Con: Category names are in many places (frontend dropdowns, routes)
   - **Recommendation**: Hardcode categories initially, add later if needed

3. **Should admins edit code in-browser or upload files?**
   - Pro (edit): Immediate feedback, no file management
   - Con (edit): Complex editor, need syntax validation
   - **Recommendation**: Support both - in-browser Monaco editor + upload option

4. **Should there be a staging/preview system?**
   - Pro: Safe testing before publishing
   - Con: Added complexity
   - **Recommendation**: Skip it - admins can test in the main visualizer

---

## 📚 Resources

### Existing Code References:
- Role system: `backend/models.py` (User model)
- RBAC decorators: `backend/app.py` (@admin_required)
- Auth context: `frontend/src/context/AuthContext.jsx`
- Algorithm structure: `sample_algorithms/` directory
- Config mapping: `backend/config.py` (ALGORITHM_MAP)

### Libraries to Consider:
- **monaco-react**: VSCode editor in React
- **react-markdown**: Render markdown explanations
- **react-dropzone**: Drag-drop file uploads
- **react-hot-toast**: Notifications
- **zod**: Request validation (Python equivalent: pydantic)

---

## ✅ Final Recommendation

**Implement in this order:**
1. **User Profile** - Quick, expected, low risk
2. **Admin Read-Only** - Gives visibility into algorithms
3. **Admin Edit Explanation** - Highest value admin feature
4. **Admin Upload Code** - Enables adding algorithms
5. **Admin Delete** - Complete the CRUD cycle

**Stop here unless you need more.**

Don't build features that admins will use once or that users don't expect. Your core value is algorithm visualization - everything else should support that goal, not distract from it.
