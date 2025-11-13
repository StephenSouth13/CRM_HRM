// File: D:\CRM\CRM_LifeOS\app\page.tsx (Thay thế bằng code này)
// KHÔNG CÓ "use client" - Đây là Server Component

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from '@/lib/supabase/server'; // Import từ file vừa tạo

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. Nếu đã đăng nhập, chuyển thẳng đến /dashboard
  if (user) {
    redirect("/dashboard");
  }

  // 2. Nếu chưa đăng nhập, chuyển thẳng đến /auth/login
  // Việc này an toàn vì nó là redirect Server-Side
  redirect("/auth/login");
  
  // Lưu ý: Không cần trả về JSX vì hàm redirect() sẽ được gọi
}
