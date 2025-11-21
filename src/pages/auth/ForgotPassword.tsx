import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { resetPasswordRequest, updatePassword } from "@/lib/auth";
import { Loader2, ArrowLeft } from "lucide-react";

const APP_NAME = "MSC Center - HRM AI";
const LOGO_PATH = "/LOGO.PNG";

type ForgotPasswordStep = "email" | "otp" | "newpassword" | "success";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<ForgotPasswordStep>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await resetPasswordRequest(email);

      if (error) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message
        });
        return;
      }

      setResetEmail(email);
      setStep("otp");
      toast({
        title: "Gửi Email Thành Công",
        description: "Vui lòng kiểm tra email của bạn để lấy mã xác nhận."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi Hệ thống",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Mật khẩu xác nhận không khớp"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Mật khẩu phải có ít nhất 6 ký tự"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: error.message
        });
        return;
      }

      setStep("success");
      toast({
        title: "Thành Công",
        description: "Mật khẩu của bạn đã được thay đổi."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi Hệ thống",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md animate-fade-in">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img 
              src={LOGO_PATH} 
              alt="Logo Tổ chức" 
              className="w-16 h-16 rounded-xl shadow-xl shadow-primary/30 object-contain"
            />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-foreground">
              {APP_NAME}
            </h1>
          </div>
        </div>

        {/* Card */}
        <Card className="shadow-2xl border-2 border-border/70">
          {step === "email" && (
            <>
              <CardHeader className="pt-6">
                <CardTitle className="text-2xl text-center">Quên Mật Khẩu</CardTitle>
                <CardDescription className="text-center">
                  Nhập địa chỉ email của bạn để nhận mã xác nhận
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="example@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-10 text-base gradient-primary shadow-lg shadow-primary/30" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang gửi...
                      </>
                    ) : (
                      "Gửi Mã Xác Nhận"
                    )}
                  </Button>

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => navigate('/auth/login')}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Quay Lại Đăng Nhập
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {step === "otp" && (
            <>
              <CardHeader className="pt-6">
                <CardTitle className="text-2xl text-center">Xác Nhận Mã OTP</CardTitle>
                <CardDescription className="text-center">
                  Mã xác nhận đã được gửi đến {resetEmail}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={() => setStep("newpassword")} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Mã Xác Nhận</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Nhập mã 6 chữ số"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      disabled={isLoading}
                      maxLength={6}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-10 text-base gradient-primary shadow-lg shadow-primary/30" 
                    disabled={isLoading || otp.length !== 6}
                  >
                    Tiếp Tục
                  </Button>

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => setStep("email")}
                    >
                      Quay Lại
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {step === "newpassword" && (
            <>
              <CardHeader className="pt-6">
                <CardTitle className="text-2xl text-center">Mật Khẩu Mới</CardTitle>
                <CardDescription className="text-center">
                  Vui lòng nhập mật khẩu mới của bạn
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Mật Khẩu Mới</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">Tối thiểu 6 ký tự</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Xác Nhận Mật Khẩu</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={6}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-10 text-base gradient-primary shadow-lg shadow-primary/30" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang cập nhật...
                      </>
                    ) : (
                      "Cập Nhật Mật Khẩu"
                    )}
                  </Button>

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => setStep("email")}
                    >
                      Bắt Đầu Lại
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {step === "success" && (
            <>
              <CardHeader className="pt-6">
                <div className="flex justify-center mb-4">
                  <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
                    <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <CardTitle className="text-2xl text-center">Thành Công!</CardTitle>
                <CardDescription className="text-center">
                  Mật khẩu của bạn đã đư��c thay đổi thành công.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full h-10 text-base gradient-primary shadow-lg shadow-primary/30" 
                  onClick={() => navigate('/auth/login')}
                >
                  Quay Lại Đăng Nhập
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
