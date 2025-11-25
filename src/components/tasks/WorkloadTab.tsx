import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users2, Briefcase, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TaskStats {
  userId: string;
  userEmail: string;
  firstName: string | null;
  lastName: string | null;
  totalTasks: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

const WorkloadTab = () => {
  const [stats, setStats] = useState<TaskStats[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadWorkloadData();

    const channel = supabase
      .channel('workload-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadWorkloadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadWorkloadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Fetch all tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*');

      if (tasksError) throw tasksError;

      // Fetch all profiles for user details
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email');

      if (profilesError) throw profilesError;

      // Calculate workload per user
      const workloadMap = new Map<string, TaskStats>();

      if (tasks) {
        tasks.forEach(task => {
          if (task.assignee_id) {
            if (!workloadMap.has(task.assignee_id)) {
              const profile = profiles?.find(p => p.id === task.assignee_id);
              workloadMap.set(task.assignee_id, {
                userId: task.assignee_id,
                userEmail: profile?.email || 'Unknown',
                firstName: profile?.first_name || '',
                lastName: profile?.last_name || '',
                totalTasks: 0,
                inProgress: 0,
                completed: 0,
                overdue: 0
              });
            }

            const stat = workloadMap.get(task.assignee_id)!;
            stat.totalTasks++;

            if (task.status === 'in_progress') {
              stat.inProgress++;
            }

            if (task.status === 'done') {
              stat.completed++;
            }

            // Check for overdue
            if (task.deadline) {
              const deadlineDate = new Date(task.deadline);
              const today = new Date();
              if (deadlineDate < today && task.status !== 'done') {
                stat.overdue++;
              }
            }
          }
        });
      }

      const statsArray = Array.from(workloadMap.values())
        .sort((a, b) => b.totalTasks - a.totalTasks);

      setStats(statsArray);
    } catch (error) {
      console.error('Error loading workload data:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu khối lượng công việc",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getFullName = (stat: TaskStats) => {
    const name = `${stat.firstName || ''} ${stat.lastName || ''}`.trim();
    return name || 'Unknown';
  };

  const getWorkloadPercentage = (inProgress: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((inProgress / total) * 100);
  };

  const getWorkloadStatus = (inProgress: number, total: number) => {
    const percentage = getWorkloadPercentage(inProgress, total);
    if (percentage > 80) return { label: 'Quá tải', color: 'text-red-600' };
    if (percentage > 60) return { label: 'Cao', color: 'text-orange-600' };
    if (percentage > 40) return { label: 'Bình thường', color: 'text-yellow-600' };
    return { label: 'Thấp', color: 'text-green-600' };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalTasks = stats.reduce((sum, s) => sum + s.totalTasks, 0);
  const totalInProgress = stats.reduce((sum, s) => sum + s.inProgress, 0);
  const totalCompleted = stats.reduce((sum, s) => sum + s.completed, 0);
  const totalOverdue = stats.reduce((sum, s) => sum + s.overdue, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tổng Công Việc</div>
            <div className="text-2xl font-bold mt-2">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Đang Làm</div>
            <div className="text-2xl font-bold mt-2 text-blue-600">{totalInProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Hoàn Thành</div>
            <div className="text-2xl font-bold mt-2 text-green-600">{totalCompleted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Quá Hạn</div>
            <div className="text-2xl font-bold mt-2 text-red-600">{totalOverdue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Phân Bổ Tài Nguyên</h2>
        <p className="text-muted-foreground mt-1">Xem khối lượng công việc của từng thành viên nhóm</p>
      </div>

      {/* Team Workload */}
      {stats.length > 0 ? (
        <div className="space-y-4">
          {stats.map((stat) => {
            const workloadPercentage = getWorkloadPercentage(stat.inProgress, stat.totalTasks);
            const workloadStatus = getWorkloadStatus(stat.inProgress, stat.totalTasks);
            const completionRate = stat.totalTasks > 0 ? Math.round((stat.completed / stat.totalTasks) * 100) : 0;

            return (
              <Card key={stat.userId} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-base">{getFullName(stat)}</h3>
                      <p className="text-xs text-muted-foreground">{stat.userEmail}</p>
                    </div>
                    <Badge className={`${workloadStatus.color}`}>
                      {workloadStatus.label}
                    </Badge>
                  </div>

                  {/* Workload Bars */}
                  <div className="space-y-3">
                    {/* Current Workload */}
                    <div>
                      <div className="flex justify-between mb-2 text-sm">
                        <span>Khối lượng hiện tại</span>
                        <span className="font-semibold">{workloadPercentage}%</span>
                      </div>
                      <Progress value={workloadPercentage} className="h-2" />
                    </div>

                    {/* Completion Rate */}
                    <div>
                      <div className="flex justify-between mb-2 text-sm">
                        <span>Tỷ lệ hoàn thành</span>
                        <span className="font-semibold">{completionRate}%</span>
                      </div>
                      <Progress value={completionRate} className="h-2" />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 pt-2">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-sm font-bold text-gray-700">{stat.totalTasks}</div>
                        <div className="text-xs text-muted-foreground">Tổng</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="text-sm font-bold text-blue-700">{stat.inProgress}</div>
                        <div className="text-xs text-muted-foreground">Đang làm</div>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="text-sm font-bold text-green-700">{stat.completed}</div>
                        <div className="text-xs text-muted-foreground">Xong</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <div className="text-sm font-bold text-red-700">{stat.overdue}</div>
                        <div className="text-xs text-muted-foreground">Quá hạn</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-8">
            Chưa có dữ liệu phân bổ công việc
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Briefcase className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900">Phân Bổ Tài Nguyên</p>
              <p className="text-blue-700 text-xs mt-1">Theo dõi khối lượng công việc để đảm bảo phân bổ công bằng và hiệu quả. Cân bằng công việc để tránh quá tải.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkloadTab;
