import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Loader2, Users, ChevronDown, ChevronUp, FileText, GraduationCap, Briefcase, Calendar, Search, Check, X } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";


// --- INTERFACES CHÍNH XÁC ---
interface TeamInfo { name: string; }
interface ShiftInfo { name: string; start_time: string; end_time: string; }
interface UserRoleData { role: string; }

interface UserDetail {
    id: string; first_name: string | null; last_name: string | null; email: string; avatar_url: string | null;
    annual_leave_balance: number; phone: string | null; date_of_birth: string | null;
    gender: string | null; employment_status: string | null; university: string | null;
    major: string | null; cv_url: string | null; account_status: string | null;
    team_id: string | null; shift_id: string | null;
    team: TeamInfo | null; shift: ShiftInfo | null; user_roles: UserRoleData[] | null;
}
// --- END INTERFACES ---


const UsersManagement = () => {
    const [users, setUsers] = useState<UserDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [selectedUserForRole, setSelectedUserForRole] = useState<UserDetail | null>(null);
    const [selectedNewRole, setSelectedNewRole] = useState<string>('');
    const [isApprovingUser, setIsApprovingUser] = useState<string | null>(null);

    // FILTERS STATE
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterAccountStatus, setFilterAccountStatus] = useState<string>('');

    const { toast } = useToast(); 

    // (Các hàm phụ trợ: getPrimaryRole, getRoleBadgeVariant, getInitials giữ nguyên)
    const getPrimaryRole = (roles: UserRoleData[] | null): string => {
        if (!roles || roles.length === 0) return 'Khách';
        const roleNames = roles.map(r => r.role);
        if (roleNames.includes('admin')) return 'Admin';
        if (roleNames.includes('leader')) return 'Leader';
        return 'Nhân viên';
    };

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case 'Admin': return 'destructive'; 
            case 'Leader': return 'default';    
            case 'Nhân viên': return 'secondary';
            default: return 'outline';
        }
    };

    const getInitials = (firstName?: string | null, lastName?: string | null) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    // --- LOGIC TẢI DỮ LIỆU (FIX TÌM KIẾM & FILTER) ---
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);

            let query = supabase
                .from('profiles')
                .select(`
                    id, email, first_name, last_name, avatar_url, phone, date_of_birth, gender,
                    employment_status, university, major, cv_url, annual_leave_balance, account_status,
                    team_id, shift_id,

                    team:teams!profiles_team_id_fkey (name),
                    shift:shifts!profiles_shift_id_fkey (name, start_time, end_time),
                    user_roles (role)
                `)
                .order('last_name');

            // ÁP DỤNG BỘ LỌC TÌM KIẾM
            if (searchTerm) {
                const searchPattern = `%${searchTerm}%`;
                query = query.or(
                    `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`
                );
            }

            // ÁP DỤNG BỘ LỌC ACCOUNT STATUS
            if (filterAccountStatus) {
                query = query.eq('account_status', filterAccountStatus);
            }

            // ÁP DỤNG BỘ LỌC EMPLOYMENT STATUS
            if (filterStatus) {
                query = query.eq('employment_status', filterStatus);
            }

            const { data, error } = await query;

            if (error) throw error;

            let filteredUsers = (data as unknown as UserDetail[] || []);

            // FILTER BY ROLE (CLIENT SIDE vì join phức tạp)
            if (filterRole) {
                filteredUsers = filteredUsers.filter(user => {
                    if (!user.user_roles) return false;
                    return user.user_roles.some(r => r.role === filterRole);
                });
            }

            setUsers(filteredUsers);

        } catch (error) {
            console.error('Lỗi tải dữ liệu user:', error);
            toast({ title: "Lỗi Tải Dữ liệu", description: "Không thể tải danh sách người dùng.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast, searchTerm, filterRole, filterStatus, filterAccountStatus]); // THÊM searchTerm VÀO DEPENDENCY

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // --- APPROVE USER FUNCTION ---
    const handleApproveUser = async (userId: string, userName: string) => {
        setIsApprovingUser(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ account_status: 'APPROVED' })
                .eq('id', userId);

            if (error) throw error;

            toast({
                title: "Phê duyệt thành công",
                description: `Tài khoản ${userName} đã được phê duyệt.`,
            });

            // Refresh users list
            fetchUsers();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Lỗi phê duyệt",
                description: error instanceof Error ? error.message : "Không thể phê duyệt tài khoản",
            });
        } finally {
            setIsApprovingUser(null);
        }
    };

    // --- REJECT USER FUNCTION ---
    const handleRejectUser = async (userId: string, userName: string) => {
        setIsApprovingUser(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ account_status: 'REJECTED' })
                .eq('id', userId);

            if (error) throw error;

            toast({
                title: "Từ chối thành công",
                description: `Tài khoản ${userName} đã bị từ chối.`,
            });

            // Refresh users list
            fetchUsers();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Lỗi từ chối",
                description: error instanceof Error ? error.message : "Không thể từ chối tài khoản",
            });
        } finally {
            setIsApprovingUser(null);
        }
    };

    // --- UPDATE USER ROLE FUNCTION ---
    const handleUpdateRole = async () => {
        if (!selectedUserForRole || !selectedNewRole) return;

        try {
            // First, delete existing roles
            const { error: deleteError } = await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', selectedUserForRole.id);

            if (deleteError) throw deleteError;

            // Then insert new role
            const { error: insertError } = await supabase
                .from('user_roles')
                .insert({
                    user_id: selectedUserForRole.id,
                    role: selectedNewRole,
                });

            if (insertError) throw insertError;

            toast({
                title: "Cập nhật vai trò thành công",
                description: `${selectedUserForRole.first_name} ${selectedUserForRole.last_name} đã được gán vai trò ${selectedNewRole}.`,
            });

            setIsRoleModalOpen(false);
            setSelectedUserForRole(null);
            setSelectedNewRole('');
            fetchUsers();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Lỗi cập nhật vai trò",
                description: error instanceof Error ? error.message : "Không thể cập nhật vai trò",
            });
        }
    };

    // --- UI RENDER ---

    if (loading) {
        return <div className="p-6 text-center"><Loader2 className="h-6 w-6 inline animate-spin mr-2" /> Đang tải dữ liệu người dùng...</div>;
    }

    const UserTableBody = users.map((user) => {
        const role = getPrimaryRole(user.user_roles);
        const isExpanded = expandedId === user.id;
        const fullName = `${user.last_name || ''} ${user.first_name || ''}`.trim() || user.email;
        const teamFallback = user.team?.name || (user.team_id ? `ID: ${user.team_id.substring(0, 8)}...` : '—');
        const shiftInfoTime = user.shift ? `${user.shift.start_time} - ${user.shift.end_time}` : 'Không áp dụng';


        return (
            <React.Fragment key={user.id}>
                {/* HÀNG CHÍNH (GỌN GÀNG) */}
                <TableRow 
                    className="hover:bg-secondary/20 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : user.id)}
                >
                    <TableCell className="font-semibold text-base flex items-center gap-3">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-primary shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/20">{getInitials(user.first_name, user.last_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium tracking-tight">{fullName}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant={getRoleBadgeVariant(role)}>
                            {role}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant={user.account_status === 'APPROVED' ? 'default' : user.account_status === 'REJECTED' ? 'destructive' : 'secondary'}>
                            {user.account_status === 'APPROVED' ? '✓ Đã duyệt' : user.account_status === 'REJECTED' ? '✗ Từ chối' : '⏳ Chờ duyệt'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium text-sm">
                        {user.employment_status === 'Employed' ? 'Đã đi làm' : user.employment_status === 'Student' ? 'Sinh viên' : '—'}
                    </TableCell>
                    <TableCell>{teamFallback}</TableCell>
                    <TableCell className="font-medium text-base">{user.annual_leave_balance} ngày</TableCell>
                </TableRow>
                
                {/* HÀNG CHI TIẾT MỞ RỘNG (ẨN) */}
                {isExpanded && (
                    <TableRow className="bg-secondary/30 hover:bg-secondary/40 transition-colors">
                        <TableCell colSpan={6} className="py-4 px-6">
                            <div className="space-y-6">
                                {/* PHẦN 1: THÔNG TIN CHÍNH */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8 text-sm">

                                    {/* CỘT 1: HỌC VẤN */}
                                    <div className="space-y-1">
                                        <h4 className="font-bold flex items-center gap-1 text-primary"><GraduationCap className="w-4 h-4" /> Học vấn</h4>
                                        <p><span className="font-medium">Trường:</span> {user.university || '—'}</p>
                                        <p><span className="font-medium">Chuyên ngành:</span> {user.major || '—'}</p>
                                    </div>

                                    {/* CỘT 2: THÔNG TIN CÁ NHÂN MỞ RỘNG */}
                                    <div className="space-y-1">
                                        <h4 className="font-bold flex items-center gap-1 text-primary"><Calendar className="w-4 h-4" /> Cá nhân</h4>
                                        <p><span className="font-medium">SĐT:</span> {user.phone || '—'}</p>
                                        <p><span className="font-medium">Ngày sinh:</span> {user.date_of_birth ? format(new Date(user.date_of_birth), 'dd/MM/yyyy') : '—'}</p>
                                        <p><span className="font-medium">Giới tính:</span> {user.gender || '—'}</p>
                                    </div>

                                    {/* CỘT 3: VẬN HÀNH & CA LÀM VIỆC */}
                                    <div className="space-y-2 md:col-span-2">
                                        <h4 className="font-bold flex items-center gap-1 text-primary"><Briefcase className="w-4 h-4" /> Vận hành & Tài liệu</h4>
                                        <p className="text-sm"><span className="font-medium">Ca làm:</span> {user.shift?.name || '—'}</p>
                                        <p className="text-xs text-muted-foreground">Thời gian: ({shiftInfoTime})</p>

                                        {user.cv_url ? (
                                            <a href={user.cv_url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="secondary" size="sm" className="bg-green-600 hover:bg-green-700 text-white mt-2">
                                                    <FileText className="h-4 w-4 mr-2" /> Xem CV
                                                </Button>
                                            </a>
                                        ) : (
                                            <p className="text-sm text-red-500 mt-2">Chưa có CV được tải lên.</p>
                                        )}
                                    </div>
                                </div>

                                {/* PHẦN 2: HÀNH ĐỘNG QUẢN LÝ */}
                                <div className="border-t pt-4 space-y-3">
                                    <h4 className="font-bold text-primary">Quản lý Tài khoản</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {user.account_status === 'PENDING' && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="bg-green-600 hover:bg-green-700"
                                                    disabled={isApprovingUser === user.id}
                                                    onClick={() => handleApproveUser(user.id, `${user.first_name} ${user.last_name}`)}
                                                >
                                                    {isApprovingUser === user.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                                    Phê duyệt
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={isApprovingUser === user.id}
                                                    onClick={() => handleRejectUser(user.id, `${user.first_name} ${user.last_name}`)}
                                                >
                                                    {isApprovingUser === user.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                                                    Từ chối
                                                </Button>
                                            </>
                                        )}

                                        <Dialog open={isRoleModalOpen && selectedUserForRole?.id === user.id} onOpenChange={(open) => {
                                            if (!open) {
                                                setIsRoleModalOpen(false);
                                                setSelectedUserForRole(null);
                                                setSelectedNewRole('');
                                            }
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedUserForRole(user);
                                                        setSelectedNewRole(user.user_roles?.[0]?.role || '');
                                                        setIsRoleModalOpen(true);
                                                    }}
                                                >
                                                    Gán vai trò
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Gán vai trò cho {user.first_name} {user.last_name}</DialogTitle>
                                                    <DialogDescription>Chọn vai trò mới cho người dùng</DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    <Label htmlFor="role-select">Vai trò</Label>
                                                    <Select value={selectedNewRole} onValueChange={setSelectedNewRole}>
                                                        <SelectTrigger id="role-select">
                                                            <SelectValue placeholder="Chọn vai trò" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="hr">HR</SelectItem>
                                                            <SelectItem value="leader">Leader</SelectItem>
                                                            <SelectItem value="teacher">Teacher</SelectItem>
                                                            <SelectItem value="it">IT</SelectItem>
                                                            <SelectItem value="content">Content</SelectItem>
                                                            <SelectItem value="design">Design</SelectItem>
                                                            <SelectItem value="staff">Staff</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button className="w-full" onClick={handleUpdateRole}>
                                                        Cập nhật vai trò
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
            </React.Fragment>
        );
    });


    return (
        <div className="space-y-6 p-4">
            <h1 className="text-4xl font-extrabold tracking-tight uppercase flex items-center gap-3 text-primary">
        <Users className="h-8 w-8 text-primary" /> QUẢN LÝ NGƯỜI DÙNG
    </h1>

            <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
                <CardHeader className="border-b pb-4 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <CardTitle className="text-xl font-semibold">Danh sách Toàn bộ Nhân viên ({users.length})</CardTitle>
                            <CardDescription>Nhấn vào hàng để xem chi tiết thông tin mở rộng.</CardDescription>
                        </div>

                        {/* INPUT TÌM KIẾM MỚI */}
                        <div className="relative w-full max-w-sm md:w-auto">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Tìm kiếm theo Tên hoặc Email..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* BỘ LỌC NÂNG CAO */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="filter-account-status" className="text-sm font-medium">Trạng thái Tài khoản</Label>
                            <Select value={filterAccountStatus} onValueChange={setFilterAccountStatus}>
                                <SelectTrigger id="filter-account-status" className="h-9">
                                    <SelectValue placeholder="Tất cả" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Tất cả</SelectItem>
                                    <SelectItem value="PENDING">Chờ duyệt</SelectItem>
                                    <SelectItem value="APPROVED">Đã duyệt</SelectItem>
                                    <SelectItem value="REJECTED">Từ chối</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="filter-role" className="text-sm font-medium">Vai trò</Label>
                            <Select value={filterRole} onValueChange={setFilterRole}>
                                <SelectTrigger id="filter-role" className="h-9">
                                    <SelectValue placeholder="Tất cả" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Tất cả</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="hr">HR</SelectItem>
                                    <SelectItem value="leader">Leader</SelectItem>
                                    <SelectItem value="teacher">Teacher</SelectItem>
                                    <SelectItem value="it">IT</SelectItem>
                                    <SelectItem value="content">Content</SelectItem>
                                    <SelectItem value="design">Design</SelectItem>
                                    <SelectItem value="staff">Staff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="filter-status" className="text-sm font-medium">Tình trạng Công việc</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger id="filter-status" className="h-9">
                                    <SelectValue placeholder="Tất cả" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Tất cả</SelectItem>
                                    <SelectItem value="Employed">Đã đi làm</SelectItem>
                                    <SelectItem value="Student">Sinh viên</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium opacity-0">Reset</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-9"
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterRole('');
                                    setFilterStatus('');
                                    setFilterAccountStatus('');
                                }}
                            >
                                Đặt lại bộ lọc
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[250px] text-primary">Họ Tên & Email</TableHead>
                                    <TableHead className="w-[120px]">Vai trò</TableHead>
                                    <TableHead className="w-[140px]">Trạng thái TK</TableHead>
                                    <TableHead className="w-[150px]">Tình trạng</TableHead>
                                    <TableHead className="w-[150px]">Đội nhóm</TableHead>
                                    <TableHead className="w-[150px]">Nghỉ phép (Ngày)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                            {searchTerm ? `Không tìm thấy kết quả nào cho "${searchTerm}"` : 'Chưa có người dùng nào được tạo.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    UserTableBody
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            
            {/* Nút Thêm User */}
            <div className="flex justify-start">
                <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90">
                            <Plus className="h-4 w-4 mr-2" />
                            Thêm Người dùng
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Thêm Người dùng Mới</DialogTitle>
                            <DialogDescription>Chức năng này sẽ yêu cầu người dùng đăng ký hoặc cần Service Role để tạo tài khoản trực tiếp.</DialogDescription>
                        </DialogHeader>
                        {/* Form Thêm Người dùng sẽ được đặt ở đây */}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default UsersManagement;
