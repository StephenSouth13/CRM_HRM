import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// FIX 1: Tách Tabs ra khỏi Card
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
import { useToast } from "@/hooks/use-toast";
import { signIn, getCurrentUser } from "@/lib/auth";
import { Loader2 } from "lucide-react"; 
import SignUpForm from "@/pages/auth/SignUpForm"; // <-- Đã sửa đường dẫn


// --- Custom Constants ---
const APP_NAME = "MSC Center - HRM AI";
const LOGO_PATH = "/LOGO.PNG"; 

const Login = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    
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

    // --- Xử lý Đăng nhập ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await signIn(loginEmail, loginPassword);
            
            if (error) {
                // FIX: Sử dụng (error as Error).message cho lỗi chung
                toast({ variant: "destructive", title: "Đăng nhập Thất bại", description: (error as Error).message });
                return;
            }

            toast({ title: "Chào mừng trở lại!", description: "Đăng nhập thành công, đang kiểm tra quyền..." });
            navigate("/dashboard"); 
        } catch (error: unknown) { // FIX: Dùng unknown thay vì any
            toast({ variant: "destructive", title: "Lỗi Hệ thống", description: (error as Error).message });
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
                        <img src={LOGO_PATH} alt="Logo Tổ chức" className="w-16 h-16 rounded-xl shadow-xl shadow-primary/30 object-contain" />
                        <h1 className="text-4xl font-extrabold tracking-tighter text-foreground">{APP_NAME}</h1>
                    </div>
                </div>

                {/* --- LOGIN/SIGNUP CARD --- */}
                <Card className="shadow-2xl border-2 border-border/70 transform hover:shadow-primary/20 transition-all duration-300">
                    <Tabs defaultValue="login" className="w-full">
                        
                        <CardHeader className="pt-6 pb-0">
                            <TabsList className="grid w-full grid-cols-2 h-12 text-lg">
                                <TabsTrigger value="login">Đăng nhập</TabsTrigger>
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
                                            <Label htmlFor="login-email">Tài khoản (Email)</Label>
                                            <Input id="login-email" type="email" placeholder="email@congty.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required disabled={isLoading} />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="login-password">Mật khẩu</Label>
                                            <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required disabled={isLoading} />
                                            
                                            <p className="text-sm text-right text-primary hover:underline cursor-pointer pt-1" onClick={() => navigate("/auth/forgot-password")}>Quên mật khẩu?</p>
                                        </div>
                                    </div>
                                </CardContent>
                                
                                <CardFooter>
                                    <Button type="submit" className="w-full h-10 text-base gradient-primary shadow-lg shadow-primary/30" disabled={isLoading}>
                                        {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</>) : ("Đăng nhập")}
                                    </Button>
                                </CardFooter>
                            </form>
                        </TabsContent>

                        {/* --- TAB CONTENT: ĐĂNG KÝ (Nhúng component mới) --- */}
                        <TabsContent value="signup">
                            <SignUpForm />
                        </TabsContent>
                    </Tabs>
                </Card>
            </div>
        </div>
    );
};

export default Login;