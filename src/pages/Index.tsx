import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getUserProfile } from "@/lib/auth";

// --- Custom Constants ---
const APP_NAME = "LifeOS HRM AI";
const LOGO_PATH = "/LOGO.PNG";

const Index = () => {
  const navigate = useNavigate();

  // Logic Redirect: Chuyển hướng người dùng dựa trên trạng thái tài khoản
  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser();
      if (user) {
        // Check account status
        const profile = await getUserProfile(user.id);
        if (profile?.account_status === 'APPROVED') {
          // User is approved, go to dashboard
          navigate("/dashboard");
        } else if (profile?.account_status === 'PENDING' || profile?.account_status === 'REJECTED') {
          // User is pending or rejected, redirect to pending approval page
          navigate("/auth/pending-approval");
        }
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    // Sử dụng layout flexbox để căn giữa nội dung hoàn toàn trên màn hình
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 font-sans p-4">
      
      <div className="flex flex-col items-center max-w-md w-full bg-white dark:bg-gray-800 p-8 md:p-10 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-fade-in-down">
        
        {/* Logo and App Name */}
        <div className="flex flex-col items-center gap-4 mb-8">
            <img 
                src={LOGO_PATH} 
                alt={`${APP_NAME} Logo`} 
                className="w-24 h-24 rounded-full object-cover shadow-xl shadow-primary/30 ring-4 ring-primary/20"
            />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white tracking-wide text-center">
                Chào mừng đến với <span className="text-primary">{APP_NAME}</span>
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 text-center">
              Vui lòng Đăng nhập hoặc Đăng ký để truy cập hệ thống.
            </p>
        </div>
        
        {/* Buttons - Căn giữa, chiếm toàn bộ chiều rộng (w-full) trên mobile */}
        <div className="flex flex-col gap-4 w-full">
          
          {/* Button 1: Đăng ký */}
          <Button 
            size="lg" 
            className="w-full text-lg px-8 py-3 h-auto rounded-xl shadow-lg shadow-green-500/30 bg-green-600 hover:bg-green-700 transition-all duration-300 transform hover:scale-[1.01]"
            onClick={() => navigate("/auth/login")}
          >
            Đăng ký Tài khoản Mới
          </Button>

          {/* Button 2: Đăng nhập */}
          <Button 
            size="lg"
            variant="outline" 
            className="w-full text-lg px-8 py-3 h-auto rounded-xl border-2 border-primary/50 text-primary hover:bg-primary/10 transition-all duration-300"
            onClick={() => navigate("/auth/login")}
          >
            Đã có tài khoản? Đăng nhập
          </Button>
          
        </div>
      </div>
    </div>
  );
};

// CSS Animation for subtle entrance effect
const styles = `
/* Định nghĩa các màu sắc cơ bản cho Tailwind */
:root {
  --tw-color-primary: #3b82f6; /* Blue 500 */
  --tw-color-primary-glow: #60a5fa; /* Blue 400 */
}

.animate-fade-in-down {
  animation: fadeInDown 0.6s ease-out forwards;
}
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.gradient-primary {
    background-image: linear-gradient(135deg, var(--tw-color-primary) 0%, var(--tw-color-primary-glow) 100%);
}
`;

// Thêm style vào đây để đảm bảo Tailwind chạy đúng
const StyleInjector = () => (
  <style dangerouslySetInnerHTML={{ __html: styles }} />
);

// Component chính export App và StyleInjector (nếu cần)
// Chỉ export Index (theo yêu cầu của React file structure)
export default Index;
