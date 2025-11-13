import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const cookieStore = cookies()
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        cookie: cookieStore
          .getAll()
          .map(({ name, value }) => `${name}=${value}`)
          .join(";"),
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          {/* Sidebar content */}
        </Sidebar>
        <SidebarInset>{children}</SidebarInset>
      </div>
    </SidebarProvider>
  )
}
