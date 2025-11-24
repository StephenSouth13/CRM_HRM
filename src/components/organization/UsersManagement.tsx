import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Loader2, Users, ChevronDown, ChevronUp, FileText, GraduationCap, Briefcase, Calendar, Search, Check, X, Edit, Save } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast"; 
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; 
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";


// --- INTERFACES CHÍNH XÁC ---
interface Team { id: string; name: string; }
interface Shift { id: string; name: string; start_time: string; end_time: string; }
interface UserRoleData { role: string; }

interface UserDetail {
    id: string; first_name: string | null; last_name: string | null; email: string; avatar_url: string | null;
    annual_leave_balance: number; phone: string | null; date_of_birth: string | null;
    gender: string | null; employment_status: string | null; university: string | null;
    major: string | null; cv_url: string | null; account_status: string | null;
    team_id: string | null; shift_id: string | null;
    
    // Dữ liệu đã hợp nhất (để Typescript chấp nhận)
    team: Team | null; 
    shift: Shift | null; 
    user_roles: UserRoleData[] | null; 
}
// --- END INTERFACES ---


const UsersManagement = () => {
    const [users, setUsers] = useState<UserDetail[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]); 
    const [allShifts, setAllShifts] = useState<Shift[]>([]); 

    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [selectedUserForRole, setSelectedUserForRole] = useState<UserDetail | null>(null); 
    const [selectedNewRole, setSelectedNewRole] = useState<string>('');
    const [selectedTeam, setSelectedTeam] = useState<string>(''); 
    const [selectedShift, setSelectedShift] = useState<string>(''); 

    const [isApprovingUser, setIsApprovingUser] = useState<string | null>(null);

    // CREATE/EDIT USER STATE
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserDetail | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserDetail | null>(null);

    // Form state for create/edit
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        team_id: '',
        shift_id: '',
        employment_status: '',
    });

    // FILTERS STATE
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterAccountStatus, setFilterAccountStatus] = useState<string>('all');

    const { toast } = useToast(); 

    // (Các hàm phụ trợ)
    const getPrimaryRole = (roles: UserRoleData[] | null): string => {
        if (!roles || roles.length === 0) return 'Khách';
        // Sử dụng any cho map để vượt qua lỗi Typescript nếu r.role là kiểu string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const roleNames = roles.map((r: any) => r.role); 
        if (roleNames.includes('admin')) return 'Admin';
        if (roleNames.includes('hr')) return 'HR';
        if (roleNames.includes('leader')) return 'Leader';
        return 'Nhân viên';
    };

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case 'Admin': case 'HR': return 'destructive'; 
            case 'Leader': return 'default';    
            case 'Nhân viên': return 'secondary';
            default: return 'outline';
        }
    };

    const getInitials = (firstName?: string | null, lastName?: string | null) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    // --- LOGIC TẢI DỮ LIỆU ĐẦY ĐỦ (FIX LỖI 400) ---
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            
            // 1. LẤY DỮ LIỆU CƠ BẢN (Không JOIN phức tạp)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select(`*`)
                .order('last_name');

            // 2. LẤY DỮ LIỆU LIÊN QUAN (JOIN Client-Side)
            const [rolesRes, teamsRes, shiftsRes] = await Promise.all([
                supabase.from('user_roles').select('user_id, role'),
                supabase.from('teams').select('id, name'),
                supabase.from('shifts').select('id, name, start_time, end_time'),
            ]);
            
            if (profileError) throw profileError;

            // XỬ LÝ VÀ HỢP NHẤT VÀO MAPS
            const teamsMap = new Map();
            teamsRes?.data?.forEach((t) => teamsMap.set(t.id, t));
            setAllTeams(teamsRes?.data as Team[] || []);

            const shiftsMap = new Map();
            shiftsRes?.data?.forEach((s) => shiftsMap.set(s.id, s));
            setAllShifts(shiftsRes?.data as Shift[] || []);

            const rolesMap = new Map();
            rolesRes?.data?.forEach((r) => rolesMap.set(r.user_id, r.role));
            
            // 3. Hợp nhất dữ liệu vào Users
            const finalUsers = (profileData as any[] || []).map(p => ({
                ...p,
                user_roles: rolesMap.get(p.id) ? [{ role: rolesMap.get(p.id) }] : null,
                team: teamsMap.get(p.team_id) || null,
                shift: shiftsMap.get(p.shift_id) || null, 
            })) as UserDetail[];

            setUsers(finalUsers); 
            
        } catch (error) {
            console.error('Lỗi tải dữ liệu user:', error);
            toast({ title: "Lỗi Tải Dữ liệu", description: "Không thể tải danh sách người dùng. (Kiểm tra RLS/FK)", variant: "destructive" }); 
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // --- LOGIC CẬP NHẬT ROLE VÀ VỊ TRÍ ---
    const handleUpdateRoleAndPosition = async () => {
        if (!selectedUserForRole || !selectedNewRole) {
            toast({ title: "Lỗi", description: "Vui lòng chọn vai trò mới.", variant: "destructive" });
            return;
        }

        try {
            setLoading(true);
            const userId = selectedUserForRole.id;
            const newTeamId = selectedTeam === 'none' ? null : selectedTeam;
            const newShiftId = selectedShift === 'none' ? null : selectedShift;

            // 1. CẬP NHẬT VỊ TRÍ (PROFILE)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ team_id: newTeamId, shift_id: newShiftId } as unknown)
                .eq('id', userId);

            if (profileError) throw profileError;

            // 2. CẬP NHẬT VAI TRÒ (USER_ROLES) - Sử dụng UPSERT thay vì DELETE + INSERT
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: roleError } = await supabase
                .from('user_roles')
                .upsert({ user_id: userId, role: selectedNewRole } as unknown, { onConflict: 'user_id' });

            if (roleError) throw roleError;

            toast({
                title: "Cập nhật thành công",
                description: `Vai trò và Vị trí của ${selectedUserForRole.last_name} đã được cập nhật.`,
            });

            setIsRoleModalOpen(false);
            setSelectedUserForRole(null);
            setSelectedNewRole('');
            setSelectedTeam('');
            setSelectedShift('');
            await fetchUsers();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Lỗi cập nhật:", errorMessage);
            toast({ variant: "destructive", title: "Lỗi cập nhật", description: errorMessage });
        } finally {
            setLoading(false);
        }
    };
    
    // --- APPROVE/REJECT USER FUNCTIONS (DUAL-APPROVAL SYSTEM) ---
    const handleApproveUser = async (userId: string, userName: string) => {
        setIsApprovingUser(userId);
        try {
            // Get the registration record
            const { data: regData } = await supabase
                .from('user_registrations')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (!regData) {
                toast({ variant: "destructive", title: "Lỗi", description: "Không tìm thấy record đăng ký.", });
                setIsApprovingUser(null);
                return;
            }

            // Call the dual-approval RPC function
            const { data, error } = await supabase.rpc('approve_user_registration', {
                p_registration_id: regData.id,
                p_role: 'staff',
                p_approval_by: 'admin'
            });

            if (error) throw error;

            toast({
                title: "Phê duyệt từ Admin thành công",
                description: `Admin đã phê duyệt tài khoản ${userName}. Đang chờ phê duyệt từ HR.`,
            });
            await fetchUsers();
        } catch (error) {
            console.error('Lỗi phê duyệt:', error);
            toast({ variant: "destructive", title: "Lỗi phê duyệt", description: (error as Error).message, });
        } finally {
            setIsApprovingUser(null);
        }
    };

    const handleRejectUser = async (userId: string, userName: string) => {
        setIsApprovingUser(userId);
        try {
            // Get the registration record
            const { data: regData } = await supabase
                .from('user_registrations')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (!regData) {
                toast({ variant: "destructive", title: "Lỗi", description: "Không tìm thấy record đăng ký.", });
                setIsApprovingUser(null);
                return;
            }

            // Call the reject RPC function
            const { error } = await supabase.rpc('reject_user_registration', {
                p_registration_id: regData.id,
                p_rejection_reason: 'Từ chối từ Admin'
            });

            if (error) throw error;

            toast({ title: "Từ chối thành công", description: `Tài khoản ${userName} đã bị từ chối.`, });
            await fetchUsers();
        } catch (error) {
            console.error('Lỗi từ chối:', error);
            toast({ variant: "destructive", title: "Lỗi từ chối", description: (error as Error).message, });
        } finally {
            setIsApprovingUser(null);
        }
    };

    // --- LOGIC THÊM NGƯỜI DÙNG MỚI ---
    const handleCreateUser = async () => {
        if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone) {
            toast({ title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin bắt buộc.", variant: "destructive" });
            return;
        }

        try {
            setLoading(true);

            // Tạo profile mới với account_status = PENDING
            const newUserId = crypto.randomUUID();
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: newUserId,
                    email: formData.email,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone: formData.phone,
                    team_id: formData.team_id || null,
                    shift_id: formData.shift_id || null,
                    employment_status: formData.employment_status || null,
                    account_status: 'PENDING',
                });

            if (profileError) throw profileError;

            toast({
                title: "Thành công",
                description: `Tài khoản cho ${formData.first_name} ${formData.last_name} đã được tạo.`,
            });

            setIsCreateUserOpen(false);
            resetFormData();
            await fetchUsers();
        } catch (error) {
            console.error("Lỗi tạo user:", error);
            toast({ variant: "destructive", title: "Lỗi tạo user", description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    };

    // --- LOGIC CẬP NHẬT NGƯỜI DÙNG ---
    const handleEditUser = async () => {
        if (!selectedUserForEdit) return;

        if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone) {
            toast({ title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin bắt buộc.", variant: "destructive" });
            return;
        }

        try {
            setLoading(true);

            const { error } = await supabase
                .from('profiles')
                .update({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    phone: formData.phone,
                    team_id: formData.team_id || null,
                    shift_id: formData.shift_id || null,
                    employment_status: formData.employment_status || null,
                })
                .eq('id', selectedUserForEdit.id);

            if (error) throw error;

            toast({
                title: "Thành c��ng",
                description: `Thông tin của ${formData.first_name} ${formData.last_name} đã được cập nhật.`,
            });

            setIsEditUserOpen(false);
            setSelectedUserForEdit(null);
            resetFormData();
            await fetchUsers();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Lỗi cập nhật user:", errorMessage);
            toast({ variant: "destructive", title: "Lỗi cập nhật user", description: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    // --- LOGIC XÓA NGƯ��I DÙNG ---
    const handleDeleteUser = async (user: UserDetail) => {
        setUserToDelete(user);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            setLoading(true);

            // Xóa user roles
            await supabase.from('user_roles').delete().eq('user_id', userToDelete.id);

            // Xóa profile
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userToDelete.id);

            if (error) throw error;

            toast({
                title: "Thành công",
                description: `Tài khoản ${userToDelete.first_name} ${userToDelete.last_name} đã được xóa.`,
            });

            setIsDeleteConfirmOpen(false);
            setUserToDelete(null);
            await fetchUsers();
        } catch (error) {
            console.error("Lỗi xóa user:", error);
            toast({ variant: "destructive", title: "Lỗi xóa user", description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    };

    const resetFormData = () => {
        setFormData({
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            team_id: '',
            shift_id: '',
            employment_status: '',
        });
    };

    const openEditDialog = (user: UserDetail) => {
        setSelectedUserForEdit(user);
        setFormData({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            phone: user.phone || '',
            team_id: user.team_id || '',
            shift_id: user.shift_id || '',
            employment_status: user.employment_status || '',
        });
        setIsEditUserOpen(true);
    };


    // --- FILTER LOGIC (ĐÃ SỬA LỖI LỌC ROLE CLIENT SIDE) ---
    const filteredUsers = useMemo(() => {
        let currentUsers = users;

        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            currentUsers = currentUsers.filter(user => 
                user.first_name?.toLowerCase().includes(lowerCaseSearch) ||
                user.last_name?.toLowerCase().includes(lowerCaseSearch) ||
                user.email.toLowerCase().includes(lowerCaseSearch)
            );
        }

        if (filterAccountStatus !== 'all') {
            currentUsers = currentUsers.filter(user => user.account_status === filterAccountStatus);
        }

        if (filterStatus !== 'all') {
            currentUsers = currentUsers.filter(user => user.employment_status === filterStatus);
        }

        if (filterRole !== 'all') {
            currentUsers = currentUsers.filter(user => {
                const primaryRole = getPrimaryRole(user.user_roles);
                return primaryRole.toLowerCase() === filterRole;
            });
        }
        
        return currentUsers;
    }, [users, searchTerm, filterAccountStatus, filterStatus, filterRole]);
    
    
    // --- UI RENDER (TABLE BODY) ---

    if (loading) {
        return <div className="p-6 text-center"><Loader2 className="h-6 w-6 inline animate-spin mr-2" /> Đang tải dữ liệu người dùng...</div>;
    }

    const UserTableBody = filteredUsers.map((user) => {
        const role = getPrimaryRole(user.user_roles);
        const isExpanded = expandedId === user.id;
        const fullName = `${user.last_name || ''} ${user.first_name || ''}`.trim() || user.email;
        // FIX: Lấy tên đội nhóm/shift từ Object đã được hợp nhất
        const teamName = user.team?.name || (user.team_id ? `ID: ${user.team_id.substring(0, 8)}...` : '—');
        const shiftName = user.shift?.name || (user.shift_id ? `ID: ${user.shift_id.substring(0, 8)}...` : '—');
        const shiftInfoTime = user.shift?.start_time ? `${user.shift.start_time} - ${user.shift.end_time}` : 'Không áp dụng';


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
                    <TableCell>{teamName}</TableCell>
                    <TableCell className="font-medium text-base">{user.annual_leave_balance} ngày</TableCell>
                </TableRow>
                
                {/* HÀNG CHI TIẾT MỞ RỘNG & HÀNH ĐỘNG QUẢN LÝ */}
                {isExpanded && (
                    <TableRow className="bg-secondary/30 hover:bg-secondary/40 transition-colors">
                        <TableCell colSpan={6} className="py-4 px-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                
                                {/* 1. Khối Thông tin mở rộng (Học vấn, Cá nhân) */}
                                <div className="grid grid-cols-2 md:grid-cols-3 flex-1 gap-4 text-sm border-r pr-6">
                                    {/* Học vấn */}
                                    <div className="space-y-1">
                                        <h4 className="font-bold flex items-center gap-1 text-primary"><GraduationCap className="w-4 h-4" /> Học vấn</h4>
                                        <p><span className="font-medium">Trường:</span> {user.university || '—'}</p>
                                        <p><span className="font-medium">Chuyên ngành:</span> {user.major || '—'}</p>
                                        <p><span className="font-medium">Giới tính:</span> {user.gender || '—'}</p>
                                    </div>
                                    
                                    {/* Ca làm việc */}
                                    <div className="space-y-1">
                                        <h4 className="font-bold flex items-center gap-1 text-primary"><Briefcase className="w-4 h-4" /> Ca làm việc</h4>
                                        <p className="text-sm"><span className="font-medium">Ca làm:</span> {shiftName}</p>
                                        <p className="text-xs text-muted-foreground">Thời gian: ({shiftInfoTime})</p>
                                    </div>

                                    {/* Tài liệu & CV */}
                                    <div className="space-y-1">
                                        <h4 className="font-bold flex items-center gap-1 text-primary"><FileText className="w-4 h-4" /> Tài liệu (CV)</h4>
                                        
                                        {user.cv_url ? (
                                            <a href={user.cv_url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="secondary" size="sm" className="bg-green-600 hover:bg-green-700 text-white mt-2">Xem CV</Button>
                                            </a>
                                        ) : (
                                            <p className="text-sm text-red-500 mt-2">Chưa có CV được tải lên.</p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* 2. KHỐI HÀNH ĐỘNG QUẢN LÝ */}
                                <div className="flex flex-col gap-2 md:w-56 justify-start pt-2 border-l pl-4">
                                    <h4 className="font-bold text-primary border-b pb-1">Hành động Quản lý</h4>
                                    
                                    {/* Phê duyệt / Từ chối */}
                                    {user.account_status === 'PENDING' && (
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 w-full"
                                                disabled={isApprovingUser === user.id}
                                                onClick={() => handleApproveUser(user.id, fullName)}
                                            >
                                                <Check className="h-4 w-4 mr-1" /> Phê duyệt TK
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                disabled={isApprovingUser === user.id}
                                                onClick={() => handleRejectUser(user.id, fullName)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Gán Vai trò */}
                                    {user.account_status === 'APPROVED' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedUserForRole(user);
                                                setSelectedNewRole(getPrimaryRole(user.user_roles).toLowerCase());
                                                setSelectedTeam(user.team_id || 'none');
                                                setSelectedShift(user.shift_id || 'none');
                                                setIsRoleModalOpen(true);
                                            }}
                                        >
                                            Gán Vai trò & Vị trí
                                        </Button>
                                    )}

                                    {/* Chỉnh sửa */}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openEditDialog(user)}
                                    >
                                        <Edit className="h-4 w-4 mr-1" /> Chỉnh sửa
                                    </Button>

                                    {/* Xóa */}
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteUser(user)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
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
                    {/* KHỐI TÌM KIẾM & THÊM */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <CardTitle className="text-xl font-semibold">Danh sách Toàn bộ Nhân viên ({filteredUsers.length})</CardTitle>
                            <CardDescription>Nhấn vào hàng để xem chi tiết thông tin mở rộng.</CardDescription>
                        </div>
                        
                        <div className="relative w-full max-w-sm md:w-auto">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Tìm kiếm theo Tên hoặc Email..." className="pl-9 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    {/* BỘ LỌC NÂNG CAO */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-3">
                        <div className="space-y-1">
                            <Label htmlFor="filter-account-status" className="text-xs font-medium">Trạng thái TK</Label>
                            <Select value={filterAccountStatus} onValueChange={setFilterAccountStatus}>
                                <SelectTrigger id="filter-account-status" className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="PENDING">Chờ duyệt</SelectItem>
                                    <SelectItem value="APPROVED">Đã duyệt</SelectItem>
                                    <SelectItem value="REJECTED">Từ chối</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="filter-role" className="text-xs font-medium">Vai trò</Label>
                            <Select value={filterRole} onValueChange={setFilterRole}>
                                <SelectTrigger id="filter-role" className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
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

                        <div className="space-y-1">
                            <Label htmlFor="filter-status" className="text-xs font-medium">Tình trạng CV</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger id="filter-status" className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="Employed">Đã đi làm</SelectItem>
                                    <SelectItem value="Student">Sinh viên</SelectItem>
                                    <SelectItem value="Trainee">Thực tập/Học sinh</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col justify-end">
                            <Button variant="outline" size="sm" className="h-9" onClick={() => { setSearchTerm(''); setFilterRole('all'); setFilterStatus('all'); setFilterAccountStatus('all'); }}>Đặt lại bộ lọc</Button>
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
                                    <TableHead className="w-[150px]">Tình trạng CV</TableHead>
                                    <TableHead className="w-[150px]">Đội nhóm</TableHead>
                                    <TableHead className="w-[150px]">Nghỉ phép (Ngày)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
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
                <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90">
                            <Plus className="h-4 w-4 mr-2" />
                            Thêm Người dùng
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Thêm Người dùng Mới</DialogTitle>
                            <DialogDescription>Nhập thông tin người dùng mới. Họ sẽ nhận được email để thiết lập mật khẩu.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="create-first-name">Họ *</Label>
                                    <Input
                                        id="create-first-name"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        placeholder="Ví dụ: Nguyễn"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="create-last-name">Tên *</Label>
                                    <Input
                                        id="create-last-name"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        placeholder="Ví dụ: Văn A"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="create-email">Email *</Label>
                                <Input
                                    id="create-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="user@example.com"
                                />
                            </div>

                            <div>
                                <Label htmlFor="create-phone">Số điện thoại *</Label>
                                <Input
                                    id="create-phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="0123456789"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="create-team">Đội nhóm</Label>
                                    <Select value={formData.team_id} onValueChange={(v) => setFormData({ ...formData, team_id: v })}>
                                        <SelectTrigger id="create-team" className="h-10"><SelectValue placeholder="Chọn đội" /></SelectTrigger>
                                        <SelectContent>
                                            {allTeams.map(team => (
                                                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="create-shift">Ca làm việc</Label>
                                    <Select value={formData.shift_id} onValueChange={(v) => setFormData({ ...formData, shift_id: v })}>
                                        <SelectTrigger id="create-shift" className="h-10"><SelectValue placeholder="Chọn ca" /></SelectTrigger>
                                        <SelectContent>
                                            {allShifts.map(shift => (
                                                <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="create-employment">Tình trạng</Label>
                                <Select value={formData.employment_status} onValueChange={(v) => setFormData({ ...formData, employment_status: v })}>
                                    <SelectTrigger id="create-employment" className="h-10"><SelectValue placeholder="Chọn tình trạng" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Employed">Đang làm việc</SelectItem>
                                        <SelectItem value="Student">Sinh viên</SelectItem>
                                        <SelectItem value="Trainee">Thực tập sinh</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button className="w-full" onClick={handleCreateUser} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Tạo người dùng
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            
            {/* Modal Gán Vai trò & Vị trí */}
            <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Gán vai trò cho {selectedUserForRole?.first_name} {selectedUserForRole?.last_name}</DialogTitle>
                        <DialogDescription>Cập nhật vai trò, đội nhóm, và ca làm việc.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="role-select">Vai trò</Label>
                            <Select value={selectedNewRole} onValueChange={setSelectedNewRole}>
                                <SelectTrigger id="role-select" className="h-10"><SelectValue placeholder="Chọn vai trò" /></SelectTrigger>
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
                        </div>

                        <div>
                            <Label htmlFor="team-select">Đội nhóm</Label>
                            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                                <SelectTrigger id="team-select" className="h-10"><SelectValue placeholder="Chọn đội nhóm" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Không có</SelectItem>
                                    {allTeams.map(team => (
                                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="shift-select">Ca làm việc</Label>
                            <Select value={selectedShift} onValueChange={setSelectedShift}>
                                <SelectTrigger id="shift-select" className="h-10"><SelectValue placeholder="Chọn ca làm việc" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Không có</SelectItem>
                                    {allShifts.map(shift => (
                                        <SelectItem key={shift.id} value={shift.id}>{shift.name} ({shift.start_time} - {shift.end_time})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button className="w-full" onClick={handleUpdateRoleAndPosition} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Cập nhật vai trò & vị trí
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal Chỉnh sửa Người dùng */}
            <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Chỉnh sửa Người dùng</DialogTitle>
                        <DialogDescription>Cập nhật thông tin chi tiết cho người dùng.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="edit-first-name">Họ *</Label>
                                <Input
                                    id="edit-first-name"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    placeholder="Ví dụ: Nguyễn"
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-last-name">Tên *</Label>
                                <Input
                                    id="edit-last-name"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    placeholder="Ví dụ: Văn A"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="edit-email">Email *</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="user@example.com"
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-phone">Số điện tho��i *</Label>
                            <Input
                                id="edit-phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="0123456789"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="edit-team">Đội nhóm</Label>
                                <Select value={formData.team_id} onValueChange={(v) => setFormData({ ...formData, team_id: v })}>
                                    <SelectTrigger id="edit-team" className="h-10"><SelectValue placeholder="Chọn đội" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Không có</SelectItem>
                                        {allTeams.map(team => (
                                            <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="edit-shift">Ca làm việc</Label>
                                <Select value={formData.shift_id} onValueChange={(v) => setFormData({ ...formData, shift_id: v })}>
                                    <SelectTrigger id="edit-shift" className="h-10"><SelectValue placeholder="Chọn ca" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Không có</SelectItem>
                                        {allShifts.map(shift => (
                                            <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="edit-employment">Tình trạng</Label>
                            <Select value={formData.employment_status} onValueChange={(v) => setFormData({ ...formData, employment_status: v })}>
                                <SelectTrigger id="edit-employment" className="h-10"><SelectValue placeholder="Chọn tình trạng" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Không xác định</SelectItem>
                                    <SelectItem value="Employed">Đang làm việc</SelectItem>
                                    <SelectItem value="Student">Sinh viên</SelectItem>
                                    <SelectItem value="Trainee">Thực tập sinh</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button className="w-full" onClick={handleEditUser} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Cập nhật thông tin
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog Xác nhận Xóa */}
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận Xóa Người dùng</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn xóa tài khoản của <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong> không? Hành động này không thể hoàn tác.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
                            Hủy
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteUser} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Xóa
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UsersManagement;
