# Dual-Approval Registration System Implementation

## Overview

This document describes the implementation of a dual-approval registration system where new users must be approved by both **Admin** and **HR** before they can access the dashboard.

## System Requirements Met

✅ New users registering via `/auth/login` must be approved by BOTH admin and HR  
✅ Only after both approvals can users access `/dashboard`  
✅ Users awaiting approval are redirected to `/auth/pending-approval`  
✅ Approval status is displayed to users showing which approvals are pending  
✅ Both admin and HR can see registration requests and provide their respective approvals  

## Database Changes

### Migration File
**File:** `supabase/migrations/20251128_add_dual_approval_system.sql`

This migration adds the following to the existing `user_registrations` table:

1. **New Columns:**
   - `admin_approved_at` - Timestamp when admin approved
   - `admin_approved_by` - User ID of the admin who approved
   - `hr_approved_at` - Timestamp when HR approved
   - `hr_approved_by` - User ID of the HR staff who approved

2. **Updated Functions:**
   - `approve_user_registration()` - Now accepts `p_approval_by` parameter ('admin' or 'hr')
   - Checks that both approvals are complete before setting overall status to 'APPROVED'
   - Only updates profile.account_status to 'APPROVED' when BOTH admin and HR have approved

3. **New Functions:**
   - `get_registration_approval_status()` - Returns detailed approval status for a registration

4. **Updated Views:**
   - `pending_registrations` - Now shows admin_approved_at and hr_approved_at

5. **RLS Policies:**
   - Admins can manage registrations (approve/reject)
   - HR can approve registrations

## Code Changes

### 1. Authentication Module (`src/lib/auth.ts`)

#### UserRole Type
```typescript
export type UserRole = 'admin' | 'leader' | 'staff' | 'hr';
```

Added 'hr' role to support HR staff approvals.

#### Updated Functions

**`approveRegistration()`**
```typescript
export const approveRegistration = async (
  registrationId: string, 
  role: string, 
  approvalBy: 'admin' | 'hr' = 'admin'
) => {
  // Calls the RPC function with approval type
  const { data, error } = await supabase.rpc('approve_user_registration', {
    p_registration_id: registrationId,
    p_role: role,
    p_approval_by: approvalBy,
    p_admin_notes: null
  });
  return { data, error: null };
};
```

**`getRegistrationStatus()`**
```typescript
// Now returns dual approval status:
{
  status: 'pending' | 'approved' | 'rejected',
  admin_approved: boolean,
  hr_approved: boolean,
  both_approved: boolean,
  rejection_reason?: string,
  reapplication_count: number
}
```

**`rejectRegistration()`**
Uses the existing RPC function, no changes needed.

### 2. Registration Approvals Component (`src/pages/admin/RegistrationApprovals.tsx`)

#### Key Features

- **Role-Based UI:**
  - Admins see a form to assign roles during approval
  - HR staff see a simpler approval dialog
  - Only admins can reject registrations

- **Dual Approval Status Display:**
  ```
  Admin: [✓ Approved / ⏱ Pending]
  HR:    [✓ Approved / ⏱ Pending]
  ```

- **Approval Status Badges:**
  - Yellow: Awaiting Approval
  - Blue: Partially Approved
  - Green: Fully Approved
  - Red: Rejected

- **Smart Action Buttons:**
  - Shows "Approve" button only if:
    - Admin hasn't approved yet (for admins)
    - HR hasn't approved yet (for HR staff)
  - "Reject" button only available to admins

- **Info Alert:**
  - Shows admins that the process requires both admin and HR approval

### 3. Pending Approval Page (`src/pages/auth/PendingApproval.tsx`)

#### User-Facing Features

- **Dual Approval Status Grid:**
  Shows separate cards for Admin and HR approval status with icons
  - ✓ Green checkmark when approved
  - ⏱ Clock icon when pending

- **Adaptive Messages:**
  - "Awaiting Approval" - when one or both approvals pending
  - "Fully Approved" - when both have approved, with button to go to dashboard
  - "Rejected" - shows rejection reason and allows reapplication

- **Time Tracking:**
  Shows how many days the user has been waiting

- **Email Notification Info:**
  Informs users they'll receive email when approval is complete

### 4. Login Component (`src/pages/auth/Login.tsx`)

- Checks `profile.account_status` after login
- Redirects to `/auth/pending-approval` if status is not 'APPROVED'
- Only allows access to dashboard after both approvals

### 5. Dashboard Component (`src/pages/Dashboard.tsx`)

- Added account_status check on dashboard load
- Redirects to `/auth/pending-approval` if user not fully approved
- Prevents unauthorized access

## User Registration Flow

```
1. User Registers
   ↓
2. Profile Created with account_status = 'PENDING'
   ↓
3. User Registration Record Created (auto via trigger)
   ↓
4. User Redirected to /auth/pending-approval
   ↓
5a. Admin Reviews & Approves/Rejects
    - If rejected: User cannot login (rejection_reason shown)
    - If approved: admin_approved_at set, awaiting HR
   ↓
5b. HR Reviews & Approves
    - hr_approved_at set
   ↓
6. Both Admin & HR Approved?
   - NO: account_status remains 'PENDING', user sees status
   - YES: account_status set to 'APPROVED', user_role assigned
   ↓
7. User Can Now Login & Access Dashboard
```

## Role Permissions

| Action | Admin | HR | Leader | Staff |
|--------|-------|----|---------|----- |
| View Registrations | ✓ | ✓ | ✗ | ✗ |
| Approve Registrations | ✓ | ✓ | ✗ | ✗ |
| Reject Registrations | ✓ | ✗ | ✗ | ✗ |
| Assign Roles | ✓ | ✗ | ✗ | ✗ |

## Database Enums

The system uses the existing `app_role` enum which includes:
- 'admin' - Full system access
- 'hr' - HR management access
- 'leader' - Team leader access
- 'staff' - Regular staff member (default)

## Frontend Routes

- `/auth/login` - Registration & Login page
- `/auth/pending-approval` - Shows approval status
- `/dashboard` - Protected, requires APPROVED status
- `/admin/registrations` - Admin/HR approval management page

## Testing Checklist

- [ ] Create new user account via registration form
- [ ] Verify user redirected to pending approval page
- [ ] Login as admin and approve the registration
- [ ] Verify approval status shows "Admin: Approved, HR: Pending"
- [ ] Login as HR staff and approve the same registration
- [ ] Verify approval status shows both approved
- [ ] Try to login as the new user and verify dashboard access
- [ ] Test rejection flow - verify rejection reason shown
- [ ] Test re-application after rejection
- [ ] Verify HR cannot reject (only admin can)
- [ ] Test that admin can reject before HR approval
- [ ] Verify proper role assignment by admin during approval

## API/RPC Functions Used

### approve_user_registration(p_registration_id, p_role, p_approval_by, p_admin_notes)
- Handles both admin and HR approvals
- Returns JSON with success status and approval status
- Sets account_status to 'APPROVED' only when both have approved

### reject_user_registration(p_registration_id, p_rejection_reason)
- Marks registration as rejected
- Increments reapplication_count
- Only callable by admins

### get_registration_approval_status(p_registration_id)
- Returns detailed approval status
- Used by frontend to display current state

## Error Handling

- Invalid approval type caught in RPC function
- Non-existent registrations handled gracefully
- RLS policies prevent unauthorized access
- Toast notifications inform users of success/errors

## Future Enhancements

1. **Email Notifications:** Send emails when admin/HR approves/rejects
2. **Approval Timeline:** Show full approval history with timestamps
3. **Comments:** Allow admins/HR to add comments during approval
4. **Bulk Actions:** Approve/reject multiple registrations at once
5. **SLA Tracking:** Monitor approval turnaround time
6. **Conditional Routing:** Different role assignment based on department
7. **Document Review:** Require CV/document review before approval
