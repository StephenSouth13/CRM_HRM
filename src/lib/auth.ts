import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type UserRole = 'admin' | 'leader' | 'staff';

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

export const signUp = async (email: string, password: string, metadata?: { first_name?: string; last_name?: string }) => {
  const redirectUrl = `${window.location.origin}/`;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: metadata
    }
  });
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
  const { data, error } = await supabase
    .from('user_registrations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return { data, error };
};

export const approveRegistration = async (registrationId: string, role: string) => {
  const { data, error } = await supabase
    .from('user_registrations')
    .update({ status: 'approved', assigned_role: role, approved_at: new Date().toISOString() })
    .eq('id', registrationId);

  return { data, error };
};

export const rejectRegistration = async (registrationId: string, reason: string) => {
  const { data, error } = await supabase
    .from('user_registrations')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', registrationId);

  return { data, error };
};
