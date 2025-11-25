import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type UserRole = 'admin' | 'hr' | 'leader' | 'staff' | 'teacher' | 'it' | 'content' | 'design';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  team_id: string | null;
  shift_id: string | null;
  phone: string | null;
  date_of_birth: string | null;
  annual_leave_balance: number;
  account_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  created_at?: string;
}

export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getCurrentSession = async (): Promise<Session | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const getUserRole = async (userId: string): Promise<UserRole> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) return 'staff';
  return data.role as UserRole;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signUp = async (email: string, password: string, metadata?: any) => {
  const redirectUrl = `${window.location.origin}/`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: metadata
    }
  });

  // Create profile record if signup successful
  if (!error && data.user) {
    try {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: email,
        first_name: metadata?.first_name || null,
        last_name: metadata?.last_name || null,
        phone: metadata?.phone || null,
        employment_status: metadata?.employment_status || null,
        date_of_birth: null,
        gender: null,
        university: null,
        major: null,
        degree: null,
        avatar_url: null,
        cv_url: null,
        team_id: null,
        shift_id: null,
        annual_leave_balance: 0,
        account_status: 'PENDING',
      });
    } catch (profileError) {
      console.error('Error creating profile:', profileError);
      // Don't return error as user was created successfully
    }
  }

  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const resetPasswordRequest = async (email: string) => {
  const redirectUrl = `${window.location.origin}/auth/reset-password`;

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });
  return { data, error };
};

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  return { data, error };
};

export const verifyOtp = async (email: string, token: string, type: 'recovery' | 'email_change' | 'phone_change' = 'recovery') => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type
  });
  return { data, error };
};

export const getPendingRegistrations = async () => {
  // user_registrations table doesn't exist, return empty
  return { data: [], error: null };
};

export const approveRegistration = async (registrationId: string, role: string) => {
  // user_registrations table doesn't exist
  return { data: null, error: new Error('User registrations table not available') };
};

export const rejectRegistration = async (registrationId: string, reason: string) => {
  // user_registrations table doesn't exist
  return { data: null, error: new Error('User registrations table not available') };
};

export const getRegistrationStatus = async (userId: string) => {
  // user_registrations table doesn't exist, assume user is approved
  return { data: { status: 'approved', rejection_reason: null, reapplication_count: 0 }, error: null };
};

export const createUserRegistration = async (registrationData: any) => {
  // user_registrations table doesn't exist, skip registration
  return { data: null, error: null };
};
