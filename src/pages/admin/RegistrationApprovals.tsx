import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getUserRole, getCurrentUser, approveRegistration, rejectRegistration } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, User, Mail, Phone, Briefcase, Building2, AlertCircle } from "lucide-react";

interface RegistrationRequest {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  requested_role: string;
  department: string;
  status: "pending" | "approved" | "rejected";
  admin_approved_at?: string;
  hr_approved_at?: string;
  admin_approved_by?: string;
  hr_approved_by?: string;
  created_at: string;
  rejection_reason?: string;
}

const ROLES = {
  staff: "Nhân Viên",
  it: "IT",
  hr: "HR",
  design: "Design",
  content: "Content",
  leader: "Leader",
  admin: "Admin",
};

const DEPARTMENTS = {
  IT: "Công Nghệ Thông Tin",
  HR: "Nhân Sự",
  Sales: "Bán Hàng",
  Marketing: "Marketing",
  Design: "Thiết Kế",
  Content: "Nội Dung",
  Finance: "Tài Chính",
};

const RegistrationApprovals = () => {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationRequest | null>(null);
  const [approvalRole, setApprovalRole] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    const checkAccess = async () => {
      const user = await getCurrentUser();
      if (!user) {
        window.location.href = "/auth/login";
        return;
      }

      const role = await getUserRole(user.id);
      setUserRole(role);

      if (role !== "admin" && role !== "leader" && role !== "hr") {
        toast({
          variant: "destructive",
          title: "Không Được Phép",
          description: "Bạn không có quyền truy cập trang này"
        });
        window.location.href = "/dashboard";
        return;
      }

      loadRegistrations();
    };

    checkAccess();
  }, []);

  useEffect(() => {
    filterRegistrations();
  }, [registrations, filter, searchTerm]);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRegistrations((data as any[]) || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message
      });
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  };

  const filterRegistrations = () => {
    let filtered = registrations;

    // Filter by status
    if (filter !== "all") {
      if (filter === "pending") {
        // Show pending and partially approved
        filtered = filtered.filter(r => 
          r.status === "pending" || 
          (r.admin_approved_at && !r.hr_approved_at) ||
          (!r.admin_approved_at && r.hr_approved_at)
        );
      } else {
        filtered = filtered.filter(r => r.status === filter);
      }
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRegistrations(filtered);
  };

  const handleApprove = async () => {
    if (!selectedRegistration || !approvalRole) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng chọn vai trò"
      });
      return;
    }

    try {
      const approvalType = userRole === 'hr' ? 'hr' : 'admin';
      const { error } = await approveRegistration(selectedRegistration.id, approvalRole, approvalType);
      
      if (error) throw error;

      toast({
        title: "Phê Duyệt Thành Công",
        description: `Bạn đã phê duyệt tài khoản ${selectedRegistration.email} với vai trò ${ROLES[approvalRole as keyof typeof ROLES]}`
      });

      setShowApproveDialog(false);
      setApprovalRole("");
      setSelectedRegistration(null);
      loadRegistrations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "L��i",
        description: error.message
      });
    }
  };

  const handleReject = async () => {
    if (!selectedRegistration) return;

    try {
      const { error } = await rejectRegistration(selectedRegistration.id, rejectionReason);
      if (error) throw error;

      toast({
        title: "Từ Chối Thành Công",
        description: `Đã từ chối tài khoản ${selectedRegistration.email}`
      });

      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedRegistration(null);
      loadRegistrations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message
      });
    }
  };

  const getApprovalStatus = (reg: RegistrationRequest) => {
    const adminApproved = reg.admin_approved_at !== null && reg.admin_approved_at !== undefined;
    const hrApproved = reg.hr_approved_at !== null && reg.hr_approved_at !== undefined;

    return { adminApproved, hrApproved, fullyApproved: adminApproved && hrApproved };
  };

  const getStatusBadge = (reg: RegistrationRequest) => {
    const { adminApproved, hrApproved, fullyApproved } = getApprovalStatus(reg);

    if (reg.status === "rejected") {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm">
          <XCircle className="h-4 w-4" />
          Từ Chối
        </div>
      );
    }

    if (fullyApproved) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Đã Phê Duyệt
        </div>
      );
    }

    if (adminApproved || hrApproved) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">
          <Clock className="h-4 w-4" />
          Phê Duyệt Một Phần
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-sm">
        <Clock className="h-4 w-4" />
        Chờ Duyệt
      </div>
    );
  };

  const stats = {
    pending: registrations.filter(r => {
      const { adminApproved, hrApproved } = getApprovalStatus(r);
      return r.status === "pending" || (!adminApproved || !hrApproved);
    }).length,
    approved: registrations.filter(r => r.status === "approved").length,
    rejected: registrations.filter(r => r.status === "rejected").length,
  };

  const canApprove = (reg: RegistrationRequest) => {
    const { adminApproved, hrApproved } = getApprovalStatus(reg);

    if (userRole === 'admin' && adminApproved && hrApproved) return false;
    if (userRole === 'hr' && adminApproved && hrApproved) return false;
    if (userRole === 'admin') return !adminApproved;
    if (userRole === 'hr') return !hrApproved;

    return true;
  };

  return (
    <DashboardLayout role={userRole as any}>
      <div className="space-y-6 animate-fade-in pb-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Phê Duyệt Đăng Ký</h1>
          <p className="text-muted-foreground mt-2">
            {userRole === 'hr' 
              ? 'Phê duyệt các yêu cầu đăng ký tài khoản mới (Vai trò: HR)' 
              : 'Quản lý và phê duyệt các yêu cầu đăng ký tài khoản mới (Cần phê duyệt từ Admin và HR)'}
          </p>
        </div>

        {/* Info Alert for Dual Approval */}
        {userRole === 'admin' && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Quy Trình Phê Duyệt Hai Cấp</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Người dùng mới cần phê duyệt từ cả Admin (bạn) và HR trước khi có thể truy cập hệ thống.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chờ Duyệt</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Yêu cầu đang chờ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Đã Duyệt</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">Tài khoản hoạt động</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Từ Chối</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">Yêu cầu bị từ chối</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Tìm Kiếm & Lọc</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="search">Tìm Kiếm (Email hoặc Tên)</Label>
                <Input
                  id="search"
                  placeholder="Nhập email hoặc tên"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status-filter">Lọc Theo Trạng Thái</Label>
                <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất Cả</SelectItem>
                    <SelectItem value="pending">Chờ Duyệt</SelectItem>
                    <SelectItem value="approved">Đã Duyệt</SelectItem>
                    <SelectItem value="rejected">Từ Chối</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registrations List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="pt-8">
                <p className="text-center text-muted-foreground">Đang tải dữ liệu...</p>
              </CardContent>
            </Card>
          ) : filteredRegistrations.length === 0 ? (
            <Card>
              <CardContent className="pt-8">
                <p className="text-center text-muted-foreground">Không tìm thấy yêu cầu nào</p>
              </CardContent>
            </Card>
          ) : (
            filteredRegistrations.map((reg) => {
              const { adminApproved, hrApproved } = getApprovalStatus(reg);
              
              return (
                <Card key={reg.id} className="overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">
                            {reg.first_name} {reg.last_name}
                          </h3>
                          {getStatusBadge(reg)}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {reg.email}
                          </div>
                          {reg.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              {reg.phone}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Briefcase className="h-4 w-4" />
                            {ROLES[reg.requested_role as keyof typeof ROLES] || reg.requested_role}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            {DEPARTMENTS[reg.department as keyof typeof DEPARTMENTS] || reg.department}
                          </div>
                        </div>

                        {/* Approval Status Section */}
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Trạng Thái Phê Duyệt:</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                              {adminApproved ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-yellow-600" />
                              )}
                              <span className="text-sm">
                                Admin: {adminApproved ? 'Đã phê duyệt' : 'Chờ phê duyệt'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {hrApproved ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-yellow-600" />
                              )}
                              <span className="text-sm">
                                HR: {hrApproved ? 'Đã phê duyệt' : 'Chờ phê duyệt'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {reg.rejection_reason && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-700 dark:text-red-300">
                              <strong>Lý Do Từ Chối:</strong> {reg.rejection_reason}
                            </p>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          Yêu cầu ngày: {new Date(reg.created_at).toLocaleDateString("vi-VN")}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {canApprove(reg) && (
                        <div className="flex flex-col gap-2 md:flex-row">
                          <Button
                            onClick={() => {
                              setSelectedRegistration(reg);
                              setShowApproveDialog(true);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Phê Duyệt
                          </Button>
                          {userRole === 'admin' && !adminApproved && (
                            <Button
                              onClick={() => {
                                setSelectedRegistration(reg);
                                setShowRejectDialog(true);
                              }}
                              variant="destructive"
                            >
                              Từ Chối
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Phê Duyệt Đăng Ký</AlertDialogTitle>
            <AlertDialogDescription>
              Phê duyệt tài khoản cho {selectedRegistration?.first_name} {selectedRegistration?.last_name}
              {userRole === 'hr' ? ' (Từ phía HR)' : ' (Từ phía Admin)'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {userRole === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="role-select">Chọn Vai Trò</Label>
                <Select value={approvalRole} onValueChange={setApprovalRole}>
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {userRole === 'hr' && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Bạn sẽ phê duyệt yêu cầu này từ phía HR. Sau khi phê duyệt từ Admin và HR, người dùng sẽ có thể truy cập hệ thống.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-end">
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700"
              disabled={userRole === 'admin' && !approvalRole}
            >
              Phê Duyệt
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Từ Chối Đăng Ký</AlertDialogTitle>
            <AlertDialogDescription>
              Từ chối yêu cầu đăng ký cho {selectedRegistration?.first_name} {selectedRegistration?.last_name}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Lý Do (Tùy Chọn)</Label>
              <Input
                id="reason"
                placeholder="Nhập lý do từ chối..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
            >
              Từ Chối
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default RegistrationApprovals;
