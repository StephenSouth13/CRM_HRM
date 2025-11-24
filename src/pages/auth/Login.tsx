import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUp, getCurrentUser, createUserRegistration } from "@/lib/auth";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client"; 

// --- Custom Constants ---
const APP_NAME = "MSC Center - HRM AI";
const LOGO_PATH = "/LOGO.PNG"; // Đường dẫn đến logo tổ ch��c

const DEPARTMENTS = [
    { value: "IT", label: "Công Nghệ Thông Tin" },
    { value: "HR", label: "Nhân Sự" },
    { value: "Sales", label: "Bán Hàng" },
    { value: "Marketing", label: "Marketing" },
    { value: "Design", label: "Thiết Kế" },
    { value: "Content", label: "Nội Dung" },
    { value: "Finance", label: "Tài Chính" },
];

const EMPLOYMENT_STATUS = [
    { value: "Employed", label: "Đang Làm Việc" },
    { value: "Student", label: "Sinh Viên" },
    { value: "Trainee", label: "Thực Tập Sinh" },
    { value: "Freelancer", label: "Freelancer" },
];

const Login = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Login state
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // Signup state
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupFirstName, setSignupFirstName] = useState("");
    const [signupLastName, setSignupLastName] = useState("");
    const [signupPhone, setSignupPhone] = useState("");
    const [signupDepartment, setSignupDepartment] = useState("");
    const [signupEmploymentStatus, setSignupEmploymentStatus] = useState("");
    const [cvFile, setCvFile] = useState<File | null>(null);

    // --- Logic: Kiểm tra Auth và Redirect ---
    useEffect(() => {
        const checkUser = async () => {
            const user = await getCurrentUser();
            if (user) {
                navigate("/dashboard");
            }
        };
        checkUser();
    }, [navigate]);

    // --- Handle CV File Upload ---
    const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type (PDF, DOC, DOCX)
            const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!validTypes.includes(file.type)) {
                toast({
                    variant: "destructive",
                    title: "Định dạng không hợp lệ",
                    description: "Vui lòng upload file PDF hoặc Word"
                });
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast({
                    variant: "destructive",
                    title: "File quá lớn",
                    description: "Kích thước file không được vượt quá 5MB"
                });
                return;
            }
            setCvFile(file);
        }
    };

    // --- Xử lý Đăng nhập ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await signIn(loginEmail, loginPassword);

            if (error) {
                toast({
                    variant: "destructive",
                    title: "Đăng nhập Thất bại",
                    description: error.message
                });
                return;
            }

            // Get current user and check account status
            const user = await getCurrentUser();
            if (!user) {
                navigate("/auth/login");
                return;
            }

            // Check account status from profile
            const profile = await import("@/lib/auth").then(m => m.getUserProfile(user.id));

            if (profile?.account_status !== 'APPROVED') {
                // Redirect to pending approval page
                navigate("/auth/pending-approval");
                return;
            }

            toast({
                title: "Chào mừng trở lại!",
                description: "Đăng nhập thành công..."
            });
            navigate("/dashboard");
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

    // --- Xử lý Đăng ký ---
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Validate required fields
            if (!signupFirstName || !signupLastName || !signupEmail || !signupPassword || !signupPhone) {
                toast({
                    variant: "destructive",
                    title: "Thông tin không đầy đủ",
                    description: "Vui lòng điền tên, họ, email, mật khẩu và số điện thoại"
                });
                setIsLoading(false);
                return;
            }

            // Validate password length
            if (signupPassword.length < 6) {
                toast({
                    variant: "destructive",
                    title: "Mật khẩu không hợp lệ",
                    description: "Mật khẩu phải có ít nhất 6 ký tự"
                });
                setIsLoading(false);
                return;
            }

            // Sign up user
            const { data: signupData, error: signupError } = await signUp(signupEmail, signupPassword, {
                first_name: signupFirstName,
                last_name: signupLastName,
                phone: signupPhone,
                department: signupDepartment || null,
                employment_status: signupEmploymentStatus || null
            });

            if (signupError) {
                toast({
                    variant: "destructive",
                    title: "Đăng ký Thất bại",
                    description: signupError.message
                });
                return;
            }

            if (!signupData.user) {
                toast({
                    variant: "destructive",
                    title: "Lỗi Đăng ký",
                    description: "Không thể tạo tài khoản. Vui lòng thử lại."
                });
                return;
            }

            // Upload CV if provided
            let cvUrl = null;
            if (cvFile) {
                const fileExt = cvFile.name.split('.').pop();
                const fileName = `${signupData.user.id}-cv.${fileExt}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('cv-files')
                    .upload(`registrations/${fileName}`, cvFile);

                if (uploadError) {
                    console.error('CV upload error:', uploadError);
                    // Continue without CV - not critical
                } else if (uploadData) {
                    cvUrl = uploadData.path;
                }
            }

            // Skip registration record as table doesn't exist
            // User is created and can log in directly

            toast({
                title: "✓ Đăng ký Thành công!",
                description: "Tài khoản của bạn đã được tạo. Vui lòng đăng nhập để chờ Admin phê duyệt."
            });

            // Clear signup form
            setSignupFirstName("");
            setSignupLastName("");
            setSignupEmail("");
            setSignupPassword("");
            setSignupPhone("");
            setSignupDepartment("");
            setSignupEmploymentStatus("");
            setCvFile(null);

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
            <div className="w-full max-w-lg animate-fade-in">
                
                {/* --- HEADER/LOGO --- */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <img 
                            src={LOGO_PATH} 
                            alt="Logo Tổ chức" 
                            className="w-16 h-16 rounded-xl shadow-xl shadow-primary/30 object-contain"
                        />
                        <h1 className="text-4xl font-extrabold tracking-tighter text-foreground">
                            {APP_NAME}
                        </h1>
                    </div>
                   
                </div>

                {/* --- LOGIN/SIGNUP CARD --- */}
                <Card className="shadow-2xl border-2 border-border/70 transform hover:shadow-primary/20 transition-all duration-300">
                    <Tabs defaultValue="login" className="w-full">
                        
                        {/* Tab Headers */}
                        <CardHeader className="pt-6 pb-0">
                            <TabsList className="grid w-full grid-cols-2 h-12 text-lg">
                                <TabsTrigger value="login">Đăng nhập</TabsTrigger>
                                {/* LỖI ĐÃ ĐƯỢC SỬA Ở ĐÂY */}
                                <TabsTrigger value="signup">Đăng ký</TabsTrigger> 
                            </TabsList>
                        </CardHeader>

                        {/* --- TAB CONTENT: ĐĂNG NHẬP --- */}
                        <TabsContent value="login">
                            <form onSubmit={handleLogin}>
                                <CardContent className="space-y-6 pt-6">
                                    <CardTitle className="text-2xl text-center">Chúc một ngày làm việc năng suất</CardTitle>
                                
                                    
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="login-email">Tài khoản</Label>
                                            <Input
                                                id="login-email"
                                                type="email"
                                                placeholder=""
                                                value={loginEmail}
                                                onChange={(e) => setLoginEmail(e.target.value)}
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="login-password">Mật khẩu</Label>
                                            <Input
                                                id="login-password"
                                                type="password"
                                                placeholder=""
                                                value={loginPassword}
                                                onChange={(e) => setLoginPassword(e.target.value)}
                                                required
                                                disabled={isLoading}
                                            />
                                            {/* Link Quên mật khẩu */}
                                            <p className="text-sm text-right text-primary hover:underline cursor-pointer pt-1" onClick={() => navigate("/auth/forgot-password")}>
                                                Quên mật khẩu?
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                                
                                <CardFooter>
                                    <Button type="submit" className="w-full h-10 text-base gradient-primary shadow-lg shadow-primary/30" disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Đang xử lý...
                                            </>
                                        ) : (
                                            "Đăng nhập"
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </TabsContent>

                        {/* --- TAB CONTENT: ĐĂNG KÝ --- */}
                        <TabsContent value="signup">
                            <form onSubmit={handleSignup}>
                                <CardContent className="space-y-6 pt-6 max-h-[calc(100vh-300px)] overflow-y-auto">

                                    {/* Name Fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-firstname">Họ *</Label>
                                            <Input
                                                id="signup-firstname"
                                                type="text"
                                                placeholder="Ví dụ: Nguyễn"
                                                value={signupFirstName}
                                                onChange={(e) => setSignupFirstName(e.target.value)}
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="signup-lastname">Tên *</Label>
                                            <Input
                                                id="signup-lastname"
                                                type="text"
                                                placeholder="Ví dụ: Văn A"
                                                value={signupLastName}
                                                onChange={(e) => setSignupLastName(e.target.value)}
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-phone">Số điện thoại *</Label>
                                        <Input
                                            id="signup-phone"
                                            type="tel"
                                            placeholder="0123456789"
                                            value={signupPhone}
                                            onChange={(e) => setSignupPhone(e.target.value)}
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-email">Email *</Label>
                                        <Input
                                            id="signup-email"
                                            type="email"
                                            placeholder="example@company.com"
                                            value={signupEmail}
                                            onChange={(e) => setSignupEmail(e.target.value)}
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>

                                    

                                    {/* Password */}
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-password">Mật khẩu *</Label>
                                        <Input
                                            id="signup-password"
                                            type="password"
                                            placeholder="Nhập mật khẩu"
                                            value={signupPassword}
                                            onChange={(e) => setSignupPassword(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            minLength={6}
                                        />
                                        <p className="text-xs text-muted-foreground pt-1">Mật khẩu tối thiểu 6 ký tự.</p>
                                    </div>
                                </CardContent>

                                <CardFooter>
                                    <Button type="submit" className="w-full h-10 text-base gradient-primary shadow-lg shadow-primary/30" disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Đang gửi yêu cầu...
                                            </>
                                        ) : (
                                            "Đăng Ký"
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </TabsContent>
                    </Tabs>
                </Card>
            </div>
        </div>
    );
};

export default Login;
