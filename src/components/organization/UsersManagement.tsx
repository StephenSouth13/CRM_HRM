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
    
    // THÊM STATE TÌM KIẾM
    const [searchTerm, setSearchTerm] = useState('');

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

    // --- LOGIC TẢI DỮ LIỆU (FIX TÌM KIẾM) ---
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            
            let query = supabase
                .from('profiles')
                .select(`
                    id, email, first_name, last_name, avatar_url, phone, date_of_birth, gender, 
                    employment_status, university, major, cv_url, annual_leave_balance,
                    team_id, shift_id,
                    
                    team:teams!profiles_team_id_fkey (name),
                    shift:shifts!profiles_shift_id_fkey (name, start_time, end_time),
                    user_roles (role)
                `)
                .order('last_name');

            // ÁP DỤNG BỘ LỌC TÌM KIẾM
            if (searchTerm) {
                const searchPattern = `%${searchTerm}%`;
                // Tìm kiếm theo Họ HOẶC Tên (sử dụng .or() và .ilike() cho không phân biệt chữ hoa/thường)
                query = query.or(
                    `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`
                );
            }

            const { data, error } = await query;

            if (error) throw error;
            
            setUsers(data as unknown as UserDetail[] || []); 
            
        } catch (error) {
            console.error('Lỗi tải dữ liệu user:', error);
            toast({ title: "Lỗi Tải Dữ liệu", description: "Không thể tải danh sách người dùng.", variant: "destructive" }); 
        } finally {
            setLoading(false);
        }
    }, [toast, searchTerm]); // THÊM searchTerm VÀO DEPENDENCY

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);


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
                    <TableCell className="text-muted-foreground font-medium text-sm">
                        {user.employment_status === 'Employed' ? 'Đã đi làm' : user.employment_status === 'Student' ? 'Sinh viên' : '—'}
                    </TableCell>
                    <TableCell>{teamFallback}</TableCell>
                    <TableCell className="font-medium text-base">{user.annual_leave_balance} ngày</TableCell>
                </TableRow>
                
                {/* HÀNG CHI TIẾT MỞ RỘNG (ẨN) */}
                {isExpanded && (
                    <TableRow className="bg-secondary/30 hover:bg-secondary/40 transition-colors">
                        <TableCell colSpan={5} className="py-4 px-6">
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
                <CardHeader className="border-b pb-4">
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
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[250px] text-primary">Họ Tên & Email</TableHead>
                                    <TableHead className="w-[120px]">Vai trò</TableHead>
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
