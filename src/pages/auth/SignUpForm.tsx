import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signUp } from "@/lib/auth"; // Đảm bảo chỉ import signUp
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client"; 

const SignUpForm = () => {
    const [isLoading, setIsLoading] = useState(false);
    // Khai báo state Đăng ký
    const [signupFirstName, setSignupFirstName] = useState("");
    const [signupLastName, setSignupLastName] = useState("");
    const [signupPhone, setSignupPhone] = useState("");
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    
    const { toast } = useToast();

    // --- Xử lý Đăng ký ---
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (!signupEmail.includes("@")) {
                toast({ variant: "destructive", title: "Email không hợp lệ", description: "Vui lòng nhập email đúng định dạng." });
                return;
            }

            // 1. Đăng ký tài khoản Supabase Auth
            // FIX: Gửi data qua khối data (user_metadata)
            const { data, error } = await signUp(signupEmail, signupPassword, {
                data: { 
                    first_name: signupFirstName,
                    last_name: signupLastName,
                    phone: signupPhone, 
                    role: "employee", 
                } as any, // as any để TS chấp nhận metadata
            });

            if (error) {
                toast({ variant: "destructive", title: "Đăng ký Thất bại", description: (error as Error).message });
                return;
            }

            // 2. TẠO RECORD TRONG BẢNG PROFILES
            const userId = data?.user?.id;
            if (userId) {
                // FIX: Sử dụng as any để Typescript chấp nhận các cột mới
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await supabase.from("profiles").insert({
                    id: userId,
                    first_name: signupFirstName,
                    last_name: signupLastName,
                    phone: signupPhone,
                    email: signupEmail,
                    account_status: "PENDING", // Yêu cầu Admin kích hoạt
                    role: "staff", 
                } as any); 
            }

            toast({
                title: "Tạo tài khoản Thành công!",
                description: "Tài khoản đã được tạo. Vui lòng chờ Admin kích hoạt.",
            });

        } catch (error: unknown) { // FIX: Sử dụng unknown thay vì any
            toast({
                variant: "destructive",
                title: "Lỗi Hệ thống",
                description: (error as Error).message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSignup}>
            <CardContent className="space-y-6 pt-6">
                <CardTitle className="text-2xl text-center">Tạo tài khoản</CardTitle>

                <div className="grid grid-cols-2 gap-4">
                    {/* 1. Họ */}
                    <div className="space-y-2">
                        <Label htmlFor="signup-lastname">Họ</Label>
                        <Input id="signup-lastname" type="text" value={signupLastName} onChange={(e) => setSignupLastName(e.target.value)} required disabled={isLoading} />
                    </div>
                    {/* 2. Tên */}
                    <div className="space-y-2">
                        <Label htmlFor="signup-firstname">Tên</Label>
                        <Input id="signup-firstname" type="text" value={signupFirstName} onChange={(e) => setSignupFirstName(e.target.value)} required disabled={isLoading} />
                    </div>
                </div>

                {/* 3. Số điện thoại */}
                <div className="space-y-2">
                    <Label htmlFor="signup-phone">Số điện thoại</Label>
                    <Input id="signup-phone" type="text" inputMode="tel" value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} required disabled={isLoading} />
                </div>

                {/* 4. Email */}
                <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required disabled={isLoading} />
                </div>

                {/* 5. Mật khẩu */}
                <div className="space-y-2">
                    <Label htmlFor="signup-password">Mật khẩu</Label>
                    <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required disabled={isLoading} minLength={6} />
                    <p className="text-xs text-muted-foreground pt-1">Mật khẩu tối thiểu 6 ký tự.</p>
                </div>

            </CardContent>

            <CardFooter>
                <Button type="submit" className="w-full h-10 text-base gradient-primary shadow-lg shadow-primary/30" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang gửi yêu cầu...</>) : ("Đăng Ký")}
                </Button>
            </CardFooter>
        </form>
    );
};

export default SignUpForm;