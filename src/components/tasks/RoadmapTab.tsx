import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Waypoints, Calendar, Zap } from "lucide-react";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  creator_id: string;
  team_id: string | null;
  created_at: string;
  updated_at: string;
}

const RoadmapTab = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('roadmap-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('deadline', { ascending: true, nullsLast: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu roadmap",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getUpcomingTasks = () => {
    const now = new Date();
    return tasks
      .filter(t => t.deadline && isAfter(parseISO(t.deadline), now))
      .sort((a, b) => {
        if (!a.deadline || !b.deadline) return 0;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  };

  const getCompletionRate = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'done').length;
    return Math.round((completed / tasks.length) * 100);
  };

  const statusStats = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length
  };

  const upcomingTasks = getUpcomingTasks().slice(0, 8);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tổng Công Việc</div>
            <div className="text-2xl font-bold mt-2">{tasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Hoàn Thành</div>
            <div className="text-2xl font-bold mt-2 text-green-600">{statusStats.done}</div>
            <div className="text-xs text-muted-foreground mt-2">{getCompletionRate()}% hoàn thành</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Đang Làm</div>
            <div className="text-2xl font-bold mt-2 text-blue-600">{statusStats.in_progress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Chưa Bắt Đầu</div>
            <div className="text-2xl font-bold mt-2 text-gray-600">{statusStats.todo}</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Tiến Độ Dự Án
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Tổng tiến độ</span>
                <span className="text-sm font-semibold">{getCompletionRate()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-500"
                  style={{ width: `${getCompletionRate()}%` }}
                />
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-muted-foreground">Chưa bắt đầu</div>
                <div className="text-lg font-bold text-gray-600 mt-1">{statusStats.todo}</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-muted-foreground">Đang làm</div>
                <div className="text-lg font-bold text-blue-600 mt-1">{statusStats.in_progress}</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-xs text-muted-foreground">Chờ duyệt</div>
                <div className="text-lg font-bold text-purple-600 mt-1">{statusStats.review}</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-muted-foreground">Hoàn thành</div>
                <div className="text-lg font-bold text-green-600 mt-1">{statusStats.done}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mốc Thời Gian Sắp Tới
          </CardTitle>
          <CardDescription>
            {upcomingTasks.length} công việc có deadline sắp tới
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingTasks.length > 0 ? (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-base truncate flex-1">{task.title}</h4>
                    <Badge variant="outline" className="ml-2">
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {task.deadline ? format(parseISO(task.deadline), 'dd MMM yyyy', { locale: vi }) : 'Không có deadline'}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`
                        ${task.priority === 'urgent' ? 'bg-red-100 text-red-700' : ''}
                        ${task.priority === 'high' ? 'bg-orange-100 text-orange-700' : ''}
                        ${task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : ''}
                        ${task.priority === 'low' ? 'bg-blue-100 text-blue-700' : ''}
                      `}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Không có công việc sắp tới</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>ℹ️ Roadmap:</strong> Xem tiến độ dự án và các mốc thời gian sắp tới dựa trên deadline của công việc.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoadmapTab;
