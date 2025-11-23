import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getUserRole, getCurrentUser, getUserProfile } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import TaskList from "@/components/tasks/TaskList";
import ScheduleTab from "@/components/tasks/ScheduleTab";
import TeamAllocationTab from "@/components/tasks/TeamAllocationTab";
import ReportsTab from "@/components/tasks/ReportsTab";
import GoalsTab from "@/components/tasks/GoalsTab";
import RoadmapTab from "@/components/tasks/RoadmapTab";
import WorkloadTab from "@/components/tasks/WorkloadTab";
import FormsTab from "@/components/tasks/FormsTab";
import DevelopmentTab from "@/components/tasks/DevelopmentTab";
import FilesTab from "@/components/tasks/FilesTab";
import AnalyticsTab from "@/components/tasks/AnalyticsTab";

import { LayoutGrid, List, Calendar, Users, FileText, Target, Waypoints, ClipboardList, GitBranch, File, BarChart3 } from "lucide-react";

const Tasks = () => {
  const [role, setRole] = useState<UserRole>('staff');
  const [userId, setUserId] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('');
  const [creatorData, setCreatorData] = useState<Record<string, any>>({});
  const [assigneeData, setAssigneeData] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadUserData = async () => {
      const user = await getCurrentUser();
      if (!user) return;

      setUserId(user.id);
      const userRole = await getUserRole(user.id);
      setRole(userRole);

      const profile = await getUserProfile(user.id);
      if (profile?.team_id) {
        setTeamId(profile.team_id);
      }

      // Load all user data for creators and assignees
      const { data: users } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url');

      if (users) {
        const userMap = users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as Record<string, any>);
        setCreatorData(userMap);
        setAssigneeData(userMap);
      }
    };
    loadUserData();
  }, []);

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
        
        <div className="mb-2">
          <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Công việc
          </h2>
          <p className="text-muted-foreground mt-2">Quản lý và theo dõi nhiệm vụ của bạn</p>
        </div>

        <Tabs defaultValue="board" className="w-full">

          {/* ======= TABS LIST ======= */}
          <TabsList className="bg-secondary shadow-soft flex flex-wrap h-auto gap-1 p-1">

            {/* ======= NHÓM QUẢN LÝ CÔNG VIỆC ======= */}
            {/* Bảng */}
            <TabsTrigger value="board" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Bảng</span>
            </TabsTrigger>

            {/* Danh sách */}
            <TabsTrigger value="list" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Danh sách</span>
            </TabsTrigger>

            {/* Lịch & Gantt */}
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Lịch & Gantt</span>
            </TabsTrigger>

            {/* Roadmap */}
            <TabsTrigger value="roadmap" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <Waypoints className="h-4 w-4" />
              <span className="hidden sm:inline">Roadmap</span>
            </TabsTrigger>

            {/* ======= NHÓM QUẢN LÝ ĐỘI NHÓM ======= */}
            {/* Nhóm */}
            <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Nhóm</span>
            </TabsTrigger>

            {/* Workload / Phân Bổ */}
            <TabsTrigger value="workload" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Phân Bổ</span>
            </TabsTrigger>

            {/* ======= NH��M MỤC TIÊU – QUY TRÌNH ======= */}
            {/* Mục tiêu / OKRs */}
            <TabsTrigger value="goals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Mục tiêu</span>
            </TabsTrigger>

            {/* Biểu mẫu / Forms */}
            <TabsTrigger value="forms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Biểu mẫu</span>
            </TabsTrigger>

            {/* ======= NHÓM DEVELOPMENT & TÀI LIỆU ======= */}
            {/* Development */}
            <TabsTrigger value="development" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              <span className="hidden sm:inline">Development</span>
            </TabsTrigger>

            {/* Tài liệu / Files */}
            <TabsTrigger value="files" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <File className="h-4 w-4" />
              <span className="hidden sm:inline">Tài liệu</span>
            </TabsTrigger>

            {/* ======= NHÓM BÁO CÁO ======= */}
            {/* Báo cáo */}
            <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Báo Cáo</span>
            </TabsTrigger>

            {/* Analytics / Phân tích */}
            <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Phân tích</span>
            </TabsTrigger>

          </TabsList>

          {/* ======= CONTENT ======= */}

          {/* ======= NHÓM QUẢN LÝ CÔNG VIỆC ======= */}
          <TabsContent value="board" className="mt-6">
            {teamId && userId && (
              <KanbanBoard
                teamId={teamId}
                userId={userId}
                users={Object.values(creatorData)}
              />
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-6">
            <TaskList role={role} />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <ScheduleTab />
          </TabsContent>

          <TabsContent value="roadmap" className="mt-6">
            <RoadmapTab />
          </TabsContent>

          {/* ======= NHÓM QUẢN LÝ ĐỘI NHÓM ======= */}
          <TabsContent value="team" className="mt-6">
            <TeamAllocationTab role={role} />
          </TabsContent>

          <TabsContent value="workload" className="mt-6">
            <WorkloadTab />
          </TabsContent>

          {/* ======= NHÓM MỤC TIÊU – QUY TRÌNH ======= */}
          <TabsContent value="goals" className="mt-6">
            <GoalsTab />
          </TabsContent>

          <TabsContent value="forms" className="mt-6">
            <FormsTab />
          </TabsContent>

          {/* ======= NHÓM DEVELOPMENT & TÀI LIỆU ======= */}
          <TabsContent value="development" className="mt-6">
            <DevelopmentTab />
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            <FilesTab />
          </TabsContent>

          {/* ======= NHÓM BÁO CÁO ======= */}
          <TabsContent value="reports" className="mt-6">
            <ReportsTab role={role} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsTab />
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
