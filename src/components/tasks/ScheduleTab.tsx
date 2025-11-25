import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Calendar, BarChart3, Loader2 } from "lucide-react";
import TaskCalendarView from "./TaskCalendarView";
import TaskGanttChart from "./TaskGanttChart";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  assignee_id: string | null;
  creator_id: string;
  team_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const ScheduleTab = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'gantt'>('calendar');
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('tasks-schedule-changes')
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
        .or(`assignee_id.eq.${user.id},creator_id.eq.${user.id}`)
        .order('deadline', { ascending: true, nullsLast: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải công việc cho lịch biểu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskReschedule = async (taskId: string, newDeadline: string | null) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          deadline: newDeadline,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Công việc đã được cập nhật lịch biểu"
      });

      fetchTasks();
    } catch (error) {
      console.error('Error rescheduling task:', error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật lịch biểu",
        variant: "destructive"
      });
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

  const tasksSortedByDeadline = tasks
    .filter(t => t.deadline)
    .sort((a, b) => {
      if (!a.deadline || !b.deadline) return 0;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lịch Biểu Công Việc
          </CardTitle>
          <CardDescription>
            Xem và quản lý lịch biểu của các công việc
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'calendar' | 'gantt')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Lịch
              </TabsTrigger>
              <TabsTrigger value="gantt" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Biểu Đồ Gantt
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="mt-6">
              <TaskCalendarView 
                tasks={tasks}
                onTaskReschedule={handleTaskReschedule}
              />
            </TabsContent>

            <TabsContent value="gantt" className="mt-6">
              <TaskGanttChart 
                tasks={tasks}
                onTaskReschedule={handleTaskReschedule}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground space-y-2">
        <p>📊 Tổng cộng: <strong>{tasks.length}</strong> công việc</p>
        {tasksSortedByDeadline.length > 0 && (
          <p>📅 Công việc sắp tới: <strong>{tasksSortedByDeadline.slice(0, 1).map(t => format(new Date(t.deadline!), 'dd MMM yyyy')).join(', ')}</strong></p>
        )}
      </div>
    </div>
  );
};

export default ScheduleTab;
