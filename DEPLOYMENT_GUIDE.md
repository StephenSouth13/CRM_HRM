# Deployment and Setup Guide

## 🎯 What's Been Done

All requested features have been implemented:
- ✅ Admin role permissions fixed for task creation
- ✅ Mock data removed from all components
- ✅ Task management enhanced with assigned_by field support
- ✅ Meeting room participants management system
- ✅ Google Meet integration
- ✅ Column management structure ready
- ✅ Dual user approval system verified
- ✅ SQL migrations provided

---

## 📦 New Files Created

### Components
1. **`src/components/rooms/RoomParticipantsManager.tsx`**
   - Manages meeting room participants
   - Add/remove participants
   - Google Meet link generation
   - Track attendance status

### SQL & Documentation
1. **`supabase/migrations/add_task_management_features.sql`**
   - Complete database schema updates
   - Creates 8 new tables
   - Enhances 5 existing tables
   - Includes RLS policies

2. **`DATABASE_SCHEMA_GUIDE.md`**
   - SQL documentation
   - Quick reference for database tables
   - Implementation notes

3. **`IMPLEMENTATION_SUMMARY.md`**
   - Detailed implementation details
   - Architecture decisions
   - Next steps

4. **`DEPLOYMENT_GUIDE.md`** (this file)
   - Step-by-step deployment instructions

---

## 🚀 Deployment Steps

### Step 1: Review Changes
```bash
# Review all modified files
git diff

# Key files changed:
- src/pages/Tasks.tsx
- src/components/tasks/KanbanBoard.tsx
- src/components/rooms/MyBookings.tsx
- src/pages/Settings.tsx
- src/components/attendance/AttendanceWidget.tsx
- src/components/tasks/FilesTab.tsx
```

### Step 2: Run SQL Migrations
**In Supabase Dashboard:**

1. Go to `SQL Editor`
2. Create a new query
3. Copy all content from `supabase/migrations/add_task_management_features.sql`
4. Run the query
5. Verify success (no errors)

**Alternatively, using Supabase CLI:**
```bash
supabase migration up
```

### Step 3: Verify Database Changes
```sql
-- Check if new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN (
  'room_participants', 'task_comments', 'task_attachments',
  'task_history', 'task_columns', 'task_files'
);

-- Check if columns were added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name IN (
  'assigned_by', 'completed_by', 'completion_notes', 'column_id'
);
```

### Step 4: Update Environment (if needed)
No new environment variables required. Existing Supabase config is sufficient.

### Step 5: Build and Deploy
```bash
# Install dependencies (if any new packages were added)
npm install
# or
yarn install
# or
pnpm install

# Build the project
npm run build

# Test locally
npm run dev

# Deploy to your hosting platform
# (Netlify, Vercel, etc.)
```

---

## ✅ Testing Checklist

### Task Management
- [ ] Users can create tasks on the Kanban board
- [ ] Admin users can create tasks without errors
- [ ] Tasks show correct creator information
- [ ] Task editing works properly
- [ ] Task deletion works properly

### Meeting Rooms
- [ ] Create a room booking
- [ ] Click on booking to expand and see participants section
- [ ] Add participants to booking
- [ ] Generate Google Meet link
- [ ] Click "Join Google Meet" button works
- [ ] Participant status updates (invited, accepted, etc.)
- [ ] Organizer can remove participants

### User Registration
- [ ] New user registration still works
- [ ] PendingApproval page shows correct dual approval status
- [ ] Admin can approve registrations
- [ ] HR can approve registrations
- [ ] User can only login after BOTH approvals
- [ ] Rejection workflow works

### Data Quality
- [ ] No mock data appears in Settings (Active Sessions)
- [ ] No mock data in Attendance Widget
- [ ] FilesTab loads files from database (empty if no files)
- [ ] All file uploads properly recorded

---

## 🔧 Troubleshooting

### Issue: SQL Migration Fails
**Solution:**
- Check for syntax errors in the SQL
- Ensure you're in the correct Supabase project
- Try running individual table creation statements
- Check Supabase documentation for your plan limits

### Issue: Room Participants Not Loading
**Solution:**
```sql
-- Verify RLS policies are working
-- Check if user has permission to read room_bookings
SELECT * FROM room_participants LIMIT 1;
```

### Issue: Google Meet Link Not Generating
**Solution:**
- Verify room_bookings table has google_meet_link column
- Check browser console for errors
- Ensure booking ID is being passed correctly

### Issue: TaskCard Not Rendering Properly
**Solution:**
- Verify KanbanBoard is passing currentUserId prop
- Check console for TypeScript errors
- Ensure task data is loading from database

---

## 📝 Configuration Notes

### Default Approval Workflow
New users automatically get:
- `account_status: 'PENDING'` in profiles table
- Entry in user_registrations table with status 'pending'
- Must wait for Admin approval AND HR approval
- After both approve, status changes to 'APPROVED'

### Task Creation
- Any user can create personal/team tasks
- Tasks automatically assigned to current user as creator
- Tasks can be reassigned to other team members
- Completed tasks track who completed them and when

### Room Bookings
- Booking creator becomes organizer
- Only organizer can add/remove participants
- Participants receive invitations
- Google Meet link is unique per booking

---

## 🔐 Security Considerations

### RLS Policies Enabled
All new tables include Row Level Security:
- `room_participants` - Team members only
- `task_comments` - Team members only
- `task_attachments` - Team members only
- `task_history` - Team members only

### Database Permissions
- Regular users: Can read/write own data
- Admin/Leader: Can read/write team data
- HR: Can approve registrations

---

## 📚 Documentation Files

- **IMPLEMENTATION_SUMMARY.md** - What was implemented and remaining items
- **DATABASE_SCHEMA_GUIDE.md** - Database table descriptions
- **DUAL_APPROVAL_IMPLEMENTATION.md** - Registration approval workflow
- **DEPLOYMENT_GUIDE.md** - This file

---

## 🆘 Support

### If Issues Occur:
1. Check browser console for errors
2. Check Supabase logs for database errors
3. Verify all migrations ran successfully
4. Check RLS policies are enabled
5. Review the relevant documentation file
6. Check existing GitHub issues

### Rollback Plan:
If you need to rollback:
```sql
-- Disable the migrations (in reverse order)
-- Drop new tables
DROP TABLE IF EXISTS task_columns CASCADE;
DROP TABLE IF EXISTS task_files CASCADE;
DROP TABLE IF EXISTS task_labels CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS task_history CASCADE;
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS room_participants CASCADE;

-- Remove added columns
ALTER TABLE tasks DROP COLUMN IF EXISTS assigned_by;
ALTER TABLE tasks DROP COLUMN IF EXISTS completed_by;
ALTER TABLE tasks DROP COLUMN IF EXISTS completion_notes;
ALTER TABLE tasks DROP COLUMN IF EXISTS column_id;

-- Continue with other rollback steps as needed
```

---

## ✨ Next Steps (Optional Enhancements)

1. **Custom Task Columns**
   - Create admin interface for managing columns
   - Allow teams to customize their board layout

2. **Task Comments UI**
   - Add comment section to task details
   - Show comment history

3. **File Upload UI**
   - Create file upload interface
   - Track file history

4. **Advanced Notifications**
   - Email notifications for task assignments
   - Meeting reminders
   - Approval notifications

5. **Zoom Integration**
   - Alongside Google Meet support
   - Generate Zoom links

---

## 📞 Contact & Support

For issues or questions:
1. Review the documentation files included
2. Check the implementation notes
3. Test with the testing checklist
4. Contact your development team

---

**Last Updated**: 2024
**Status**: Ready for Deployment
**Estimated Deploy Time**: 30-45 minutes including testing
