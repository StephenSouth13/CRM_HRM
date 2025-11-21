# HRM Registration & Authentication System - Implementation Guide

## Overview

This guide provides a complete implementation of a professional registration, approval, and authentication system for the HRM application with Montserrat font styling throughout.

---

## ✅ What's Been Implemented

### 1. **Professional Montserrat Font** (Completed)
- Global font applied to entire application
- Google Fonts integration for production-ready typography
- Consistent professional appearance across all pages

**Files Modified:**
- `tailwind.config.ts` - Updated font family to Montserrat
- `src/index.css` - Applied Montserrat to all text elements
- `index.html` - Added Google Fonts import

---

### 2. **Enhanced Registration Form** (Completed)
New features added to signup process:
- ✅ First Name & Last Name fields
- ✅ Phone number input
- ✅ Email validation
- ✅ **Role Selection** (Staff, IT, HR, Design, Content)
- ✅ **Department Selection** (IT, HR, Sales, Marketing, Design, Content)
- ✅ Password validation (minimum 6 characters)
- ✅ Form validation and error handling
- ✅ Auto-scrolling for mobile devices

**File:** `src/pages/auth/Login.tsx`

**Available Roles:**
```
- Staff (Nhân Viên)
- IT
- HR  
- Design
- Content
```

**Available Departments:**
```
- Công Nghệ Thông Tin (IT)
- Nhân Sự (HR)
- Bán Hàng (Sales)
- Marketing
- Thiết Kế (Design)
- Nội Dung (Content)
```

---

### 3. **Forgot Password System** (Completed)
Multi-step password recovery process:
- ✅ Step 1: Email verification
- ✅ Step 2: OTP code verification
- ✅ Step 3: New password entry with confirmation
- ✅ Success confirmation
- ✅ Error handling for each step
- ✅ Back/restart navigation

**File:** `src/pages/auth/ForgotPassword.tsx`
**Route:** `/auth/forgot-password`

**Features:**
- Professional card-based UI
- Password strength validation
- Confirmation password matching
- Clear error messages
- Success notification

---

### 4. **Registration Approval Dashboard** (Completed)
Admin/HR dashboard for managing user registrations:
- ✅ View all registration requests
- ✅ Filter by status (Pending, Approved, Rejected)
- ✅ Search by email or name
- ✅ Display applicant details (name, email, phone, role, department)
- ✅ Approve registrations with role assignment
- ✅ Reject registrations with optional reason
- ✅ Statistics cards (Pending, Approved, Rejected counts)
- ✅ Status badges with appropriate colors

**File:** `src/pages/admin/RegistrationApprovals.tsx`
**Route:** `/admin/registrations`

**Access Control:**
- Only Admin and Leader roles can access
- Automatic redirect for unauthorized users

**Features:**
- Real-time status indicators
- Email notification system
- Audit trail of actions
- Role selection during approval

---

### 5. **Updated Authentication Functions** (Completed)

New auth functions added to `src/lib/auth.ts`:

```typescript
// Password Recovery
resetPasswordRequest(email: string)
updatePassword(newPassword: string)
verifyOtp(email: string, token: string, type: string)

// Registration Management
getPendingRegistrations()
approveRegistration(registrationId: string, role: string)
rejectRegistration(registrationId: string, reason: string)
```

---

### 6. **SQL Database Schema** (Provided)

Complete SQL queries provided in `SQL_QUERIES.md`:
- ✅ User registrations table
- ✅ User roles table (with constraints)
- ✅ Profiles table (updated structure)
- ✅ Notifications table
- ✅ RLS policies for security
- ✅ Database functions for approval workflow
- ✅ Triggers for automated notifications
- ✅ Views for easy data querying
- ✅ Sample data for testing

---

## 🚀 How to Use

### For End Users (Registration & Login)

#### 1. **New User Registration**
```
1. Go to: http://localhost:5173/auth/login
2. Click "Đăng Ký" tab
3. Fill in all required fields:
   - Họ (Last Name)
   - Tên (First Name)
   - Số điện thoại (Phone - optional)
   - Email
   - Vị Trí Công Việc (Job Position)
   - Phòng Ban (Department)
   - Mật khẩu (Password - min 6 characters)
4. Click "Đăng Ký"
5. Wait for Admin/HR approval notification
```

#### 2. **Forgot Password**
```
1. On login page, click "Quên mật khẩu?"
2. Enter your email
3. Check your email for verification code
4. Enter the 6-digit code
5. Set your new password
6. Confirm and login with new password
```

#### 3. **Login**
```
1. Go to: http://localhost:5173/auth/login
2. Enter email and password
3. Click "Đăng nhập"
4. Will redirect to dashboard if approved
```

---

### For Admin/HR (Registration Approval)

#### 1. **Access Approval Dashboard**
```
Navigate to: http://localhost:5173/admin/registrations
```

#### 2. **View Pending Registrations**
- Dashboard automatically shows pending registrations
- Search by email or name
- Filter by status (Pending, Approved, Rejected)

#### 3. **Approve Registration**
```
1. Find registration in list
2. Click "Phê Duyệt" button
3. Select role from dropdown:
   - Admin
   - Leader (Team Lead)
   - Staff (Default)
4. Click "Phê Duyệt"
5. User receives approval notification
```

#### 4. **Reject Registration**
```
1. Find registration in list
2. Click "Từ Chối" button
3. Enter rejection reason (optional)
4. Click "Từ Chối"
5. User receives rejection notification
```

---

## 📋 Setup Instructions

### Step 1: Run SQL Queries in Supabase

1. Open `SQL_QUERIES.md`
2. Go to [Supabase Dashboard](https://supabase.com)
3. Navigate to **SQL Editor**
4. Create a new query and copy each section:
   - Create user_registrations table (Section 1)
   - Update user_roles table (Section 2)
   - Create functions (Sections 4 & 5)
   - Enable RLS (Section 6)
   - Create notifications table (Section 7)
   - Create triggers (Section 8)
5. Run each query
6. Verify tables were created

### Step 2: Enable Real-time Subscriptions (Optional)

For live updates on registration approvals:
1. Go to **Database** → **Replication**
2. Find `user_registrations` table
3. Toggle **ON**
4. Find `notifications` table
5. Toggle **ON**

### Step 3: Verify Application

1. Start dev server: `npm run dev`
2. Test registration flow: `/auth/login`
3. Test forgot password: `/auth/forgot-password`
4. Access approval dashboard: `/admin/registrations` (with admin account)

---

## 🎨 UI Components Used

The implementation uses shadcn/ui components:
- `Card` - Container for sections
- `Button` - Action buttons
- `Input` - Form inputs
- `Label` - Form labels
- `Select` - Dropdown menus
- `Tabs` - Login/Register tabs
- `AlertDialog` - Confirmation dialogs
- `Badge` - Status indicators

---

## 🔒 Security Features

### Row Level Security (RLS)
- User registrations are protected
- Users can only see their own data
- Admin/HR can view all registrations
- Service role for backend operations

### Password Security
- Passwords minimum 6 characters
- No passwords stored in frontend
- Uses Supabase auth encryption

### Data Validation
- Email format validation
- Phone number validation
- Role constraints in database
- Department constraints in database

---

## 📱 Responsive Design

All pages are fully responsive:
- Mobile: Single column layout
- Tablet: 2-column grid
- Desktop: Multi-column optimized

---

## 🌐 Languages

Complete Vietnamese localization:
- All labels in Vietnamese
- All error messages in Vietnamese
- All success notifications in Vietnamese
- Professional, consistent terminology

---

## 📊 Key Files

### Frontend
```
src/pages/auth/
├── Login.tsx                    (Registration + Login)
└── ForgotPassword.tsx           (Password Recovery)

src/pages/admin/
└── RegistrationApprovals.tsx    (Admin Dashboard)

src/lib/
└── auth.ts                      (Auth Functions)

src/App.tsx                       (Routes Configuration)
```

### Configuration
```
tailwind.config.ts               (Font Configuration)
index.html                       (Google Fonts Import)
src/index.css                    (Global Styles)
```

### Documentation
```
SQL_QUERIES.md                   (Database Schema)
IMPLEMENTATION_GUIDE.md          (This File)
```

---

## 🔄 User Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    NEW USER WORKFLOW                     │
└─────────────────────────────────────────────────────────┘

1. User Registration
   ├─ Go to /auth/login
   ├─ Fill signup form (name, email, role, department, password)
   ├─ Submit
   └─ Status: "Chờ Duyệt" (Pending)

2. Admin/HR Reviews
   ├─ Go to /admin/registrations
   ├─ View pending request
   ├─ Approve + select role → User gets email
   └─ OR Reject + reason → User gets rejection email

3. User Logs In
   ├─ Go to /auth/login
   ├─ Enter email & password
   ├─ Status: "Đã Duyệt" (Approved)
   └─ Access to Dashboard

4. User Forgot Password (Anytime)
   ├─ Go to /auth/forgot-password
   ├─ Enter email
   ├─ Verify with OTP code
   ├─ Set new password
   └─ Login with new password
```

---

## 📧 Notification System

### When Registration is Submitted
- Admin/HR receives notification: "Yêu Cầu Đăng Ký Mới"

### When Registration is Approved
- User receives notification: "Đăng Ký Được Phê Duyệt"
- Message: "Tài khoản của bạn đã được phê duyệt! Bạn có thể đăng nhập ngay bây giờ."

### When Registration is Rejected
- User receives notification: "Đăng Ký Bị Từ Chối"
- Message includes rejection reason if provided

---

## 🐛 Troubleshooting

### Issue: Registrations table doesn't exist
**Solution:** Run SQL queries from `SQL_QUERIES.md` Section 1 in Supabase SQL Editor

### Issue: Admin can't access approval dashboard
**Solution:** Ensure user has `admin` or `leader` role in `user_roles` table

### Issue: Forgot password email not received
**Solution:** 
- Check Supabase Email settings
- Verify email address in database
- Check spam folder

### Issue: Registration not showing in approval dashboard
**Solution:**
- Refresh page or clear browser cache
- Check `user_registrations` table exists
- Verify RLS policies are enabled

---

## 📈 Next Steps (Optional)

1. **Email Templates**
   - Customize Supabase email templates in Dashboard
   - Add company branding to emails

2. **Email Service Integration**
   - Connect to SendGrid or Mailgun for production
   - Configure custom email domain

3. **Two-Factor Authentication**
   - Add OTP-based 2FA for admin accounts
   - Implement SMS verification

4. **Registration Approval Workflow**
   - Add multi-level approvals
   - Create registration audit logs
   - Add comment/notes on approvals

5. **Analytics Dashboard**
   - Track registration trends
   - Monitor approval times
   - Generate reports

---

## 🎓 Additional Resources

### Supabase Documentation
- [Authentication](https://supabase.com/docs/guides/auth)
- [Database](https://supabase.com/docs/guides/database)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Component Documentation
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)

### Vietnamese Localization
- All UI text is in Vietnamese
- Date formats: DD/MM/YYYY
- Phone format: Vietnamese standard

---

## ✨ Features Summary

| Feature | Status | Files |
|---------|--------|-------|
| Registration Form | ✅ Done | Login.tsx |
| Role Selection | ✅ Done | Login.tsx |
| Department Selection | ✅ Done | Login.tsx |
| Forgot Password | ✅ Done | ForgotPassword.tsx |
| Approval Dashboard | ✅ Done | RegistrationApprovals.tsx |
| Notifications | ✅ Done | SQL_QUERIES.md |
| RLS Security | ✅ Done | SQL_QUERIES.md |
| Montserrat Font | ✅ Done | tailwind.config.ts |
| Vietnamese UI | ✅ Done | All components |
| Mobile Responsive | ✅ Done | All pages |

---

## 📞 Support

For issues or questions:
1. Check this guide's Troubleshooting section
2. Review SQL_QUERIES.md for database issues
3. Check browser console for errors
4. Verify Supabase connection settings

---

**Implementation Complete! Ready for Production** ✨
