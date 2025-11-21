import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { getUserProfile } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveHistory from "./LeaveHistory";
import { UserRole } from "@/lib/auth";

interface LeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
}

const LeaveModal = ({ open, onOpenChange, role }: LeaveModalProps) => {
  const [leaveBalance, setLeaveBalance] = useState(0);

  useEffect(() => {
    const loadUserData = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      
      const profile = await getUserProfile(user.id);
      if (profile) {
        setLeaveBalance(profile.annual_leave_balance);
      }
    };
    
    if (open) {
      loadUserData();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quản Lý Nghỉ Phép</DialogTitle>
          <DialogDescription>
            Gửi yêu cầu nghỉ phép và theo dõi lịch sử nghỉ của bạn
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Leave Balance Card */}
          <Card className="bg-gradient-primary overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary-foreground">
                <Calendar className="h-4 w-4" />
                Số Ngày Nghỉ Còn Lại
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary-foreground">{leaveBalance} ngày</div>
              <p className="text-xs text-primary-foreground/80 mt-1">Có thể sử dụng</p>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="request" className="w-full">
            <TabsList className="bg-secondary shadow-soft w-full">
              <TabsTrigger
                value="request"
                className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Yêu Cầu Nghỉ Mới
              </TabsTrigger>

              <TabsTrigger
                value="history"
                className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Lịch Sử Nghỉ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="mt-6">
              <LeaveRequestForm />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <LeaveHistory role={role} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveModal;
