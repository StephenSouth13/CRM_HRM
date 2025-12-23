import { supabase } from "@/integrations/supabase/client";

// 1. Định nghĩa Role chuẩn hóa
export type UserRole = 'admin' | 'hr' | 'leader' | 'staff' | 'member' | 'guest';

// --- XÁC THỰC CƠ BẢN ---
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password, metadata) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export const resetPasswordRequest = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return data;
};

// --- QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN ---
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/**
 * ✅ FIX LỖI 2339: Truy vấn role từ bảng user_roles thay vì profiles
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  const { data, error } = await supabase
    .from('user_roles') // Sửa từ 'profiles' thành 'user_roles'
    .select('role')     // Lấy cột role từ bảng user_roles
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return 'guest';
  return data.role as UserRole;
}

// ✅ Hàm phê duyệt đồng bộ trạng thái và vai trò
export async function approveRegistration(userId: string, role: UserRole = 'staff') {
  const { data, error } = await supabase.rpc('approve_user_and_assign_role', {
    p_user_id: userId,
    p_new_role: role
  });

  if (error) throw error;
  return data;
}

export async function rejectRegistration(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ account_status: 'REJECTED' })
    .eq('id', userId);

  if (error) throw error;
  return data;
}

// --- HÀM BỔ TRỢ QUẢN LÝ TEAM & CHẤM CÔNG ---
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return error ? null : data;
}

export async function getUserTeam(userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', userId)
    .single();

  if (!profile?.team_id) {
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .or(`leader_id.eq.${userId},leader_2_id.eq.${userId}`)
      .maybeSingle();
    return team;
  }

  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', profile.team_id)
    .single();
  return team;
}