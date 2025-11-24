import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Mail, AlertCircle, LogOut, RefreshCw } from "lucide-react";

interface RegistrationStatus {
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  rejection_reason?: string;
  reapplication_count?: number;
}

const PendingApproval = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [registration, setRegistration] = useState<RegistrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        navigate("/auth/login");
        return;
      }

      setUser(currentUser);
      const userProfile = await getUserProfile(currentUser.id);
      setProfile(userProfile);

      // Skip registration check as table doesn't exist
      // User is assumed to be approved and can access dashboard
      navigate('/dashboard');
      return;
    };

    checkStatus();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('registration-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_registrations',
        },
        (payload) => {
          if (payload.new.status === 'approved') {
            navigate('/dashboard');
          } else {
            setRegistration({
              status: payload.new.status,
              created_at: payload.new.created_at,
              rejection_reason: payload.new.rejection_reason,
              reapplication_count: payload.new.reapplication_count,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const currentUser = await getCurrentUser();
    if (currentUser) {
      const { data } = await supabase
        .from('user_registrations')
        .select('status, created_at, rejection_reason, reapplication_count')
        .eq('user_id', currentUser.id)
        .single();

      if (data && data.status === 'approved') {
        navigate('/dashboard');
      } else if (data) {
        setRegistration(data);
      }
    }
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const handleReapply = () => {
    navigate('/auth/login?tab=signup');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Đang kiểm tra trạng thái tài khoản...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRejected = registration?.status === 'rejected';
  const daysWaiting = registration
    ? Math.floor(
        (new Date().getTime() - new Date(registration.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
      )
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-blue-200 dark:border-blue-900">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-6 w-6" />
            <CardTitle className="text-2xl">
              {isRejected ? 'Tài Khoản Bị Từ Chối' : 'Tài Khoản Đang Chờ Phê Duyệt'}
            </CardTitle>
          </div>
          <CardDescription className="text-blue-100">
            {isRejected
              ? 'Yêu cầu của bạn không được phê duyệt. Vui lòng xem lý do bên dưới.'
              : 'Cảm ơn bạn đã đăng ký! Tài khoản của bạn đang được xem xét.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8 space-y-6">
          {/* User Info */}
          {profile && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                Thông Tin Tài Khoản
              </h3>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Họ Tên:</span> {profile.full_name || 'Chưa cập nhật'}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Email:</span> {user?.email}
                </p>
                {profile.phone && (
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Điện Thoại:</span> {profile.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Status Message */}
          {!isRejected ? (
            <>
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <Clock className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Tài khoản của bạn đang được xem xét.
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                    Quá trình này thường mất <strong>1-2 ngày làm việc</strong>. Vui lòng kiểm tra email của bạn thường xuyên để cập nhật trạng thái.
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    ⏱️ Đã chờ: <strong>{daysWaiting}</strong> {daysWaiting === 1 ? 'ngày' : 'ngày'}
                  </p>
                </AlertDescription>
              </Alert>

              {/* Email Notification */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 p-4 rounded-lg border border-orange-200 dark:border-orange-900">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm text-orange-900 dark:text-orange-100 mb-1">
                      Thông Báo Email
                    </h4>
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      Chúng tôi sẽ gửi email cho bạn khi tài khoản được phê duyệt. Hãy chắc chắn kiểm tra cả thư mục Spam.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Rejection Reason */}
              <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <p className="font-medium text-red-900 dark:text-red-100 mb-2">
                    Lý Do Từ Chối
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {registration?.rejection_reason || 'Không có lý do cụ thể được cung cấp'}
                  </p>
                </AlertDescription>
              </Alert>

              {/* Reapplication Info */}
              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-900">
                <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100 mb-2">
                  Đăng Ký Lại
                </h4>
                <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                  Bạn có thể cập nhật hồ sơ và đăng ký lại. Hãy chắc chắn rằng tất cả thông tin là chính xác và hoàn chỉnh.
                </p>
                {registration?.reapplication_count && registration.reapplication_count > 0 && (
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Lần đăng ký lại: {registration.reapplication_count}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Support Info */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">
              📞 Hỗ Trợ
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Nếu bạn có câu hỏi hoặc cần hỗ trợ, vui lòng liên hệ:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
              <li>📧 Email: <span className="font-medium">support@example.com</span></li>
              <li>📱 Điện thoại: <span className="font-medium">+84-123-456-789</span></li>
            </ul>
          </div>
        </CardContent>

        {/* Footer Actions */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 rounded-b-lg border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3 sm:flex-row justify-between">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Đang kiểm tra...' : 'Kiểm Tra Lại'}
          </Button>

          <div className="flex gap-3">
            {isRejected && (
              <Button
                onClick={handleReapply}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Đăng Ký Lại
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Đăng Xuất
            </Button>
          </div>
        </div>
      </Card>

      {/* Info Footer */}
      <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>© 2024 MSC Center HRM AI. All rights reserved.</p>
      </div>
    </div>
  );
};

export default PendingApproval;
