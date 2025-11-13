"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/supabase"

/**
 * Server Action: Login user with email and password
 * Handles:
 * 1. Auth validation with Supabase
 * 2. Profile and membership verification
 * 3. Account status checking
 * 4. Server-side session management
 */
export async function loginAction(email: string, password: string) {
  try {
    // 1. Create Supabase client for server-side operations
    const supabase = await createSupabaseServerClient()

    // 2. Sign in with email and password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return {
        success: false,
        error: "Invalid email or password.",
        errorCode: "INVALID_CREDENTIALS",
      }
    }

    // 3. Get admin client to fetch profile (bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      await supabase.auth.signOut()
      return {
        success: false,
        error: "Server configuration error",
        errorCode: "SERVER_ERROR",
      }
    }

    // 4. Fetch user profile and memberships
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select(`*, memberships (*, roles (role_key, role_name))`)
      .eq("id", authData.user.id)
      .single()

    if (profileError || !userProfile) {
      await supabase.auth.signOut()
      return {
        success: false,
        error: "User profile not found.",
        errorCode: "PROFILE_NOT_FOUND",
      }
    }

    // 5. Extract role information
    const primaryMembership = userProfile.memberships?.[0] || {}
    const roleKey = primaryMembership?.roles?.role_key || "pending_approval"
    const accountStatus = userProfile.account_status

    // 6. Check account approval status
    if (accountStatus !== "APPROVED") {
      await supabase.auth.signOut()
      return {
        success: false,
        error: "Your account is not approved yet. Please wait for administrator approval.",
        errorCode: "ACCOUNT_NOT_APPROVED",
        status: accountStatus,
      }
    }

    // 7. Login successful - prepare response
    return {
      success: true,
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.full_name,
        role_key: roleKey,
        org_id: primaryMembership.org_id || null,
        account_status: accountStatus,
        is_authenticated: true,
      },
    }
  } catch (error) {
    console.error("Login error:", error)
    return {
      success: false,
      error: "An unexpected error occurred during login.",
      errorCode: "UNKNOWN_ERROR",
    }
  }
}

/**
 * Server Action: Register new user
 * Handles:
 * 1. Input validation
 * 2. User existence check
 * 3. Auth user creation
 * 4. Profile creation
 * 5. Membership setup with role assignment
 */
export async function registerAction(
  email: string,
  password: string,
  name: string,
  org_id: string,
) {
  try {
    // 1. Validate inputs
    if (!email || !password || !name || !org_id) {
      return {
        success: false,
        error: "All fields are required.",
        errorCode: "MISSING_FIELDS",
      }
    }

    // 2. Get admin client
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return {
        success: false,
        error: "Server configuration error",
        errorCode: "SERVER_ERROR",
      }
    }

    // 3. Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("email", email)
      .single()

    if (existingUser) {
      return {
        success: false,
        error: "User with this email already exists.",
        errorCode: "USER_EXISTS",
      }
    }

    // 4. Create authentication user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    })

    if (authError || !authData.user) {
      return {
        success: false,
        error: authError?.message || "Failed to create authentication user.",
        errorCode: "AUTH_CREATE_FAILED",
      }
    }

    // 5. Create user profile
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert([
        {
          id: authData.user.id,
          email,
          full_name: name,
          org_id,
          account_status: "PENDING",
        },
      ])
      .select()
      .single()

    if (profileError || !userProfile) {
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return {
        success: false,
        error: "Failed to create user profile.",
        errorCode: "PROFILE_CREATE_FAILED",
      }
    }

    // 6. Determine user role based on email
    const ADMIN_EMAILS = new Set([
      "stephensouth1307@gmail.com",
      "anhlong13@gmail.com",
      "anhlong13",
    ])
    const assignedRole = ADMIN_EMAILS.has(String(email).toLowerCase()) ? "ADMIN" : "STUDENT_L1"

    // 7. Create membership record
    const { error: membershipError } = await supabaseAdmin
      .from("memberships")
      .insert([
        {
          user_id: authData.user.id,
          org_id,
          role: assignedRole,
          is_primary: true,
        },
      ])

    if (membershipError) {
      return {
        success: false,
        error: "Failed to create membership.",
        errorCode: "MEMBERSHIP_CREATE_FAILED",
      }
    }

    // 8. Registration successful
    return {
      success: true,
      message: "Registration successful. Please log in with your credentials.",
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.full_name,
        role: assignedRole,
        org_id,
        account_status: userProfile.account_status,
      },
    }
  } catch (error) {
    console.error("Registration error:", error)
    return {
      success: false,
      error: "An unexpected error occurred during registration.",
      errorCode: "UNKNOWN_ERROR",
    }
  }
}

/**
 * Server Action: Logout user
 * Clears the session and removes auth cookies
 */
export async function logoutAction() {
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()

    return {
      success: true,
    }
  } catch (error) {
    console.error("Logout error:", error)
    return {
      success: false,
      error: "Failed to logout.",
    }
  }
}
