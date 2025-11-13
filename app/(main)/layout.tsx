// File: app/(main)/layout.tsx (Đã sửa lỗi import và tích hợp Sidebar)

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server'; 

// Sửa Import: Import các component từ file sidebar.tsx bạn vừa tạo
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar'; 
// Lưu ý: Đảm bảo đường dẫn import chính xác với cấu trúc thư mục của bạn
// Nếu file là components/ui/sidebar.tsx, thì import là '@/components/ui/sidebar'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // LƯU Ý: Đây là Server Component (Không dùng use client)
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Nếu user chưa đăng nhập, Server redirect sang /auth/login
    redirect('/auth/login'); 
  }

  // Nếu user đã đăng nhập, hiển thị giao diện CRM
  return (
    // Bọc toàn bộ ứng dụng bằng SidebarProvider
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Component Sidebar chính (Nơi chứa Menu) */}
        <Sidebar>
          {/* Đặt nội dung Menu, Header, Footer của Sidebar ở đây */}
          {/* Ví dụ: <SidebarHeader>...</SidebarHeader> */}
        </Sidebar>

        {/* SidebarInset là component wrap nội dung chính (main content) */}
        <SidebarInset>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
