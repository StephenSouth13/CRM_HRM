import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getUserRole, getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyPayslips from "@/components/payroll/MyPayslips";
import TeamPayslips from "@/components/payroll/TeamPayslips";
import PayrollManagement from "@/components/payroll/PayrollManagement";
import { useToast } from "@/hooks/use-toast";

const Payroll = () => {
  const [role, setRole] = useState<UserRole>('staff');
  const [loading, setLoading] = useState(true);
  const [defaultTab, setDefaultTab] = useState("my-payslips");
  const { toast } = useToast();

  useEffect(() => {
    const loadRole = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          toast({
            title: "Lỗi",
            description: "Không thể xác định người dùng.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const userRole = await getUserRole(user.id);
        setRole(userRole);

        // Set default tab based on role
        if (userRole === 'admin' || userRole === 'hr') {
          setDefaultTab("payroll-management");
        } else if (userRole === 'leader') {
          setDefaultTab("my-payslips");
        }
      } catch (error) {
        toast({
          title: "Lỗi Tải Dữ liệu",
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadRole();
  }, [toast]);

  if (loading) {
    return (
      <DashboardLayout role={role}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-4 md:space-y-6 animate-fade-in pb-20 md:pb-6">
        <div className="mb-2">
          <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent text-2xl md:text-3xl lg:text-4xl">
            Quản Lý Lương Thưởng
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Xem và quản lý phiếu lương, phụ cấp, thưởng và lợi ích khác
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 gap-1">
            <TabsTrigger value="my-payslips" className="data-[state=active]:bg-primary text-xs md:text-sm">
              Phiếu Lương Của Tôi
            </TabsTrigger>

            {(role === 'leader') && (
              <TabsTrigger value="team-payslips" className="data-[state=active]:bg-primary text-xs md:text-sm">
                Phiếu Lương Đội
              </TabsTrigger>
            )}

            {(role === 'admin' || role === 'hr') && (
              <TabsTrigger value="payroll-management" className="data-[state=active]:bg-primary text-xs md:text-sm">
                Quản Lý Lương
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-payslips" className="mt-6">
            <MyPayslips />
          </TabsContent>

          {(role === 'leader') && (
            <TabsContent value="team-payslips" className="mt-6">
              <TeamPayslips />
            </TabsContent>
          )}

          {(role === 'admin' || role === 'hr') && (
            <TabsContent value="payroll-management" className="mt-6">
              <PayrollManagement />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Payroll;
