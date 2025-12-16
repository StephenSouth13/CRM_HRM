import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Loader2, Users, Edit, Trash2, Save, FileText, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

// --- INTERFACES SỬA LỖI VÀ CHUẨN HÓA ---

interface LeaderProfile { first_name: string; last_name: string; email: string; }

// Interface Profile mở rộng để bao gồm team_id (Rất quan trọng cho việc lọc)
interface ProfileWithTeam {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    team_id: string | null; // Cột team_id để lọc thành viên
}

// Interface TeamMember được thay thế bằng ProfileWithTeam
interface Team {
    id: string;
    name: string;
    description: string | null;
    leader_id: string | null;
    leader_2_id: string | null; // Thêm leader 2
    created_at: string;
    updated_at: string;
    leader_profile: LeaderProfile[] | null;
    leader_2_profile: LeaderProfile[] | null; // Thêm profile cho leader 2
    // team_members giờ là mảng các Profiles có team_id khớp với team.id
    team_members: ProfileWithTeam[] | null; 
}

// --- END INTERFACES ---

const TeamsManagement = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [profiles, setProfiles] = useState<ProfileWithTeam[]>([]); // Sửa kiểu dữ liệu
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({ 
        id: '', 
        name: '', 
        description: '', 
        leader_id: '',
        leader_2_id: '', // Thêm leader 2
        member_id: 'none'
    });
    // selectedMembers giờ là các thành viên thuộc team hiện tại
    const [selectedMembers, setSelectedMembers] = useState<ProfileWithTeam[]>([]); 
    
    const { toast } = useToast();

    const getLeaderName = (team: Team) => {
        const leaders = [];
        if (team.leader_profile && team.leader_profile.length > 0) {
            leaders.push(`${team.leader_profile[0].first_name} ${team.leader_profile[0].last_name}`);
        }
        if (team.leader_2_profile && team.leader_2_profile.length > 0) {
            leaders.push(`${team.leader_2_profile[0].first_name} ${team.leader_2_profile[0].last_name}`);
        }
        if (leaders.length > 0) {
            return leaders.join(' & ');
        }
        if (team.leader_id) {
            return `ID: ${team.leader_id.substring(0, 8)}...`;
        }
        return '— Chưa chỉ định';
    };

    const fetchTeams = useCallback(async () => {
        try {
            setLoading(true);
            
            // 1. Tải danh sách Teams và Leader
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select(`
                    *,
                    leader_profile:profiles!leader_id ( 
                        first_name,
                        last_name,
                        email 
                    ),
                    leader_2_profile:profiles!leader_2_id ( 
                        first_name,
                        last_name,
                        email 
                    )
                `) 
                .order('name');
            
            // 2. Tải TẤT CẢ Profiles (bao gồm cả team_id để gán thành viên)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email, team_id'); // RẤT QUAN TRỌNG: Cần lấy team_id

            if (teamError) throw teamError;
            if (profileError) throw profileError;

            // 3. Xử lý logic gán thành viên vào Team (Client-side)
            const allProfiles = profileData as ProfileWithTeam[];
            
            const teamsWithMembers = (teamData as Team[]).map(team => {
                // Lọc những Profile có team_id khớp với team.id
                const members = allProfiles.filter(p => p.team_id === team.id);
                return {
                    ...team,
                    team_members: members,
                } as Team;
            });
            
            setTeams(teamsWithMembers);
            setProfiles(allProfiles || []); // Lưu toàn bộ profiles
            
        } catch (error) {
            console.error('Lỗi tải đội nhóm:', error);
            toast({ title: "Lỗi", description: "Không thể tải danh sách đội nhóm.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    // --- THÊM THÀNH VIÊN VÀO TEAM (Cập nhật cột team_id trong bảng profiles) ---
    const handleAddMember = async (teamId: string) => {
        if (formData.member_id === 'none') {
            toast({ title: "Lỗi", description: "Vui lòng chọn thành viên.", variant: "destructive" });
            return;
        }

        try {
            setLoading(true);
            // Cập nhật trực tiếp cột team_id trong bảng profiles
            const { error } = await supabase
                .from('profiles')
                .update({ team_id: teamId })
                .eq('id', formData.member_id); // Dùng member_id đã chọn

            if (error) throw error;

            toast({ title: "Thành công", description: "Thành viên đã được thêm vào đội nhóm." });
            setFormData({ ...formData, member_id: 'none' });
            await fetchTeams();
        } catch (error) {
            console.error('Lỗi thêm thành viên:', error);
            toast({ title: "Lỗi", description: (error as Error).message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // --- XÓA THÀNH VIÊN KHỎI TEAM (Cập nhật cột team_id thành NULL) ---
    const handleRemoveMember = async (memberProfileId: string, memberName: string) => {
        if (!confirm(`Xóa ${memberName} khỏi đội nhóm?`)) return;

        try {
            setLoading(true);
            // Cập nhật trực tiếp cột team_id thành NULL
            const { error } = await supabase
                .from('profiles')
                .update({ team_id: null }) // Đặt team_id = NULL để loại bỏ khỏi Team
                .eq('id', memberProfileId); // ID của Profile cần xóa

            if (error) throw error;

            toast({ title: "Thành công", description: "Thành viên đã bị xóa khỏi đội nhóm." });
            await fetchTeams();
        } catch (error) {
            console.error('Lỗi xóa thành viên:', error);
            toast({ title: "Lỗi xóa", description: (error as Error).message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // --- CHỨC NĂNG DELETE TEAM ---
    const handleDeleteTeam = async (teamId: string, teamName: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa đội nhóm "${teamName}" không? Hành động này không thể hoàn tác.`)) {
            return;
        }
        
        try {
            setLoading(true);

            // 1. Xóa thành viên (Đặt team_id của profiles liên quan thành NULL)
            const { error: memberUpdateError } = await supabase
                .from('profiles')
                .update({ team_id: null })
                .eq('team_id', teamId);
            
            if (memberUpdateError) throw memberUpdateError;

            // 2. Xóa Team
            const { error: teamDeleteError } = await supabase
                .from('teams')
                .delete()
                .eq('id', teamId);

            if (teamDeleteError) throw teamDeleteError;

            toast({ title: "Thành công", description: `Đội nhóm '${teamName}' đã bị xóa.` });
            await fetchTeams();
        } catch (error) {
            console.error('Lỗi xóa đội nhóm:', error);
            toast({ title: "Lỗi Xóa", description: (error as Error).message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    
    // --- CHỨC NĂNG SỬA/THÊM (HANDLE SAVE) ---
    const handleSaveTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name) {
            toast({ title: "Lỗi", description: "Tên đội nhóm không được để trống.", variant: "destructive" });
            return;
        }

        if (formData.leader_id && formData.leader_id === formData.leader_2_id) {
            toast({ title: "Lỗi", description: "Trưởng nhóm 1 và Trưởng nhóm 2 không được trùng nhau.", variant: "destructive" });
            return;
        }

        try {
            setLoading(true);
            // Chuẩn hóa leaderId: 'none' -> null
            const leaderId = formData.leader_id === "none" ? null : formData.leader_id || null;
            const leader2Id = formData.leader_2_id === "none" ? null : formData.leader_2_id || null;
            
            const baseQuery = supabase.from('teams');
            
            const payload = {
                name: formData.name,
                description: formData.description,
                leader_id: leaderId,
                leader_2_id: leader2Id,
            };

            let error;
            if (isEditMode) {
                ({ error } = await baseQuery.update(payload).eq('id', formData.id));
            } else {
                ({ error } = await baseQuery.insert(payload));
            }

            if (error) throw error;

            toast({ title: "Thành công", description: `Đội nhóm '${formData.name}' đã được ${isEditMode ? 'cập nhật' : 'thêm'}.` });
            
            setIsDialogOpen(false);
            setFormData({ id: '', name: '', description: '', leader_id: '', leader_2_id: '', member_id: 'none' });
            setIsEditMode(false);
            
            await fetchTeams();

        } catch (error) {
            console.error('Lỗi lưu đội nhóm:', error);
            toast({ title: "Lỗi", description: (error as Error).message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    
    const initEditMode = (team: Team) => {
        setFormData({
            id: team.id,
            name: team.name,
            description: team.description || '',
            leader_id: team.leader_id || 'none',
            leader_2_id: team.leader_2_id || 'none',
            member_id: 'none'
        });
        // Lấy danh sách thành viên từ team.team_members đã được xử lý ở fetchTeams
        setSelectedMembers(team.team_members || []);
        setIsEditMode(true);
        setIsDialogOpen(true);
    };
    
    const initAddMode = () => {
        setFormData({ id: '', name: '', description: '', leader_id: 'none', leader_2_id: 'none', member_id: 'none' });
        setSelectedMembers([]);
        setIsEditMode(false);
        setIsDialogOpen(true);
    };

    if (loading) {
        return <div className="p-6 text-center text-muted-foreground"><Loader2 className="h-6 w-6 inline animate-spin mr-2" /> Đang tải dữ liệu...</div>;
    }
    
    // Lọc profiles chưa có team_id để hiển thị trong Select
    const availableMembers = profiles.filter(p => !p.team_id);

    return (
        <div className="space-y-6 p-4">
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                <Users className="h-7 w-7 text-primary" /> QUẢN LÝ ĐỘI NHÓM
            </h1>

            <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4">
                    <div>
                        <CardTitle className="text-xl font-semibold">Danh sách Đội nhóm ({teams.length})</CardTitle>
                        <CardDescription>Quản lý các đội nhóm, trưởng nhóm, thành viên và mô tả công việc.</CardDescription>
                    </div>
                    
                    {/* Nút THÊM ĐỘI NHÓM */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90" onClick={initAddMode}>
                                <Plus className="h-4 w-4 mr-2" />
                                Thêm Đội nhóm
                            </Button>
                        </DialogTrigger>
                        
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{isEditMode ? 'Cập nhật' : 'Thêm'} Đội nhóm</DialogTitle>
                                <DialogDescription>{isEditMode ? 'Chỉnh sửa chi tiết đội nhóm đã chọn.' : 'Nhập chi tiết thông tin đội nhóm mới.'}</DialogDescription>
                            </DialogHeader>
                            
                            <form onSubmit={handleSaveTeam} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Tên Đội nhóm</Label>
                                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="description">Mô tả</Label>
                                    <Textarea id="description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="leader">Leader (Trưởng nhóm)</Label>
                                    <Select 
                                        value={formData.leader_id || 'none'} 
                                        onValueChange={(value) => setFormData({ ...formData, leader_id: value })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Chọn Trưởng nhóm (Tùy chọn)" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem key="none" value="none">— Chưa chỉ định —</SelectItem>
                                            {availableLeaders.map(p => (
                                                <SelectItem key={p.id} value={p.id} disabled={p.id === formData.leader_2_id}>
                                                    {p.first_name} {p.last_name} ({p.email})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* PHẦN THÊM/XÓA THÀNH VIÊN (CHỈ HIỂN THỊ KHI CHỈNH SỬA) */}
                                {isEditMode && (
                                    <div className="space-y-2 border-t pt-4">
                                        <Label>Thành viên trong nhóm ({selectedMembers.length})</Label>
                                        <div className="space-y-2">
                                            {/* Danh sách thành viên hiện tại */}
                                            {selectedMembers.map(member => (
                                                <div key={member.id} className="flex items-center justify-between bg-secondary/50 p-2 rounded">
                                                    <span className="text-sm">{member.first_name} {member.last_name}</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveMember(
                                                            member.id, // ID của Profile
                                                            `${member.first_name} ${member.last_name}`
                                                        )}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Thêm thành viên mới (Chỉ hiện thị người chưa có Team) */}
                                        <div className="space-y-2 pt-2">
                                            <Label htmlFor="member">Thêm thành viên mới</Label>
                                            <div className="flex gap-2">
                                                <Select 
                                                    value={formData.member_id} 
                                                    onValueChange={(value) => setFormData({ ...formData, member_id: value })}
                                                >
                                                    <SelectTrigger className="flex-1"><SelectValue placeholder="Chọn thành viên" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">— Chọn —</SelectItem>
                                                        {availableMembers.map(p => ( // Dùng danh sách đã lọc (availableMembers)
                                                            <SelectItem key={p.id} value={p.id}>
                                                                {p.first_name} {p.last_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => handleAddMember(formData.id)}
                                                    disabled={loading || formData.member_id === 'none'}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <Button type="submit" className="w-full mt-4" disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    {isEditMode ? 'Lưu Cập nhật' : 'Thêm Đội nhóm'}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[200px] text-primary">Tên Đội nhóm</TableHead>
                                    <TableHead className="min-w-[250px]">Mô tả</TableHead>
                                    <TableHead className="w-[200px]">Leader</TableHead>
                                    <TableHead className="w-[150px]">Số thành viên</TableHead>
                                    <TableHead className="w-[150px]">Ngày Tạo</TableHead>
                                    <TableHead className="w-[80px] text-right">Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teams.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                                            Chưa có đội nhóm nào được tạo.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    teams.map((team) => (
                                        <TableRow key={team.id} className="hover:bg-secondary/30 transition-colors cursor-pointer">
                                            <TableCell className="font-semibold text-base text-primary">{team.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{team.description || '—'}</TableCell>
                                            <TableCell className="font-medium text-sm">{getLeaderName(team)}</TableCell>
                                            <TableCell className="text-sm">{team.team_members?.length || 0}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{format(new Date(team.created_at), 'dd/MM/yyyy')}</TableCell>
                                            
                                            {/* NÚT HÀNH ĐỘNG */}
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Mở menu</span>
                                                            <FileText className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                                                        <DropdownMenuItem 
                                                            onClick={() => initEditMode(team)}
                                                        >
                                                            <Edit className="mr-2 h-4 w-4" /> Sửa & Thêm Thành viên
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem 
                                                            onClick={() => handleDeleteTeam(team.id, team.name)}
                                                            className="text-red-600 hover:!bg-red-500/10 focus:!bg-red-500/10 focus:text-red-600"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Xóa
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TeamsManagement;