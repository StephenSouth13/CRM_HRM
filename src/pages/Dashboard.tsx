import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
    Users, CheckCircle2, Clock, AlertCircle, TrendingUp, Calendar, 
    FileText, Briefcase, Zap, ChevronRight 
} from "lucide-react";
import { getUserRole, getCurrentUser } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/lib/auth"; 
import { SkeletonStatCard } from "@/components/ui/skeleton-card";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";


// Định nghĩa kiểu dữ liệu thống kê
type DashboardStats = {
    totalTasks: number; completedTasks: number; pendingTasks: number;
    todayAttendance: boolean; leaveBalance: number; upcomingMeetings: number;
    totalEmployees?: number; pendingApprovals?: number;
};

// Định nghĩa kiểu dữ liệu cơ bản cho Tasks và Profile (cho mục đích ép kiểu an toàn)
interface BasicTask { status: string; }
interface BasicProfile { annual_leave_balance: number; }


const Dashboard = () => {
    const navigate = useNavigate(); 
    // Giả định 'staff' là một UserRole hợp lệ, nếu không, phải dùng 'employee' as UserRole
    const [role, setRole] = useState<UserRole>('staff' as UserRole); 
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState(''); 
    
    const [stats, setStats] = useState<DashboardStats>({
        totalTasks: 0, completedTasks: 0, pendingTasks: 0,
        leaveBalance: 0, todayAttendance: false, upcomingMeetings: 0
    });

    // --- LOGIC TẢI DỮ LIỆU THEO VAI TRÒ (Dùng useCallback) ---

    const loadEmployeeStats = useCallback(async (userId: string) => {
        try {
            // Load tasks
            const { data: tasks } = await supabase.from('tasks').select('status').eq('assignee_id', userId);
            
            // FIX LỖI: Dùng 'as unknown as any[]' để vượt qua lỗi Typescript sâu
            const taskList = tasks as unknown as BasicTask[] || [];
            
            const totalTasks = taskList.length;
            const completedTasks = taskList.filter((t: BasicTask) => t.status === 'done').length; // FIX: Chỉ dùng 'done'
            const pendingTasks = totalTasks - completedTasks;

            // Kiểm tra điểm danh hôm nay
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            const { data: attendance, error: attendanceError } = await supabase
              .from('attendance')
              .select('*')
              .eq('user_id', userId)
              .gte('timestamp', startOfDay.toISOString())
              .lt('timestamp', endOfDay.toISOString())
              .limit(1);

            if (attendanceError) {
              console.error("Lỗi tải điểm danh:", attendanceError.message);
            }

            // Load số ngày phép
            const { data: profile } = await supabase.from('profiles').select('annual_leave_balance').eq('id', userId).single();

            // Load cuộc họp sắp tới
            const { data: meetings } = await supabase.from('room_bookings').select('*').eq('user_id', userId).gte('start_time', new Date().toISOString()).limit(5);

            setStats({
                totalTasks, completedTasks, pendingTasks,
                todayAttendance: (attendance?.length || 0) > 0,
                // FIX LỖI ANY: Ép kiểu profile an toàn
                leaveBalance: (profile as BasicProfile)?.annual_leave_balance || 0, 
                upcomingMeetings: meetings?.length || 0,
            });
        } catch (error: any) {
            console.error("Lỗi tải stats nhân viên:", error?.message || error);
        }
    }, []);

    const loadAdminStats = useCallback(async () => {
        try {
            // Load toàn công ty
            const { data: tasks } = await supabase.from('tasks').select('status');
            const { data: profiles } = await supabase.from('profiles').select('id, annual_leave_balance');
            const { data: pendingRequests } = await supabase.from('leave_requests').select('*').eq('status', 'pending');

            const taskList = tasks as unknown as BasicTask[] || [];
            
            const totalTasks = taskList.length;
            const completedTasks = taskList.filter((t: BasicTask) => t.status === 'done').length; 
            const totalEmployees = profiles?.length || 0;
            const pendingApprovals = pendingRequests?.length || 0;

            setStats(prev => ({
                ...prev,
                totalTasks,
                completedTasks,
                pendingTasks: totalTasks - completedTasks,
                totalEmployees,
                pendingApprovals,
            }));
        } catch (error: any) {
            console.error("Lỗi tải stats Admin:", error?.message || error);
        }
    }, []);

    // --- LOGIC TẢI DATA CHÍNH ---
    useEffect(() => {
        const loadDashboard = async () => {
            setLoading(true);
            try {
                const user = await getCurrentUser();
                if (!user) {
                    navigate('/auth/login');
                    return;
                }

                // Check if user is approved (for dual approval system)
                const { data: profile } = await supabase.from('profiles').select('first_name, last_name, account_status').eq('id', user.id).single();

                // If user is not approved, redirect to pending approval page
                if (profile?.account_status !== 'APPROVED') {
                    navigate('/auth/pending-approval');
                    return;
                }

                setUserName(profile ? `${profile.last_name || ''} ${profile.first_name || ''}`.trim() : user.email);

                const userRole = await getUserRole(user.id);
                setRole(userRole);

                // FIX LỖI SO SÁNH: Sử dụng các giá trị hợp lệ trong UserRole
                if (userRole === 'staff' || userRole === 'employee') {
                    await loadEmployeeStats(user.id);
                } else if (userRole === 'leader' || userRole === 'admin' || userRole === 'bod') {
                    await loadAdminStats();
                }
            } catch (error: any) {
                console.error("Lỗi tải dashboard:", error?.message || error);
            } finally {
                setLoading(false);
            }
        };
        loadDashboard();
    }, [loadEmployeeStats, loadAdminStats]); // Thêm dependencies cho hooks

    const taskCompletionRate = stats.totalTasks > 0 
        ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
        : 0;

    // Tiêu đề dựa trên Vai trò và Tên
    const roleTitle = role === 'admin' || role === 'bod' ? 'Quản trị' : role === 'leader' ? 'Leader' : 'Nhân viên';


    // --- UI RENDER ---
    if (loading) {
        return (
            <DashboardLayout role={role}>
                <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
                    <div className="mb-2">
                        <h2 className="text-4xl font-extrabold tracking-tight text-primary">Bảng Điều Khiển</h2>
                        <p className="text-muted-foreground mt-2">Đang tải dữ liệu tổng quan, vui lòng chờ...</p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role={role}>
            <div className="space-y-8 animate-fade-in pb-10">
                
                {/* --- HEADER CHÀO MỪNG --- */}
                <div className="mb-4">
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                        Chào mừng, <span className="text-primary">{userName || 'User'}!</span>
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">Bảng điều khiển {roleTitle} | Tổng quan hoạt động hôm nay.</p>
                </div>

                {/* --- 1. LƯỚI THỐNG KÊ (STATS GRID) --- */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    
                    {/* Thẻ 1: Tổng Công Việc */}
                    <Card className="shadow-lg border-l-4 border-l-primary hover:shadow-xl transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tổng Công Việc</CardTitle>
                            <FileText className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.totalTasks}</div>
                            <p className="text-xs text-muted-foreground mt-1">{stats.pendingTasks} đang chờ</p>
                        </CardContent>
                    </Card>

                    {/* Thẻ 2: Hoàn thành */}
                    <Card className="shadow-lg border-l-4 border-l-green-500 hover:shadow-xl transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Hoàn thành</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.completedTasks}</div>
                            <div className="mt-3 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Tiến độ</span>
                                    <span className="font-semibold text-green-600">{taskCompletionRate}%</span>
                                </div>
                                <Progress value={taskCompletionRate} className="h-2 bg-green-200" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Thẻ 3: Điểm Danh */}
                    <Card className="shadow-lg border-l-4 border-l-yellow-500 hover:shadow-xl transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Điểm Danh</CardTitle>
                            <Clock className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="mt-1">
                                {stats.todayAttendance ? (
                                    <Badge className="bg-green-600 text-white hover:bg-green-700">Đã Check In</Badge>
                                ) : (
                                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">Chưa Check In</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">Trạng thái hôm nay</p>
                        </CardContent>
                    </Card>

                    {/* Thẻ 4: Ngày Phép (Nổi bật) */}
                    <Card className="shadow-lg border-l-4 border-l-blue-600 hover:shadow-xl transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ngày Phép</CardTitle>
                            <Calendar className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-700">{stats.leaveBalance}</div>
                            <p className="text-xs text-muted-foreground mt-1">ngày còn lại</p>
                        </CardContent>
                    </Card>
                    
                    {/* Thẻ cho Admin/Leader */}
                    {(role === 'admin' || role === 'bod') && (
                        <>
                            <Card className="shadow-lg border-l-4 border-l-indigo-500 hover:shadow-xl transition-shadow sm:col-span-1 md:col-span-1">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Tổng Nhân viên</CardTitle>
                                    <Users className="h-4 w-4 text-indigo-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">{stats.totalEmployees || 0}</div>
                                    <p className="text-xs text-muted-foreground mt-1">tài khoản hoạt động</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-lg border-l-4 border-l-red-500 hover:shadow-xl transition-shadow sm:col-span-1 md:col-span-1">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Phê duyệt Chờ</CardTitle>
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">{stats.pendingApprovals || 0}</div>
                                    <p className="text-xs text-muted-foreground mt-1">yêu cầu nghỉ phép/tài khoản chờ</p>
                                </CardContent>
                            </Card>
                        </>
                    )}

                </div>

                {/* --- 2. HÀNH ĐỘNG NHANH --- */}
                <Card className="shadow-lg mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                            <Zap className="h-5 w-5 text-primary" />
                            Hành Động Nhanh
                        </CardTitle>
                        <CardDescription>Truy cập các chức năng cốt lõi ngay lập tức.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            
                            {/* Nút 1: Điểm danh */}
                            <button 
                                className="group p-4 rounded-xl border-2 border-border hover:border-primary transition-shadow duration-300 text-left flex items-center justify-between bg-card"
                                onClick={() => navigate('/attendance')} 
                            >
                                <div className="flex items-center gap-3">
                                    <Clock className="h-6 w-6 text-primary shrink-0" />
                                    <div>
                                        <h4 className="font-semibold">Điểm danh</h4>
                                        <p className="text-sm text-muted-foreground">Ghi nhận thời gian làm việc</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </button>
                            
                            {/* Nút 2: Tạo Công Việc */}
                            <button 
                                className="group p-4 rounded-xl border-2 border-border hover:border-primary transition-shadow duration-300 text-left flex items-center justify-between bg-card"
                                onClick={() => navigate('/tasks/new')} 
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="h-6 w-6 text-primary shrink-0" />
                                    <div>
                                        <h4 className="font-semibold">Tạo Công Việc</h4>
                                        <p className="text-sm text-muted-foreground">Thêm nhiệm vụ mới</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </button>
                            
                            {/* Nút 3: Gửi Yêu cầu Nghỉ phép */}
                            <button 
                                className="group p-4 rounded-xl border-2 border-border hover:border-primary transition-shadow duration-300 text-left flex items-center justify-between bg-card"
                                onClick={() => navigate('/leave')} 
                            >
                                <div className="flex items-center gap-3">
                                    <Briefcase className="h-6 w-6 text-primary shrink-0" />
                                    <div>
                                        <h4 className="font-semibold">Nghỉ phép</h4>
                                        <p className="text-sm text-muted-foreground">Gửi yêu cầu nghỉ phép</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-primary" />
                            Hoạt Động Gần Đây
                        </CardTitle>
                        <CardDescription>Các cập nhật mới nhất</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 rounded-lg bg-secondary/50 border border-border text-center text-muted-foreground">
                            <p>Chưa có dữ liệu hoạt động gần đây.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default Dashboard;
