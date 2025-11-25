import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { vi } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
}

interface TaskCalendarViewProps {
  tasks: Task[];
  onTaskReschedule: (taskId: string, deadline: string | null) => void;
}

const TaskCalendarView = ({ tasks, onTaskReschedule }: TaskCalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      return isSameDay(taskDate, day);
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-50';
      case 'review': return 'bg-purple-50';
      case 'in_progress': return 'bg-blue-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          {format(currentDate, 'MMMM yyyy', { locale: vi })}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(new Date())}
            className="px-4"
          >
            Hôm nay
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-0 border-b bg-muted/50">
          {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map((day) => (
            <div key={day} className="p-2 text-center font-semibold text-sm border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-0">
          {days.map((day) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toString()}
                className={`min-h-24 p-2 border-r border-b last:border-r-0 ${
                  isCurrentMonth ? 'bg-background' : 'bg-muted/20'
                }`}
              >
                <div className="text-sm font-semibold mb-1">
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${getPriorityColor(
                        task.priority
                      )}`}
                      title={task.title}
                    >
                      <div className="truncate font-medium">{task.title.substring(0, 15)}</div>
                      <Badge variant="outline" className="text-xs mt-0.5">{task.status}</Badge>
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-xs text-muted-foreground p-1">
                      +{dayTasks.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Details for Selected Date */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            💡 Tip: Hiển thị các công việc có deadline trong tháng này. Sử dụng chỉnh sửa công việc để thay đổi deadline.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskCalendarView;
