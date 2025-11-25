import React, { ReactNode, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
    LayoutDashboard, Users, CheckSquare, Calendar, LogOut, User,
    Moon, Sun, Clock, Settings, Menu, X, ListChecks, FileText, Briefcase, DollarSign, LineChart
} from "lucide-react";
// Giả định các hàm này trả về các kiểu đã định nghĩa
import { getCurrentUser, getUserProfile, signOut, UserRole, getUserRole } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/notifications/NotificationBell";
import { supabase } from "@/integrations/supabase/client";

// --- Định nghĩa kiểu dữ liệu ---

interface CurrentUser { id: string; email?: string | null; }
interface UserProfile { full_name: string; avatar_url: string | null; }

// --- Cấu trúc Menu Điều hướng ---
interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface DashboardLayoutProps {
    children: ReactNode;
    role?: UserRole;
    organizationSection?: string;
    onOrganizationSectionChange?: (section: string) => void;
}

const DashboardLayout = ({ children, role = 'staff', organizationSection, onOrganizationSectionChange }: DashboardLayoutProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userRole, setUserRole] = useState<UserRole>(role);
    const [isDark, setIsDark] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [expandedOrg, setExpandedOrgState] = useState(organizationSection || 'teams');

    const setExpandedOrg = (value: string) => {
        setExpandedOrgState(value);
        if (onOrganizationSectionChange) {
            onOrganizationSectionChange(value);
        }
    };

    // --- LOGIC MENU ITEMS ---
    const baseMenuItems: NavItem[] = [
        { icon: LayoutDashboard, label: "Bảng điều khiển", path: "/dashboard" },
        { icon: Clock, label: "Chấm công", path: "/attendance" },
        { icon: ListChecks, label: "Công việc", path: "/tasks" },
        { icon: Calendar, label: "Phòng họp", path: "/meeting-rooms" },
    ];

    const menuItems = [...baseMenuItems];
    if (userRole === 'admin') {
        menuItems.push({ icon: Settings, label: "Quản lý Tổ chức", path: "/organization" });
    }


    useEffect(() => {
        if (organizationSection) {
            setExpandedOrgState(organizationSection);
        }
    }, [organizationSection]);

    useEffect(() => {
        const loadUser = async () => {
            const currentUser = await getCurrentUser();
            if (!currentUser) {
                navigate("/auth/login");
                return;
            }

            // Skip registration check as table doesn't exist
            // User is assumed to be approved if they can log in

            setUser(currentUser);
            const userProfile = await getUserProfile(currentUser.id);
            setProfile(userProfile);

            const fetchedRole = await getUserRole(currentUser.id);
            setUserRole(fetchedRole);
        };
        loadUser();
    }, [navigate]);

    const handleLogout = async () => {
        const { error } = await signOut();
        if (error) {
            toast({
                variant: "destructive",
                title: "Đăng xuất Thất bại",
                description: error.message
            });
            return;
        }
        navigate("/auth/login");
    };

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle("dark");
    };

    // Logic kiểm tra trạng thái active
    // Dùng startsWith để highlight cả /attendance/new hay /leave/new
    const isActive = (path: string) => window.location.pathname.startsWith(path);
    
    const getInitials = () => {
        if (profile?.first_name && profile?.last_name) {
            return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
        }
        return user?.email?.[0]?.toUpperCase() || "U";
    };
    
    const getFullName = () => {
        return profile?.full_name || 'Người dùng';
    };

    const getRoleDisplayName = (r: UserRole) => {
        if (r === 'admin') return 'Quản trị';
        if (r === 'leader') return 'Trưởng nhóm';
        return 'Nhân viên';
    };


    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 w-full border-b bg-card shadow-md">
                <div className="flex h-16 items-center px-4 md:px-6 justify-between">
                    {/* Logo and App Name */}
                    <div
                        className="flex items-center gap-2 md:gap-3 cursor-pointer flex-1 min-w-0"
                        onClick={() => navigate("/dashboard")}
                    >
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-primary flex items-center justify-center overflow-hidden p-1 shadow-sm flex-shrink-0">
                            <img
                                src="/LOGO.PNG"
                                alt="HRM Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="hidden sm:block min-w-0">
                            <h1 className="text-lg md:text-xl font-heading font-bold tracking-tight truncate">HRM</h1>
                            <p className="text-xs text-muted-foreground hidden md:block">{getRoleDisplayName(userRole)}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4 ml-2 md:ml-auto flex-shrink-0">
                        <NotificationBell />
                        <Button variant="ghost" size="icon" onClick={toggleTheme} className="hidden sm:inline-flex">
                            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </Button>

                        {/* Mobile Menu Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden"
                        >
                            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>

                        {/* User Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full flex-shrink-0">
                                    <Avatar>
                                        <AvatarImage src={profile?.avatar_url || undefined} />
                                        <AvatarFallback className="bg-primary text-white font-heading font-semibold">
                                            {getInitials()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-semibold">{getFullName()}</p>
                                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate("/profile")}>
                                    <User className="mr-2 h-4 w-4" />
                                    Hồ sơ Cá nhân
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate("/settings")}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    Cài đặt
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Đăng xuất
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (Desktop) */}
                <aside className="hidden md:flex w-64 flex-col border-r bg-card shadow-inner overflow-y-auto">
                    <nav className="flex-1 space-y-1 p-4 pt-6">
                        {menuItems.map((item) => {
                            const active = isActive(item.path);
                            const isOrgMenu = item.path === "/organization";

                            if (isOrgMenu && userRole === 'admin') {
                                return (
                                    <Accordion key={item.path} type="single" collapsible value={expandedOrg || ''} onValueChange={setExpandedOrg}>
                                        <AccordionItem value="org-menu">
                                            <AccordionTrigger className={`w-full text-left font-medium text-base transition-all px-3 py-2 hover:bg-accent rounded-lg ${active ? 'bg-secondary' : ''}`}>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <item.icon className="h-5 w-5 flex-shrink-0" />
                                                    <span className="truncate">{item.label}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="mt-2 space-y-1 ml-6">
                                                <Button
                                                    variant={expandedOrg === 'teams' ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start text-sm"
                                                    onClick={() => {
                                                        setExpandedOrg('teams');
                                                        if (onOrganizationSectionChange) onOrganizationSectionChange('teams');
                                                        navigate('/organization');
                                                    }}
                                                >
                                                    Đội nhóm
                                                </Button>
                                                <Button
                                                    variant={expandedOrg === 'users' ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start text-sm"
                                                    onClick={() => {
                                                        setExpandedOrg('users');
                                                        if (onOrganizationSectionChange) onOrganizationSectionChange('users');
                                                        navigate('/organization');
                                                    }}
                                                >
                                                    Người dùng
                                                </Button>
                                                <Button
                                                    variant={expandedOrg === 'shifts' ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start text-sm"
                                                    onClick={() => {
                                                        setExpandedOrg('shifts');
                                                        if (onOrganizationSectionChange) onOrganizationSectionChange('shifts');
                                                        navigate('/organization');
                                                    }}
                                                >
                                                    Ca làm
                                                </Button>
                                                <Button
                                                    variant={expandedOrg === 'attendance' ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start text-sm"
                                                    onClick={() => {
                                                        setExpandedOrg('attendance');
                                                        if (onOrganizationSectionChange) onOrganizationSectionChange('attendance');
                                                        navigate('/organization');
                                                    }}
                                                >
                                                    Chấm công
                                                </Button>
                                                <Button
                                                    variant={expandedOrg === 'salary' ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start text-sm"
                                                    onClick={() => {
                                                        setExpandedOrg('salary');
                                                        if (onOrganizationSectionChange) onOrganizationSectionChange('salary');
                                                        navigate('/organization');
                                                    }}
                                                >
                                                    Lương
                                                </Button>
                                                <Button
                                                    variant={expandedOrg === 'statistics' ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start text-sm"
                                                    onClick={() => {
                                                        setExpandedOrg('statistics');
                                                        if (onOrganizationSectionChange) onOrganizationSectionChange('statistics');
                                                        navigate('/organization');
                                                    }}
                                                >
                                                    Thống kê
                                                </Button>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                );
                            }

                            return (
                                <Button
                                    key={item.path}
                                    variant={active ? "secondary" : "ghost"}
                                    className="w-full justify-start font-medium text-base transition-all hover:translate-x-0.5"
                                    onClick={() => navigate(item.path)}
                                >
                                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                                    <span className="truncate">{item.label}</span>
                                </Button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Mobile Sidebar (Overlay) */}
                {isMobileMenuOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 md:hidden z-30"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-card shadow-lg z-40 overflow-y-auto md:hidden">
                            <nav className="flex flex-col space-y-1 p-4">
                                {menuItems.map((item) => {
                                    const active = isActive(item.path);
                                    const isOrgMenu = item.path === "/organization";

                                    if (isOrgMenu && userRole === 'admin') {
                                        return (
                                            <Accordion key={item.path} type="single" collapsible value={expandedOrg || ''} onValueChange={setExpandedOrg}>
                                                <AccordionItem value="org-menu">
                                                    <AccordionTrigger className={`w-full text-left font-medium text-base transition-all px-3 py-2 hover:bg-accent rounded-lg ${active ? 'bg-secondary' : ''}`}>
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <item.icon className="h-5 w-5 flex-shrink-0" />
                                                            <span className="truncate">{item.label}</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="mt-2 space-y-1 ml-6">
                                                        <Button
                                                            variant={expandedOrg === 'teams' ? 'secondary' : 'ghost'}
                                                            className="w-full justify-start text-sm"
                                                            onClick={() => {
                                                                setExpandedOrg('teams');
                                                                if (onOrganizationSectionChange) onOrganizationSectionChange('teams');
                                                                navigate('/organization');
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            Đội nhóm
                                                        </Button>
                                                        <Button
                                                            variant={expandedOrg === 'users' ? 'secondary' : 'ghost'}
                                                            className="w-full justify-start text-sm"
                                                            onClick={() => {
                                                                setExpandedOrg('users');
                                                                if (onOrganizationSectionChange) onOrganizationSectionChange('users');
                                                                navigate('/organization');
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            Người dùng
                                                        </Button>
                                                        <Button
                                                            variant={expandedOrg === 'shifts' ? 'secondary' : 'ghost'}
                                                            className="w-full justify-start text-sm"
                                                            onClick={() => {
                                                                setExpandedOrg('shifts');
                                                                if (onOrganizationSectionChange) onOrganizationSectionChange('shifts');
                                                                navigate('/organization');
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            Ca làm
                                                        </Button>
                                                        <Button
                                                            variant={expandedOrg === 'attendance' ? 'secondary' : 'ghost'}
                                                            className="w-full justify-start text-sm"
                                                            onClick={() => {
                                                                setExpandedOrg('attendance');
                                                                if (onOrganizationSectionChange) onOrganizationSectionChange('attendance');
                                                                navigate('/organization');
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            Chấm công
                                                        </Button>
                                                        <Button
                                                            variant={expandedOrg === 'salary' ? 'secondary' : 'ghost'}
                                                            className="w-full justify-start text-sm"
                                                            onClick={() => {
                                                                setExpandedOrg('salary');
                                                                if (onOrganizationSectionChange) onOrganizationSectionChange('salary');
                                                                navigate('/organization');
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            Lương
                                                        </Button>
                                                        <Button
                                                            variant={expandedOrg === 'statistics' ? 'secondary' : 'ghost'}
                                                            className="w-full justify-start text-sm"
                                                            onClick={() => {
                                                                setExpandedOrg('statistics');
                                                                if (onOrganizationSectionChange) onOrganizationSectionChange('statistics');
                                                                navigate('/organization');
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            Thống kê
                                                        </Button>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        );
                                    }

                                    return (
                                        <Button
                                            key={item.path}
                                            variant={active ? "secondary" : "ghost"}
                                            className="w-full justify-start font-medium text-base transition-all hover:translate-x-0.5"
                                            onClick={() => {
                                                navigate(item.path);
                                                setIsMobileMenuOpen(false);
                                            }}
                                        >
                                            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                                            <span className="truncate">{item.label}</span>
                                        </Button>
                                    );
                                })}
                            </nav>
                        </aside>
                    </>
                )}

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
                    {children}
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-40 shadow-2xl">
                <div className="grid grid-cols-5 gap-0.5 p-1">
                    {menuItems.slice(0, 5).map((item) => {
                        const active = isActive(item.path);
                        return (
                            <Button
                                key={item.path}
                                variant={active ? "secondary" : "ghost"}
                                size="sm"
                                className="flex flex-col h-auto py-2 px-0.5 text-center rounded-sm transition-colors"
                                onClick={() => navigate(item.path)}
                            >
                                <item.icon className="h-5 w-5 mb-1 mx-auto flex-shrink-0" />
                                <span className="text-xs font-medium line-clamp-2">{item.label}</span>
                            </Button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default DashboardLayout;
