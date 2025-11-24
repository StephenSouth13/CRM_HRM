import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser, getUserRole, updatePassword } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Settings, Bell, Eye, Lock, Palette, Save, LogOut, Download, 
  AlertTriangle, Clock, Smartphone, MapPin, CheckCircle2, X,
  Mail, Smartphone as SmartphoneIcon, Globe, Calendar, Home
} from "lucide-react";
import { UserRole } from "@/lib/auth";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('staff');
  const [user, setUser] = useState<any>(null);

  // Dialog states
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Form states
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [settings, setSettings] = useState({
    theme: localStorage.getItem('theme') || 'system',
    language: localStorage.getItem('language') || 'vi',
    timezone: localStorage.getItem('timezone') || 'Asia/Ho_Chi_Minh',
    defaultPage: localStorage.getItem('defaultPage') || 'dashboard',
    notifications: JSON.parse(localStorage.getItem('notificationSettings') || '{"email": true, "push": true, "inApp": true}'),
    notificationEvents: JSON.parse(localStorage.getItem('notificationEvents') || '{"taskAssigned": true, "taskUpdated": true, "comments": true, "deadlineReminder": true}'),
    quietHours: JSON.parse(localStorage.getItem('quietHours') || '{"enabled": false, "start": "22:00", "end": "08:00"}'),
    twoFAEnabled: localStorage.getItem('twoFAEnabled') === 'true',
    securityAlerts: JSON.parse(localStorage.getItem('securityAlerts') || '{"newDevice": true, "newLocation": true}'),
  });

  // Mock active sessions
  const [activeSessions] = useState([
    { id: 1, device: 'Chrome - Windows 10', location: 'Hà Nội, VN', lastActivity: '2 phút trước', current: true },
    { id: 2, device: 'Safari - iPhone 13', location: 'Hà Nội, VN', lastActivity: '2 giờ trước', current: false },
  ]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          navigate('/auth/login');
          return;
        }

        setUser(currentUser);
        const userRole = await getUserRole(currentUser.id);
        setRole(userRole);
        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        navigate('/auth/login');
      }
    };

    checkAuth();
  }, [navigate]);

  // ===== SECURITY HANDLERS =====
  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng điền tất cả các trường." });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ variant: "destructive", title: "Lỗi", description: "Mật khẩu mới không khớp." });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({ variant: "destructive", title: "Lỗi", description: "Mật khẩu phải có ít nhất 6 ký tự." });
      return;
    }

    try {
      const { error } = await updatePassword(passwordForm.newPassword);
      if (error) throw error;

      toast({ title: "Thành công", description: "Mật khẩu của bạn đã được thay đổi." });
      setShowPasswordDialog(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast({ variant: "destructive", title: "Lỗi", description: (error as Error).message });
    }
  };

  const handleToggle2FA = () => {
    if (!settings.twoFAEnabled) {
      setShow2FADialog(true);
    } else {
      setSettings(prev => ({ ...prev, twoFAEnabled: false }));
      localStorage.setItem('twoFAEnabled', 'false');
      toast({ title: "Thành công", description: "Xác thực hai yếu tố đã được tắt." });
    }
  };

  const handleEnable2FA = () => {
    setSettings(prev => ({ ...prev, twoFAEnabled: true }));
    localStorage.setItem('twoFAEnabled', 'true');
    toast({ title: "Thành công", description: "Xác thực hai yếu tố đã được bật." });
    setShow2FADialog(false);
  };

  const handleSignOutDevice = (sessionId: number) => {
    toast({ title: "Thành công", description: "Thiết bị đã được đăng xuất." });
  };

  const handleSignOutEverywhere = () => {
    toast({ title: "Thành công", description: "Bạn đã được đăng xuất khỏi tất cả thiết bị." });
  };

  // ===== NOTIFICATION HANDLERS =====
  const handleThemeChange = (value: string) => {
    setSettings(prev => ({ ...prev, theme: value }));
    localStorage.setItem('theme', value);
  };

  const handleLanguageChange = (value: string) => {
    setSettings(prev => ({ ...prev, language: value }));
    localStorage.setItem('language', value);
  };

  const handleTimezoneChange = (value: string) => {
    setSettings(prev => ({ ...prev, timezone: value }));
    localStorage.setItem('timezone', value);
  };

  const handleDefaultPageChange = (value: string) => {
    setSettings(prev => ({ ...prev, defaultPage: value }));
    localStorage.setItem('defaultPage', value);
  };

  const handleNotificationChannelToggle = (channel: 'email' | 'push' | 'inApp') => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [channel]: !prev.notifications[channel] }
    }));
    localStorage.setItem('notificationSettings', JSON.stringify({
      ...settings.notifications,
      [channel]: !settings.notifications[channel]
    }));
  };

  const handleNotificationEventToggle = (event: 'taskAssigned' | 'taskUpdated' | 'comments' | 'deadlineReminder') => {
    setSettings(prev => ({
      ...prev,
      notificationEvents: { ...prev.notificationEvents, [event]: !prev.notificationEvents[event] }
    }));
    localStorage.setItem('notificationEvents', JSON.stringify({
      ...settings.notificationEvents,
      [event]: !settings.notificationEvents[event]
    }));
  };

  const handleQuietHoursToggle = () => {
    setSettings(prev => ({
      ...prev,
      quietHours: { ...prev.quietHours, enabled: !prev.quietHours.enabled }
    }));
    localStorage.setItem('quietHours', JSON.stringify({
      ...settings.quietHours,
      enabled: !settings.quietHours.enabled
    }));
  };

  const handleSecurityAlertToggle = (alert: 'newDevice' | 'newLocation') => {
    setSettings(prev => ({
      ...prev,
      securityAlerts: { ...prev.securityAlerts, [alert]: !prev.securityAlerts[alert] }
    }));
    localStorage.setItem('securityAlerts', JSON.stringify({
      ...settings.securityAlerts,
      [alert]: !settings.securityAlerts[alert]
    }));
  };

  // ===== DATA MANAGEMENT HANDLERS =====
  const handleExportData = async () => {
    try {
      const dataToExport = {
        user: user,
        exportDate: new Date().toISOString(),
        settings: settings,
      };

      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-data-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Thành công", description: "Dữ liệu của bạn đã được tải xuống." });
    } catch (error) {
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể tải xuống dữ liệu." });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'Xóa tài khoản của tôi') {
      toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng xác nhận bằng cách nhập đúng văn bản." });
      return;
    }

    try {
      toast({ title: "Yêu cầu đã gửi", description: "Yêu cầu xóa tài khoản của bạn sẽ được xem xét bởi Admin." });
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    } catch (error) {
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể xóa tài khoản." });
    }
  };

  if (loading) {
    return (
      <DashboardLayout role={role}>
        <div className="p-6 text-center">Đang tải...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-8 pb-10 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Cài Đặt
          </h1>
          <p className="text-muted-foreground mt-2">Quản lý bảo mật, thông báo, giao diện và dữ liệu cá nhân của bạn</p>
        </div>

        {/* ===== 1. SECURITY & LOGIN ===== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">🔒 Bảo Mật & Đăng Nhập</h2>
          </div>

          {/* Change Password */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Thay Đổi Mật Khẩu</CardTitle>
              <CardDescription>Cập nhật mật khẩu của tài khoản</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowPasswordDialog(true)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Thay Đổi Mật Khẩu
              </Button>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Xác Thực Hai Yếu Tố (2FA)</CardTitle>
              <CardDescription>Tăng cường bảo mật tài khoản với mã bảo mật bổ sung</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Trạng thái 2FA</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.twoFAEnabled ? '✓ Đã bật' : '✗ Chưa bật'}
                  </p>
                </div>
                <Switch
                  checked={settings.twoFAEnabled}
                  onCheckedChange={handleToggle2FA}
                />
              </div>
              {settings.twoFAEnabled && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    Xác thực hai yếu tố đã được bật. Bạn sẽ được yêu cầu nhập mã từ ứng dụng authenticator khi đăng nhập.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Quản Lý Thiết Bị & Phiên Hoạt Động</CardTitle>
              <CardDescription>Xem và quản lý các thiết bị đang đăng nhập</CardDescription>
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
                    {session.current && (
                      <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Thiết bị hiện tại
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Hoạt động lần cuối: {session.lastActivity}
                  </p>
                  {!session.current && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleSignOutDevice(session.id)}
                    >
                      <LogOut className="h-3 w-3 mr-1" />
                      Đăng Xuất
                    </Button>
                  )}
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

          {/* Security Alerts */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Cảnh Báo Bảo Mật</CardTitle>
              <CardDescription>Nhận thông báo về hoạt động đáng ngờ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Đăng nhập từ thiết bị mới</p>
                  <p className="text-sm text-muted-foreground">Gửi email khi phát hiện đăng nhập từ thiết bị mới</p>
                </div>
                <Switch
                  checked={settings.securityAlerts.newDevice}
                  onCheckedChange={() => handleSecurityAlertToggle('newDevice')}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Đăng nhập từ vị trí mới</p>
                  <p className="text-sm text-muted-foreground">Gửi email khi phát hiện đăng nhập từ vị trí mới</p>
                </div>
                <Switch
                  checked={settings.securityAlerts.newLocation}
                  onCheckedChange={() => handleSecurityAlertToggle('newLocation')}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== 2. NOTIFICATIONS ===== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">🔔 Cài Đặt Thông Báo</h2>
          </div>

          {/* Notification Channels */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Kênh Thông Báo</CardTitle>
              <CardDescription>Chọn cách bạn muốn nhận thông báo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Thông báo qua Email
                  </p>
                  <p className="text-sm text-muted-foreground">Nhận thông báo qua email</p>
                </div>
                <Switch
                  checked={settings.notifications.email}
                  onCheckedChange={() => handleNotificationChannelToggle('email')}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Thông báo Trên Trình Duyệt
                  </p>
                  <p className="text-sm text-muted-foreground">Nhận thông báo web push</p>
                </div>
                <Switch
                  checked={settings.notifications.push}
                  onCheckedChange={() => handleNotificationChannelToggle('push')}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Thông báo Trong Ứng Dụng
                  </p>
                  <p className="text-sm text-muted-foreground">Nhận thông báo bên trong ứng dụng</p>
                </div>
                <Switch
                  checked={settings.notifications.inApp}
                  onCheckedChange={() => handleNotificationChannelToggle('inApp')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Events */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Tùy Chỉnh Sự Kiện</CardTitle>
              <CardDescription>Chọn những sự kiện nào kích hoạt thông báo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <p className="font-medium">Công việc được giao cho tôi</p>
                <Switch
                  checked={settings.notificationEvents.taskAssigned}
                  onCheckedChange={() => handleNotificationEventToggle('taskAssigned')}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <p className="font-medium">Công việc tôi tạo được cập nhật</p>
                <Switch
                  checked={settings.notificationEvents.taskUpdated}
                  onCheckedChange={() => handleNotificationEventToggle('taskUpdated')}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <p className="font-medium">Có bình luận mới trong công việc liên quan</p>
                <Switch
                  checked={settings.notificationEvents.comments}
                  onCheckedChange={() => handleNotificationEventToggle('comments')}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <p className="font-medium">Nhắc nhở về deadline</p>
                <Switch
                  checked={settings.notificationEvents.deadlineReminder}
                  onCheckedChange={() => handleNotificationEventToggle('deadlineReminder')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Giờ Im Lặng (Không Làm Phiền)</CardTitle>
              <CardDescription>Đặt khoảng thời gian không nhận thông báo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Bật Giờ Im Lặng</p>
                  <p className="text-sm text-muted-foreground">Không gửi thông báo trong khoảng thời gian này</p>
                </div>
                <Switch
                  checked={settings.quietHours.enabled}
                  onCheckedChange={handleQuietHoursToggle}
                />
              </div>

              {settings.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="quiet-start">Bắt đầu</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={settings.quietHours.start}
                      onChange={(e) => {
                        const newSettings = { ...settings, quietHours: { ...settings.quietHours, start: e.target.value } };
                        setSettings(newSettings);
                        localStorage.setItem('quietHours', JSON.stringify(newSettings.quietHours));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet-end">Kết thúc</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={settings.quietHours.end}
                      onChange={(e) => {
                        const newSettings = { ...settings, quietHours: { ...settings.quietHours, end: e.target.value } };
                        setSettings(newSettings);
                        localStorage.setItem('quietHours', JSON.stringify(newSettings.quietHours));
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== 3. APP PREFERENCES ===== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">🎨 Tùy Chỉnh Ứng Dụng</h2>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Giao Diện & Ngôn Ngữ</CardTitle>
              <CardDescription>Cá nhân hóa trải nghiệm của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme-select">Chế Độ Giao Diện</Label>
                <Select value={settings.theme} onValueChange={handleThemeChange}>
                  <SelectTrigger id="theme-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">☀️ Sáng (Light)</SelectItem>
                    <SelectItem value="dark">🌙 Tối (Dark)</SelectItem>
                    <SelectItem value="system">🖥️ Theo Hệ Thống</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language-select">Ngôn Ngữ Hiển Thị</Label>
                <Select value={settings.language} onValueChange={handleLanguageChange}>
                  <SelectTrigger id="language-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vi">🇻🇳 Tiếng Việt</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone-select">Múi Giờ</Label>
                <Select value={settings.timezone} onValueChange={handleTimezoneChange}>
                  <SelectTrigger id="timezone-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Ho_Chi_Minh">UTC+7 - Việt Nam (Hà Nội)</SelectItem>
                    <SelectItem value="Asia/Bangkok">UTC+7 - Bangkok</SelectItem>
                    <SelectItem value="Asia/Singapore">UTC+8 - Singapore</SelectItem>
                    <SelectItem value="Asia/Hong_Kong">UTC+8 - Hong Kong</SelectItem>
                    <SelectItem value="Asia/Tokyo">UTC+9 - Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-page-select">Trang Chủ Mặc Định</Label>
                <Select value={settings.defaultPage} onValueChange={handleDefaultPageChange}>
                  <SelectTrigger id="default-page-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dashboard">
                      <Home className="h-4 w-4 inline mr-2" />
                      Dashboard
                    </SelectItem>
                    <SelectItem value="tasks">
                      <Calendar className="h-4 w-4 inline mr-2" />
                      Công Việc (Kanban)
                    </SelectItem>
                    <SelectItem value="calendar">
                      <Calendar className="h-4 w-4 inline mr-2" />
                      Lịch
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== 4. DATA & ACCOUNT MANAGEMENT ===== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">🗑️ Quản Lý Dữ Liệu & Tài Khoản</h2>
          </div>

          {/* Export Data */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Xuất Dữ Liệu</CardTitle>
              <CardDescription>Tải xuống bản sao dữ liệu cá nhân của bạn</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleExportData}
              >
                <Download className="mr-2 h-4 w-4" />
                Xuất Dữ Liệu Của Tôi (JSON)
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Dữ liệu sẽ được tải xuống dưới dạng file JSON chứa thông tin cá nhân và các cài đặt của bạn.
              </p>
            </CardContent>
          </Card>

          {/* Delete Account */}
          <Card className="shadow-lg border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Xóa Tài Khoản
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
                Xóa Tài Khoản Của Tôi
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== DIALOGS ===== */}

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thay Đổi Mật Khẩu</DialogTitle>
            <DialogDescription>Nhập mật khẩu cũ và mật khẩu mới</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="old-password">Mật Khẩu Cũ</Label>
              <Input
                id="old-password"
                type="password"
                placeholder="Nhập mật khẩu cũ"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Mật Khẩu Mới</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Nhập mật khẩu mới"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Xác Nhận Mật Khẩu</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Xác nhận mật khẩu mới"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleChangePassword} className="bg-primary">
              Thay Đổi Mật Khẩu
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thiết Lập Xác Thực Hai Yếu Tố</DialogTitle>
            <DialogDescription>Quét mã QR bằng ứng dụng authenticator</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Hãy lưu các mã khôi phục ở nơi an toàn. Chúng có thể được sử dụng nếu bạn mất quyền truy cập vào ứng dụng authenticator.
              </AlertDescription>
            </Alert>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">Mã QR sẽ hiển thị ở đây</p>
              <div className="bg-white dark:bg-gray-900 p-4 rounded inline-block">
                <div className="w-32 h-32 bg-gray-200 rounded flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">QR Code</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" onClick={() => setShow2FADialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleEnable2FA} className="bg-primary">
              Xác Nhận & Bật 2FA
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa Tài Khoản Vĩnh Viễn?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn. Vui lòng xác nhận bằng cách nhập: "Xóa tài khoản của tôi"
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
              Xóa Tài Khoản
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default SettingsPage;
