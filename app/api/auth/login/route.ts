// File: app/api/auth/login/route.ts (Logic đăng nhập và kiểm tra phê duyệt)

import { NextRequest, NextResponse } from "next/server";
// Import hai hàm client đã được FIX lỗi
import { createSupabaseServerClient } from "@/lib/supabase/server"; 
import { getSupabaseAdmin } from "@/lib/supabase/supabase"; 

export async function POST(request: NextRequest) {
  let body: any;

  // 1. Khởi tạo Admin Client (để fetch profile bỏ qua RLS)
  const supabaseAdmin = getSupabaseAdmin(); 
  
  try {
    // 2. Cố gắng đọc JSON body (bọc try/catch để bắt lỗi SyntaxError)
    body = await request.json();
  } catch (error) {
    console.error('Lỗi đọc JSON trong API Login:', error);
    return NextResponse.json(
      { error: "Invalid request body format (must be JSON)." },
      { status: 400 },
    );
  }

  // 3. KIỂM TRA INPUT BẮT BUỘC
  const { email, password } = body;
  if (!email || !password || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Missing required fields or server configuration error." },
      { status: 400 },
    );
  }

  // 4. XÁC THỰC BẰNG SUPABASE AUTH (Dùng client quản lý cookies)
  const supabase = await createSupabaseServerClient(); 
  
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError || !authData.user) {
    // Session Auth không thành công
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // 5. LẤY PROFILE VÀ ROLE KEY (Dùng Client Admin để BỎ QUA RLS)
  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select(
      `*, memberships (*, roles (role_key, role_name))`,
    )
    .eq("id", authData.user.id)
    .single();

  if (profileError || !userProfile) {
    await supabase.auth.signOut(); // Đăng xuất để session lỗi không tồn tại
    return NextResponse.json(
      { error: "User profile or membership data not found." },
      { status: 404 },
    );
  }

  // 6. KIỂM TRA TRẠNG THÁI PHÊ DUYỆT BẮT BUỘC
  const primaryMembership: any = userProfile.memberships?.[0] || {}; 
  const roleKey = primaryMembership?.roles?.role_key || "pending_approval";
  const accountStatus = userProfile.account_status;

  if (accountStatus !== "APPROVED") {
    await supabase.auth.signOut(); // CRITICAL: Đăng xuất để ngăn truy cập
    
    return NextResponse.json(
      { 
        error: "Your account is not approved yet. Please wait for administrator approval.",
        status: accountStatus 
      },
      { status: 403 } // Forbidden
    );
  }

  // 7. TRẢ VỀ DỮ LIỆU USER HOÀN CHỈNH (Thành công)
  return NextResponse.json({
    user: {
      id: userProfile.id,
      email: userProfile.email,
      name: userProfile.full_name, 
      role_key: roleKey, 
      org_id: primaryMembership.org_id || null, 
      account_status: accountStatus,
      is_authenticated: true
    },
    session: authData.session,
  });
}
