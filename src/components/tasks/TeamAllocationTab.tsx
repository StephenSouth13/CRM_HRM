import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserRole, getUserProfile } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@/lib/auth";
import { Loader2, Users, Briefcase, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface TeamWorkload {
  user_id: string;
  total_tasks_assigned: number;
  total_tasks_in_progress: number;
  total_tasks_overdue: number;
  total_tasks_completed: number;
  workload_percentage: number;
  member?: TeamMember;
}

interface TeamAllocationTabProps {
  role: UserRole;
}

const TeamAllocationTab = ({ role }: TeamAllocationTabProps) => {
  const [teamMembers, setTeamMembers] = useState<TeamWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [userTeam, setUserTeam] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if user has access to this tab
  const hasAccess = ['admin', 'leader'].includes(role);

  useEffect(() => {
    if (hasAccess) {
      loadTeamData();
    } else {
      setLoading(false);
    }
  }, [role, selectedTeam]);

  const loadTeamData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const profile = await getUserProfile(user.id);
      if (profile?.team_id) {
        setUserTeam(profile.team_id);
        // Default to user's own team if not admin
        if (role === 'leader' && !selectedTeam) {
          setSelectedTeam(profile.team_id);
        }
      }

      // Fetch all tasks
      let tasksQuery = supabase.from('tasks').select('*');

      // If not admin, filter by team
      if (role === 'leader' && selectedTeam !== 'all' && userTeam) {
        tasksQuery = tasksQuery.eq('team_id', userTeam);
      } else if (selectedTeam !== 'all') {
        tasksQuery = tasksQuery.eq('team_id', selectedTeam);
      }

      const { data: tasks, error: tasksError } = await tasksQuery;

      if (tasksError) throw tasksError;

      // Calculate workload for each assignee
      const workloadMap = new Map<string, TeamWorkload>();

      if (tasks) {
        tasks.forEach(task => {
          if (task.assignee_id) {
            if (!workloadMap.has(task.assignee_id)) {
              workloadMap.set(task.assignee_id, {
                user_id: task.assignee_id,
                total_tasks_assigned: 0,
                total_tasks_in_progress: 0,
                total_tasks_overdue: 0,
                total_tasks_completed: 0,
                workload_percentage: 0
              });
            }

            const workload = workloadMap.get(task.assignee_id)!;
            workload.total_tasks_assigned++;

            if (task.status === 'in_progress') {
              workload.total_tasks_in_progress++;
            }

            if (task.status === 'done') {
              workload.total_tasks_completed++;
            }

            // Check if task is overdue
            if (task.deadline) {
              const deadlineDate = new Date(task.deadline);
              const today = new Date();
              if (deadlineDate < today && task.status !== 'done') {
                workload.total_tasks_overdue++;
              }
            }
          }
        });
      }

      // Convert map to array
      const workloadArray = Array.from(workloadMap.values());

      // Calculate workload percentage based on average of assigned tasks
      const avgTasks = workloadArray.length > 0
        ? workloadArray.reduce((sum, w) => sum + w.total_tasks_assigned, 0) / workloadArray.length
        : 0;

      workloadArray.forEach(workload => {
        workload.workload_percentage = avgTasks > 0 ? Math.min(100, Math.round((workload.total_tasks_assigned / avgTasks) * 100)) : 0;
      });

      // Fetch member details for each workload record
      const withMembers = await Promise.all(
        workloadArray.map(async (workload) => {
          const { data: memberData } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, avatar_url')
            .eq('id', workload.user_id)
            .single();

          return {
            ...workload,
            member: memberData || undefined
          };
        })
      );

      // Sort by workload percentage descending
      withMembers.sort((a, b) => b.workload_percentage - a.workload_percentage);

      setTeamMembers(withMembers);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu phân bổ nhóm",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getWorkloadStatus = (percentage: number) => {
    if (percentage >= 90) return { label: 'Quá tải', color: 'text-red-600', bg: 'bg-red-100' };
    if (percentage >= 70) return { label: 'Cao', color: 'text-orange-600', bg: 'bg-orange-100' };
    if (percentage >= 50) return { label: 'Bình thường', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'Thấp', color: 'text-green-600', bg: 'bg-green-100' };
  };

  const getInitials = (member?: TeamMember) => {
    if (!member) return 'U';
    const first = member.first_name?.[0] || '';
    const last = member.last_name?.[0] || '';
    return (first + last).toUpperCase();
  };

  const getFullName = (member?: TeamMember) => {
    if (!member) return 'Unknown';
    return `${member.first_name || ''} ${member.last_name || ''}`.trim();
  };

  if (!hasAccess) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900">Quyền Truy Cập Bị Từ Chối</p>
            <p className="text-sm text-amber-700">Chỉ Trưởng nhóm và Quản trị viên mới có thể xem thông tin phân bổ nhóm.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Team Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Phân Bổ Nhóm & Khối Lượng Công Việc
          </CardTitle>
          <CardDescription>
            Theo dõi khối lượng công việc thời gian thực của các thành viên trong nhóm
          </CardDescription>
        </CardHeader>

        {role !== 'admin' && (
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium">Lọc theo Nhóm</label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả Nhóm</SelectItem>
                  {userTeam && <SelectItem value={userTeam}>Nhóm của tôi</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Team Members Grid */}
      {teamMembers.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Không có dữ liệu khối lượng công việc cho nhóm này
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          {teamMembers.map((workload) => {
            const status = getWorkloadStatus(workload.workload_percentage);
            const fullName = getFullName(workload.member);

            return (
              <Card key={workload.user_id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                        {getInitials(workload.member)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">{fullName}</h3>
                        <p className="text-xs text-muted-foreground">{workload.member?.email}</p>
                      </div>
                    </div>
                    <Badge className={`${status.bg} ${status.color}`}>
                      {status.label}
                    </Badge>
                  </div>

                  {/* Workload Percentage */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Khối lượng công việc</span>
                      <span className="font-semibold">{workload.workload_percentage}%</span>
                    </div>
                    <Progress
                      value={workload.workload_percentage}
                      className="h-2"
                    />
                  </div>

                  {/* Task Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {workload.total_tasks_assigned}
                      </div>
                      <div className="text-xs text-muted-foreground">Được giao</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-cyan-600">
                        {workload.total_tasks_in_progress}
                      </div>
                      <div className="text-xs text-muted-foreground">Đang làm</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {workload.total_tasks_overdue}
                      </div>
                      <div className="text-xs text-muted-foreground">Quá hạn</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {workload.total_tasks_completed}
                      </div>
                      <div className="text-xs text-muted-foreground">Hoàn thành</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Real-time Status */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Briefcase className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900">Cập nhật Thời gian Thực</p>
              <p className="text-blue-700 text-xs mt-1">Dữ liệu được tính toán từ công việc hiện tại. Làm mới để xem dữ liệu mới nhất.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={loadTeamData}>
                Làm mới dữ liệu
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamAllocationTab;
