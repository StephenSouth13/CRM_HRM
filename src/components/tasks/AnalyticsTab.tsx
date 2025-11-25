import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, TrendingDown, BarChart3, PieChart, Activity, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  reviewTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageTimeToComplete: number;
  tasksByPriority: Record<string, number>;
  tasksByStatus: Record<string, number>;
}

const AnalyticsTab = () => {
  const [analytics, setAnalytics] = useState<TaskAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();

    const channel = supabase
      .channel('analytics-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadAnalytics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAnalytics = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*');

      if (error) throw error;

      if (!tasks) {
        setAnalytics(null);
        return;
      }

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const todoTasks = tasks.filter(t => t.status === 'todo').length;
      const reviewTasks = tasks.filter(t => t.status === 'review').length;
      const overdueTasks = tasks.filter(t => {
        if (!t.deadline || t.status === 'done') return false;
        const deadline = new Date(t.deadline);
        return deadline < new Date();
      }).length;

      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Calculate average time to complete (simplified)
      const completedTasksWithDates = tasks.filter(t => t.status === 'done' && t.deadline && t.created_at);
      const averageTimeToComplete = completedTasksWithDates.length > 0
        ? Math.round(
            completedTasksWithDates.reduce((sum, t) => {
              const created = new Date(t.created_at);
              const deadline = new Date(t.deadline!);
              return sum + (deadline.getTime() - created.getTime());
            }, 0) / completedTasksWithDates.length / (1000 * 60 * 60 * 24)
          )
        : 0;

      // Count by priority
      const tasksByPriority = {
        low: tasks.filter(t => t.priority === 'low').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        high: tasks.filter(t => t.priority === 'high').length,
        urgent: tasks.filter(t => t.priority === 'urgent').length
      };

      // Count by status
      const tasksByStatus = {
        todo: todoTasks,
        in_progress: inProgressTasks,
        review: reviewTasks,
        done: completedTasks
      };

      setAnalytics({
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        reviewTasks,
        overdueTasks,
        completionRate,
        averageTimeToComplete,
        tasksByPriority,
        tasksByStatus
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu phân tích",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
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

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-lg font-medium">Không có dữ liệu để phân tích</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trend = analytics.completionRate >= 50 ? 'up' : 'down';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Phân Tích Hiệu Suất</h2>
        <p className="text-muted-foreground mt-1">Xem chi tiết về tiến độ công việc và hiệu suất nhóm</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tổng Công Việc</div>
            <div className="text-3xl font-bold mt-2">{analytics.totalTasks}</div>
            <div className="text-xs text-muted-foreground mt-2">Tất cả trạng thái</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tỷ Lệ Hoàn Thành</div>
            <div className="text-3xl font-bold mt-2 text-green-600">{analytics.completionRate}%</div>
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="text-xs text-muted-foreground">
                {analytics.completedTasks} công việc hoàn thành
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Công Việc Quá Hạn</div>
            <div className="text-3xl font-bold mt-2 text-red-600">{analytics.overdueTasks}</div>
            <div className="text-xs text-muted-foreground mt-2">Cần chú ý</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Thời Gian Trung Bình</div>
            <div className="text-3xl font-bold mt-2">{analytics.averageTimeToComplete}</div>
            <div className="text-xs text-muted-foreground mt-2">Ngày để hoàn thành</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Phân Bố Theo Trạng Thái
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span>Chưa bắt đầu (To Do)</span>
                <span className="font-semibold">{analytics.tasksByStatus.todo}</span>
              </div>
              <Progress value={(analytics.tasksByStatus.todo / analytics.totalTasks) * 100} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span>Đang làm (In Progress)</span>
                <span className="font-semibold">{analytics.tasksByStatus.in_progress}</span>
              </div>
              <Progress value={(analytics.tasksByStatus.in_progress / analytics.totalTasks) * 100} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span>Chờ duyệt (Review)</span>
                <span className="font-semibold">{analytics.tasksByStatus.review}</span>
              </div>
              <Progress value={(analytics.tasksByStatus.review / analytics.totalTasks) * 100} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span>Hoàn thành (Done)</span>
                <span className="font-semibold text-green-600">{analytics.tasksByStatus.done}</span>
              </div>
              <Progress value={(analytics.tasksByStatus.done / analytics.totalTasks) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* By Priority */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5" />
              Phân Bố Theo Ưu Tiên
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Thấp (Low)
                </span>
                <span className="font-semibold">{analytics.tasksByPriority.low}</span>
              </div>
              <Progress value={(analytics.tasksByPriority.low / analytics.totalTasks) * 100} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  Trung bình (Medium)
                </span>
                <span className="font-semibold">{analytics.tasksByPriority.medium}</span>
              </div>
              <Progress value={(analytics.tasksByPriority.medium / analytics.totalTasks) * 100} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Cao (High)
                </span>
                <span className="font-semibold">{analytics.tasksByPriority.high}</span>
              </div>
              <Progress value={(analytics.tasksByPriority.high / analytics.totalTasks) * 100} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Khẩn cấp (Urgent)
                </span>
                <span className="font-semibold text-red-600">{analytics.tasksByPriority.urgent}</span>
              </div>
              <Progress value={(analytics.tasksByPriority.urgent / analytics.totalTasks) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5" />
            Gợi Ý Hiệu Suất
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-900">
            {analytics.overdueTasks > 0 && (
              <li>• Bạn có {analytics.overdueTasks} công việc quá hạn - hãy ưu tiên hoàn thành chúng</li>
            )}
            {analytics.inProgressTasks > 5 && (
              <li>• Bạn đang làm {analytics.inProgressTasks} công việc - hãy tập trung vào ít hơn để tăng chất lượng</li>
            )}
            {analytics.completionRate < 50 && (
              <li>• Tỷ lệ hoàn thành của bạn là {analytics.completionRate}% - hãy đặt mục tiêu hoàn thành thêm công việc</li>
            )}
            {analytics.completionRate >= 80 && (
              <li>• ✨ Tuyệt vời! Tỷ lệ hoàn thành của bạn là {analytics.completionRate}% - giữ đà tốt này!</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsTab;
