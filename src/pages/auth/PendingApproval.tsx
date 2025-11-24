import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Mail, AlertCircle, LogOut, RefreshCw, CheckCircle2 } from "lucide-react";

interface RegistrationStatus {
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  rejection_reason?: string;
  reapplication_count?: number;
  admin_approved_at?: string;
  hr_approved_at?: string;
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

      // Check if account is approved
      if (userProfile?.account_status === 'APPROVED') {
        navigate('/dashboard');
        return;
      }

      // Fetch registration status
      const { data: regData } = await supabase
        .from('user_registrations')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (regData) {
        setRegistration({
          status: regData.status,
          rejection_reason: regData.rejection_reason,
          reapplication_count: regData.reapplication_count,
          created_at: regData.created_at,
          admin_approved_at: regData.admin_approved_at,
          hr_approved_at: regData.hr_approved_at
        });
      }

      setLoading(false);
    };

    checkStatus();

    return () => {
      // Cleanup
    };
  }, [navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const currentUser = await getCurrentUser();
    if (currentUser) {
      const userProfile = await getUserProfile(currentUser.id);
      setProfile(userProfile);

      if (userProfile?.account_status === 'APPROVED') {
        navigate('/dashboard');
      } else {
        const { data: regData } = await supabase
          .from('user_registrations')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        if (regData) {
          setRegistration({
            status: regData.status,
            rejection_reason: regData.rejection_reason,
            reapplication_count: regData.reapplication_count,
            created_at: regData.created_at,
            admin_approved_at: regData.admin_approved_at,
            hr_approved_at: regData.hr_approved_at
          });
        }
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

  const isRejected = profile?.account_status === 'REJECTED';
  const adminApproved = registration?.admin_approved_at !== null && registration?.admin_approved_at !== undefined;
  const hrApproved = registration?.hr_approved_at !== null && registration?.hr_approved_at !== undefined;
  const fullyApproved = adminApproved && hrApproved;

  const daysWaiting = registration?.created_at
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
            {isRejected ? (
              <AlertCircle className="h-6 w-6" />
            ) : fullyApproved ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <Clock className="h-6 w-6" />
            )}
            <CardTitle className="text-2xl">
              {isRejected 
                ? 'Tài Khoản Bị Từ Chối' 
                : fullyApproved 
                ? 'Tài Khoản Đã Được Phê Duyệt' 
                : 'Tài Khoản Đang Chờ Phê Duyệt'}
            </CardTitle>
          </div>
          <CardDescription className="text-blue-100">
            {isRejected
              ? 'Yêu cầu của bạn không được phê duyệt. Vui lòng xem lý do bên dưới.'
              : fullyApproved
              ? 'Tài khoản của bạn đã được phê duyệt bởi cả Admin v�� HR. Bạn có thể truy cập hệ thống ngay bây giờ.'
              : 'Cảm ơn bạn đã đăng ký! Tài khoản của bạn đang được xem xét bởi Admin và HR.'}
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
                  <span className="font-medium">Họ Tên:</span> {profile.first_name && profile.last_name 
                    ? `${profile.last_name} ${profile.first_name}` 
                    : 'Chưa cập nhật'}
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

          {/* Approval Status - Dual Approval System */}
          {!isRejected && !fullyApproved && (
            <>
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <Clock className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                    Quy Trình Phê Duyệt Hai Cấp
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                    Tài khoản của bạn cần được phê duyệt bởi cả <strong>Admin</strong> và <strong>HR</strong> trước khi có thể truy cập hệ thống.
                  </p>

                  {/* Approval Status Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 mt-4">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        {adminApproved ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          Phê Duyệt Admin
                        </span>
                      </div>
                      {adminApproved ? (
                        <p className="text-xs text-green-700 dark:text-green-300">
                          ✓ Đã phê duyệt
                        </p>
                      ) : (
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          Chờ phê duyệt
                        </p>
                      )}
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        {hrApproved ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          Phê Duyệt HR
                        </span>
                      </div>
                      {hrApproved ? (
                        <p className="text-xs text-green-700 dark:text-green-300">
                          ✓ Đã phê duyệt
                        </p>
                      ) : (
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          Chờ phê duyệt
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-4">
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
                      Chúng tôi sẽ gửi email cho bạn khi tài khoản được phê duyệt bởi cả Admin và HR. Hãy chắc chắn kiểm tra cả thư mục Spam.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Fully Approved Message */}
          {fullyApproved && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <p className="font-medium text-green-900 dark:text-green-100 mb-2">
                  Tài Khoản Đã Được Phê Duyệt
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Cảm ơn bạn! Tài khoản của bạn đã được phê duyệt bởi cả Admin và HR. Nhấn nút "Chuyển Đến Dashboard" để truy cập hệ thống.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Rejection Reason */}
          {isRejected && (
            <>
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

          <div className="flex gap-3 flex-wrap">
            {fullyApproved && (
              <Button
                onClick={() => navigate('/dashboard')}
                className="bg-green-600 hover:bg-green-700"
              >
                Chuyển Đến Dashboard
              </Button>
            )}
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
