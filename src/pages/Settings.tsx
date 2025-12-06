import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUser, getUserRole } from "@/lib/auth"; // Giả định getUserProfile/updatePassword được thay thế bằng hàm supabase trực tiếp
import { UserRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
    Lock, Bell, Moon, AlertCircle, CheckCircle2,
    Palette, Download, X, Clock, Smartphone as SmartphoneIcon, MapPin, LogOut, Eye,
    AlertTriangle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface NotificationSettings {
    email_new_tasks: boolean;
    email_approvals: boolean;
    email_daily_reports: boolean;
    in_app_notifications: boolean;
}

// Giả định bảng profiles có cột: notification_settings (JSONB) và theme_preference (TEXT)
// Giả định getCurrentUser trả về User object (có id và email)

const SettingsPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [role, setRole] = useState<UserRole>('staff');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>('');
    const [userEmail, setUserEmail] = useState<string>('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // --- Password & Security State ---
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    // --- Notifications State ---
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        email_new_tasks: true,
        email_approvals: true,
        email_daily_reports: true,
        in_app_notifications: true
    });
    const [notificationLoading, setNotificationLoading] = useState(false);

    // --- Theme State ---
    const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
    const [themeLoading, setThemeLoading] = useState(false);

    // Active Sessions from Supabase Auth
    const [activeSessions] = useState<Array<{ id: string; device: string; location: string | null; lastActivity: string; current: boolean }>>([]);


    // Apply theme to DOM
    const applyTheme = (theme: 'light' | 'dark' | 'system') => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
        } else {
            root.classList.add(theme);
        }
        localStorage.setItem('theme', theme);
    };


    // Load user data and settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                setLoading(true);

                // Get current user
                const user = await getCurrentUser();
                if (!user) {
                    navigate('/auth/login');
                    return;
                }

                setUserId(user.id);
                setUserEmail(user.email || '');

                // Get user role
                const userRole = await getUserRole(user.id);
                setRole(userRole);

                // Fetch profile with notification settings and theme preference
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('notification_settings, theme_preference')
                    .eq('id', user.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') throw profileError; // PGRST116: no rows found

                if (profileData) {
                    // Load notifications from DB
                    if (profileData.notification_settings) {
                        setNotificationSettings(profileData.notification_settings as NotificationSettings);
                    }
                    // Load theme from DB
                    if (profileData.theme_preference) {
                        const dbTheme = profileData.theme_preference as 'light' | 'dark' | 'system';
                        setThemePreference(dbTheme);
                        applyTheme(dbTheme);
                    }
                }
            } catch (error) {
                toast({
                    title: "Lỗi Tải Dữ Liệu",
                    description: (error as Error).message,
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [navigate, toast]);


    // Handle password change
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');

        // Validation
        if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            setPasswordError('Vui lòng nhập đầy đủ thông tin');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('Mật khẩu mới không khớp');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setPasswordError('Mật khẩu mới phải tối thiểu 6 ký tự');
            return;
        }

        try {
            setPasswordLoading(true);

            // 1. Re-authenticate (Sign in with old password) to verify credentials
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: userEmail,
                password: passwordData.oldPassword
            });

            if (signInError) {
                // IMPORTANT: In Supabase, updatePassword doesn't need the old password if the user is authenticated. 
                // But signing in first ensures the old password is correct.
                setPasswordError('Mật khẩu cũ không chính xác');
                return;
            }

            // 2. Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });

            if (updateError) throw updateError;

            toast({
                title: "Thành Công",
                description: "Mật khẩu của bạn đã được thay đổi",
            });

            setPasswordData({
                oldPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error) {
            setPasswordError((error as Error).message);
            toast({
                title: "Lỗi",
                description: (error as Error).message,
                variant: "destructive",
            });
        } finally {
            setPasswordLoading(false);
        }
    };

    // Handle notification settings change
    const handleNotificationChange = async (key: keyof NotificationSettings) => {
        const updatedSettings = {
            ...notificationSettings,
            [key]: !notificationSettings[key]
        };

        try {
            setNotificationLoading(true);

            const { error } = await supabase
                .from('profiles')
                .update({ notification_settings: updatedSettings as any }) // 'any' to bypass JSONB type warning if needed
                .eq('id', userId);

            if (error) throw error;

            setNotificationSettings(updatedSettings);

            toast({
                title: "Thành Công",
                description: "Cài đặt thông báo đã được cập nhật",
            });
        } catch (error) {
            toast({
                title: "Lỗi",
                description: (error as Error).message,
                variant: "destructive",
            });
        } finally {
            setNotificationLoading(false);
        }
    };

    // Handle theme change
    const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
        try {
            setThemeLoading(true);

            // Update in database
            const { error } = await supabase
                .from('profiles')
                .update({ theme_preference: newTheme })
                .eq('id', userId);

            if (error) throw error;

            // Apply theme and update state/localStorage
            setThemePreference(newTheme);
            applyTheme(newTheme);

            toast({
                title: "Thành Công",
                description: "Chế độ giao diện đã được thay đổi",
            });
        } catch (error) {
            toast({
                title: "Lỗi",
                description: (error as Error).message,
                variant: "destructive",
            });
        } finally {
            setThemeLoading(false);
        }
    };

    // Handle Delete Account Request
    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'Xóa tài khoản của tôi') {
            toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng xác nhận bằng cách nhập đúng văn bản." });
            return;
        }

        try {
            // Logic thực tế: Gửi yêu cầu xóa hoặc cập nhật trạng thái profiles.account_status = 'DELETE_REQUESTED'
            // Việc xóa chính thức sẽ do Admin/HR thực hiện.

            // Giả lập gửi yêu cầu:
            const { error } = await supabase
                .from('profiles')
                .update({ account_status: 'DELETE_REQUESTED' })
                .eq('id', userId);

            if (error) throw error;

            toast({ title: "Yêu cầu đã gửi", description: "Yêu cầu xóa tài khoản của bạn sẽ được xem xét bởi Admin." });
            setShowDeleteDialog(false);
            setDeleteConfirmText('');
            await supabase.auth.signOut();
            navigate('/auth/login');
        } catch (error) {
            toast({ variant: "destructive", title: "Lỗi", description: "Không thể gửi yêu cầu xóa tài khoản." });
        }
    };

    // --- Helper Functions ---
    const handleSignOutDevice = (sessionId: string) => {
        // Logic thực tế: Gọi Supabase API để vô hiệu hóa session
        toast({ title: "Thành công", description: `Thiết bị ID ${sessionId} đã được đăng xuất.` });
    };

    const handleSignOutEverywhere = async () => {
        await supabase.auth.signOut({ scope: 'global' });
        navigate('/auth/login');
        toast({ title: "Thành công", description: "Bạn đã được đăng xuất khỏi tất cả thiết bị." });
    };
    
    // --- Render ---

    if (loading) {
        return (
            <DashboardLayout role={role}>
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Đang tải cài đặt...</p>
                </div>
            </DashboardLayout>
        );
    }

    // Các phần tử UI nâng cao (Session/2FA) được tích hợp trong tab Security
    return (
        <DashboardLayout role={role}>
            <div className="space-y-6 animate-fade-in pb-20 md:pb-6 max-w-4xl">
                <div className="mb-6">
                    <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent text-2xl md:text-3xl lg:text-4xl">
                        Cài Đặt
                    </h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
                        Quản lý tài khoản, bảo mật, thông báo và giao diện
                    </p>
                </div>

                <Tabs defaultValue="security" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 md:grid-cols-4">
                        <TabsTrigger value="security" className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            <span className="hidden sm:inline">Bảo Mật</span>
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="flex items-center gap-2">
                            <Bell className="h-4 w-4" />
                            <span className="hidden sm:inline">Thông Báo</span>
                        </TabsTrigger>
                        <TabsTrigger value="theme" className="flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            <span className="hidden sm:inline">Giao Diện</span>
                        </TabsTrigger>
                        <TabsTrigger value="data" className="flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Dữ Liệu</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ===== 1. PASSWORD & SECURITY ===== */}
                    <TabsContent value="security" className="mt-6 space-y-6">
                        {/* Change Password Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Lock className="h-5 w-5" /> Mật Khẩu & Đăng Nhập
                                </CardTitle>
                                <CardDescription>
                                    Thay đổi mật khẩu tài khoản của bạn
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                                    {passwordError && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{passwordError}</AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="oldPassword">Mật Khẩu Cũ *</Label>
                                        <Input
                                            id="oldPassword"
                                            type="password"
                                            placeholder="Nhập mật khẩu hiện tại"
                                            value={passwordData.oldPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">Mật Khẩu Mới *</Label>
                                        <Input
                                            id="newPassword"
                                            type="password"
                                            placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Xác Nhận Mật Khẩu Mới *</Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="Nhập lại mật khẩu mới"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={passwordLoading}
                                        className="w-full"
                                    >
                                        {passwordLoading ? "Đang cập nhật..." : "Thay Đổi Mật Khẩu"}
                                    </Button>

                                    <p className="text-xs text-muted-foreground">
                                        Mật khẩu của bạn sẽ được mã hóa an toàn trên máy chủ.
                                    </p>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Active Sessions Card (MOCKUP) */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Quản Lý Phiên Hoạt Động</CardTitle>
                                <CardDescription>Các thiết bị đang đăng nhập bằng tài khoản của bạn</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activeSessions.map(session => (
                                    <div key={session.id} className="p-3 border rounded-lg space-y-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <SmartphoneIcon className="h-5 w-5 text-primary" />
                                                <div>
                                                    <p className="font-medium">{session.device}</p>
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" /> {session.location}
                                                    </p>
                                                </div>
                                            </div>
                                            {session.current ? (
                                                <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                                                    Thiết bị hiện tại
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="h-7 px-3 text-xs"
                                                    onClick={() => handleSignOutDevice(session.id)}
                                                >
                                                    <LogOut className="h-3 w-3 mr-1" /> Đăng Xuất
                                                </Button>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3 inline mr-1" />
                                            Hoạt động lần cuối: {session.lastActivity}
                                        </p>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleSignOutEverywhere}
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Đăng Xuất Khỏi Tất Cả Thiết Bị Khác
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ===== 2. NOTIFICATIONS ===== */}
                    <TabsContent value="notifications" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Bell className="h-5 w-5" /> Cài Đặt Thông Báo
                                </CardTitle>
                                <CardDescription>
                                    Quản lý các loại thông báo mà bạn nhận được
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Email Notifications */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">Thông Báo Email</h3>

                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-medium">Công Việc Mới</p>
                                            <p className="text-sm text-muted-foreground">
                                                Nhận thông báo khi được giao công việc mới
                                            </p>
                                        </div>
                                        <Switch
                                            checked={notificationSettings.email_new_tasks}
                                            onCheckedChange={() => handleNotificationChange('email_new_tasks')}
                                            disabled={notificationLoading}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-medium">Yêu Cầu Phê Duyệt</p>
                                            <p className="text-sm text-muted-foreground">
                                                Nhận thông báo khi có yêu cầu phê duyệt cần xử lý
                                            </p>
                                        </div>
                                        <Switch
                                            checked={notificationSettings.email_approvals}
                                            onCheckedChange={() => handleNotificationChange('email_approvals')}
                                            disabled={notificationLoading}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-medium">Báo Cáo Hàng Ngày</p>
                                            <p className="text-sm text-muted-foreground">
                                                Nhận tóm tắt hoạt động hàng ngày
                                            </p>
                                        </div>
                                        <Switch
                                            checked={notificationSettings.email_daily_reports}
                                            onCheckedChange={() => handleNotificationChange('email_daily_reports')}
                                            disabled={notificationLoading}
                                        />
                                    </div>
                                </div>

                                {/* In-App Notifications */}
                                <div className="space-y-4 border-t pt-6">
                                    <h3 className="font-semibold text-lg">Thông Báo Trong Ứng Dụng</h3>

                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-medium">Bật Thông Báo Trong App</p>
                                            <p className="text-sm text-muted-foreground">
                                                Hiển thị thông báo trong ứng dụng (badge, popup)
                                            </p>
                                        </div>
                                        <Switch
                                            checked={notificationSettings.in_app_notifications}
                                            onCheckedChange={() => handleNotificationChange('in_app_notifications')}
                                            disabled={notificationLoading}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ===== 3. THEME & UI ===== */}
                    <TabsContent value="theme" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Palette className="h-5 w-5" /> Chế Độ Giao Diện
                                </CardTitle>
                                <CardDescription>
                                    Chọn chế độ hiển thị sáng, tối hoặc theo cài đặt hệ thống.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        {/* Light Mode */}
                                        <div
                                            onClick={() => handleThemeChange('light')}
                                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                                                themePreference === 'light'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-muted-foreground'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold">Chế Độ Sáng</h3>
                                                {themePreference === 'light' && (
                                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Giao diện sáng (trắng)
                                            </p>
                                        </div>

                                        {/* Dark Mode */}
                                        <div
                                            onClick={() => handleThemeChange('dark')}
                                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                                                themePreference === 'dark'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-muted-foreground'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold">Chế Độ Tối</h3>
                                                {themePreference === 'dark' && (
                                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Giao diện tối (đen)
                                            </p>
                                        </div>

                                        {/* System */}
                                        <div
                                            onClick={() => handleThemeChange('system')}
                                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                                                themePreference === 'system'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-muted-foreground'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold">Theo Hệ Thống</h3>
                                                {themePreference === 'system' && (
                                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Theo cài đặt hệ thống
                                            </p>
                                        </div>
                                    </div>

                                    {themeLoading && (
                                        <p className="text-sm text-muted-foreground">Đang cập nhật...</p>
                                    )}

                                    <Alert>
                                        <AlertDescription>
                                            Chế độ giao diện được lưu trên cơ sở dữ liệu và sẽ được tải khi bạn đăng nhập lần tới.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ===== 4. DATA & ACCOUNT MANAGEMENT ===== */}
                    <TabsContent value="data" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Download className="h-5 w-5" /> Xuất Dữ Liệu
                                </CardTitle>
                                <CardDescription>
                                    Tải xuống bản sao dữ liệu cá nhân của bạn (cá nhân và các cài đặt).
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={async () => {
                                        try {
                                            // Implement data export functionality
                                            toast({ title: "Thông báo", description: "Tính năng xuất dữ liệu đang được phát triển. Vui lòng liên hệ support." });
                                        } catch (error) {
                                            toast({ title: "Lỗi", description: "Không thể xuất dữ liệu", variant: "destructive" });
                                        }
                                    }}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Xuất Dữ Liệu Của Tôi (JSON)
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Delete Account Card */}
                        <Card className="shadow-lg border-red-200 dark:border-red-800">
                            <CardHeader>
                                <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" /> Xóa Tài Khoản
                                </CardTitle>
                                <CardDescription>Xóa vĩnh viễn tài khoản của bạn</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Alert className="mb-4 border-red-200 bg-red-50 dark:bg-red-950">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                    <AlertDescription className="text-red-800 dark:text-red-200">
                                        Cảnh báo: Hành động này không thể hoàn tác. Tất cả dữ liệu của bạn sẽ bị xóa.
                                    </AlertDescription>
                                </Alert>
                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => setShowDeleteDialog(true)}
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Yêu Cầu Xóa Tài Khoản
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>

            {/* ===== DIALOGS ===== */}
            {/* Delete Account Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa Tài Khoản Vĩnh Viễn?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này sẽ gửi yêu cầu xóa tài khoản của bạn đến Admin/HR. Vui lòng xác nhận bằng cách nhập: **"Xóa tài khoản của tôi"**
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <Input
                            placeholder="Nhập 'Xóa tài khoản của tôi' để xác nhận"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleteConfirmText !== 'Xóa tài khoản của tôi'}
                        >
                            Gửi Yêu Cầu Xóa
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
};

export default SettingsPage;
