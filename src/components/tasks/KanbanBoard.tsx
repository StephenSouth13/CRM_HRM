import { useState, useCallback, useEffect, useMemo } from 'react';

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, Loader2, AlertCircle, Search, X, MoreVertical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


// Task interface matching the Supabase schema
interface Task {
    id: string;
    title: string;
    description: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    deadline: string | null;
    assignee_id: string | null;
    creator_id: string;
    team_id: string | null;
    status: string;
    group_id: string | null;
    space_id: string | null;
    field_id: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    column_id: string;
}

interface KanbanColumnData {
    id: string;
    name: string;
    team_id: string;
    position: number;
    color: string;
}

interface Group {
    id: string;
    name: string;
    description?: string;
    color?: string;
    leader_id?: string;
}

interface Space {
    id: string;
    group_id: string;
    name: string;
    description?: string;
    color?: string;
}

interface KanbanBoardProps {
    teamId: string;
    userId: string;
    role: UserRole;
    users: Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>;
}

const colorBgClasses = {
    blue: 'bg-blue-50 border-t-4 border-blue-400 dark:bg-blue-950 dark:border-blue-700',
    red: 'bg-red-50 border-t-4 border-red-400 dark:bg-red-950 dark:border-red-700',
    yellow: 'bg-yellow-50 border-t-4 border-yellow-400 dark:bg-yellow-950 dark:border-yellow-700',
    green: 'bg-green-50 border-t-4 border-green-400 dark:bg-green-950 dark:border-green-700',
    purple: 'bg-purple-50 border-t-4 border-purple-400 dark:bg-purple-950 dark:border-purple-700',
    pink: 'bg-pink-50 border-t-4 border-pink-400 dark:bg-pink-950 dark:border-pink-700',
    gray: 'bg-gray-50 border-t-4 border-gray-400 dark:bg-gray-950 dark:border-gray-700',
    orange: 'bg-orange-50 border-t-4 border-orange-400 dark:bg-orange-950 dark:border-orange-700',
    cyan: 'bg-cyan-50 border-t-4 border-cyan-400 dark:bg-cyan-950 dark:border-cyan-700',
};

const priorityColors = {
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
};

export const KanbanBoard = ({ teamId, userId, role, users }: KanbanBoardProps) => {
    const { toast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [columns, setColumns] = useState<KanbanColumnData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [currentColumn, setCurrentColumn] = useState<KanbanColumnData | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [assigneeFilter, setAssigneeFilter] = useState('all');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedSpaceId, setSelectedSpaceId] = useState('');
    const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
    const [editingColumn, setEditingColumn] = useState<KanbanColumnData | null>(null);

    const fetchTasksAndColumns = useCallback(async () => {
        setIsLoading(true);
        try {
            const [columnsRes, tasksRes] = await Promise.all([
                supabase.from('task_columns').select('*').eq('team_id', teamId).order('position', { ascending: true }),
                supabase.from('tasks').select('*').eq('team_id', teamId)
            ]);

            if (columnsRes.error) throw columnsRes.error;
            if (tasksRes.error) throw tasksRes.error;

            setColumns(columnsRes.data || []);
            setTasks(tasksRes.data || []);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({ title: 'Lỗi', description: `Không thể tải dữ liệu: ${errorMessage}`, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [teamId, toast]);

    useEffect(() => {
        fetchTasksAndColumns();
    }, [fetchTasksAndColumns]);

    const createColumn = async (column: Omit<KanbanColumnData, 'id' | 'position'>) => {
        try {
            const { data, error } = await supabase
                .from('task_columns')
                .insert([{ ...column, position: columns.length, team_id: teamId }])
                .select();
            if (error) throw error;
            if (data) {
                setColumns([...columns, data[0]]);
                toast({ title: 'Thành công', description: 'Đã tạo cột mới.' });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({ title: 'Lỗi', description: `Không thể tạo cột: ${errorMessage}`, variant: 'destructive' });
        }
    };

    const updateColumn = async (column: KanbanColumnData) => {
        try {
            const { data, error } = await supabase
                .from('task_columns')
                .update(column)
                .eq('id', column.id)
                .select();
            if (error) throw error;
            if (data) {
                setColumns(columns.map(c => c.id === column.id ? data[0] : c));
                toast({ title: 'Thành công', description: 'Đã cập nhật cột.' });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({ title: 'Lỗi', description: `Không thể cập nhật cột: ${errorMessage}`, variant: 'destructive' });
        }
    };

    const deleteColumn = async (columnId: string) => {
        try {
            // Check if there are tasks in the column
            const { data: tasksInColumn, error: tasksError } = await supabase
                .from('tasks')
                .select('id')
                .eq('column_id', columnId)
                .limit(1);

            if (tasksError) throw tasksError;

            if (tasksInColumn && tasksInColumn.length > 0) {
                toast({
                    title: 'Không thể xóa',
                    description: 'Không thể xóa cột khi vẫn còn công việc trong đó.',
                    variant: 'destructive',
                });
                return;
            }

            const { error } = await supabase.from('task_columns').delete().eq('id', columnId);
            if (error) throw error;
            setColumns(columns.filter(c => c.id !== columnId));
            toast({ title: 'Thành công', description: 'Đã xóa cột.' });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({ title: 'Lỗi', description: `Không thể xóa cột: ${errorMessage}`, variant: 'destructive' });
        }
    };


    const createTask = useCallback(async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .insert([taskData])
                .select()
                .single();

            if (error) throw error;
            const createdTask = data as Task;
            setTasks(prev => [createdTask, ...prev]);
            toast({ title: 'Thành công', description: 'Công việc đã được tạo' });
            return createdTask;
        } catch (error) {
            console.error('Error creating task:', error);
            toast({ title: 'Lỗi', description: 'Không tạo được công việc', variant: 'destructive' });
        }
    }, [toast]);

    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskId)
                .select()
                .single();

            if (error) throw error;
            const updatedTask = data as Task;
            setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
            return updatedTask;
        } catch (error) {
            console.error('Error updating task:', error);
            toast({ title: 'Lỗi', description: 'Không cập nhật được công việc', variant: 'destructive' });
        }
    }, [toast]);

    const deleteTask = useCallback(async (taskId: string) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;
            setTasks(prev => prev.filter(t => t.id !== taskId));
            toast({ title: 'Thành công', description: 'Công việc đã bị xóa' });
        } catch (error) {
            console.error('Error deleting task:', error);
            toast({ title: 'Lỗi', description: 'Không xóa được công việc', variant: 'destructive' });
        }
    }, [toast]);

    const handleOpenColumnDialog = (column: KanbanColumnData | null) => {
        setEditingColumn(column);
        setIsColumnDialogOpen(true);
    };

    const handleSaveColumn = (columnData: { name: string; color: string }) => {
        if (editingColumn) {
            updateColumn({ ...editingColumn, ...columnData });
        } else {
            createColumn(columnData);
        }
        setIsColumnDialogOpen(false);
        setEditingColumn(null);
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="dark:bg-gray-800">
                        <CardHeader>
                            <Skeleton className="h-5 w-24 bg-gray-200 dark:bg-gray-700" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 3 }).map((_, j) => (
                                <Skeleton key={j} className="h-24 w-full bg-gray-100 dark:bg-gray-700" />
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Bảng Kanban</h2>
                <Button onClick={() => handleOpenColumnDialog(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm Cột
                </Button>
            </div>

            {columns.length === 0 ? (
                <Card className="bg-muted/50 dark:bg-gray-800">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Chưa có cột nào. Hãy tạo một cột để bắt đầu!</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-max overflow-x-auto min-h-[500px]">
                    {columns.map(column => {
                        const columnTasks = tasks.filter(t => t.column_id === column.id);
                        return (
                            <KanbanColumn
                                key={column.id}
                                column={column}
                                tasks={columnTasks}
                                userId={userId}
                                role={role}
                                users={users}
                                teamId={teamId}
                                selectedGroupId={selectedGroupId}
                                selectedSpaceId={selectedSpaceId}
                                groups={[]}
                                spaces={[]}
                                onCreateTask={createTask}
                                onUpdateTask={updateTask}
                                onDeleteTask={deleteTask}
                                onEditColumn={() => handleOpenColumnDialog(column)}
                                onDeleteColumn={() => deleteColumn(column.id)}
                            />
                        );
                    })}
                </div>
            )}
            <ColumnDialog
                isOpen={isColumnDialogOpen}
                onClose={() => setIsColumnDialogOpen(false)}
                onSave={handleSaveColumn}
                column={editingColumn}
            />
        </div>
    );
};


interface KanbanColumnProps {
    column: KanbanColumnData;
    tasks: Task[];
    userId: string;
    role: UserRole;
    teamId: string;
    selectedGroupId: string;
    selectedSpaceId: string;
    groups: Group[];
    spaces: Space[];
    users: Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>;
    onCreateTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) => Promise<Task | undefined>;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<Task | undefined>;
    onDeleteTask: (taskId: string) => Promise<void>;
    onEditColumn: () => void;
    onDeleteColumn: () => void;
}

const KanbanColumn = ({
    column,
    tasks,
    userId,
    role,
    teamId,
    selectedGroupId,
    selectedSpaceId,
    groups,
    spaces,
    users,
    onCreateTask,
    onUpdateTask,
    onDeleteTask,
    onEditColumn,
    onDeleteColumn,
}: KanbanColumnProps) => {
    const { toast } = useToast();
    const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
    const [taskTitle, setTaskTitle] = useState('');
    const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [isLoading, setIsLoading] = useState(false);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskTitle.trim()) {
            toast({
                title: 'Lỗi',
                description: 'Tiêu đề công việc là bắt buộc',
                variant: 'destructive'
            });
            return;
        }

        setIsLoading(true);
        try {
            await onCreateTask({
                title: taskTitle,
                description: null,
                priority: taskPriority,
                deadline: null,
                assignee_id: null,
                creator_id: userId,
                team_id: teamId,
                group_id: selectedGroupId || null,
                space_id: selectedSpaceId || null,
                field_id: null,
                status: column.name,
                column_id: column.id
            });
            setTaskTitle('');
            setTaskPriority('medium');
            setIsAddTaskOpen(false);
            toast({
                title: 'Thành công',
                description: 'Công việc đã được tạo'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const colorClass = colorBgClasses[column.color as keyof typeof colorBgClasses] || colorBgClasses.gray;

    return (
        <Card className={`${colorClass} w-full min-w-[280px] max-w-full h-fit shadow-lg dark:shadow-xl`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider dark:text-gray-200">
                        {column.name}
                        <Badge variant="secondary" className="ml-2 text-xs dark:bg-gray-700 dark:text-gray-300">
                            {tasks.length}
                        </Badge>
                    </CardTitle>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onEditColumn}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                Sửa Cột
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDeleteColumn} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Xóa Cột
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {tasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        users={users}
                        groups={groups}
                        spaces={spaces}
                        currentUserId={userId}
                        onUpdate={onUpdateTask}
                        onDelete={onDeleteTask}
                    />
                ))}

                {tasks.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-xs dark:text-gray-500">
                        Chưa có công việc nào
                    </div>
                )}

                <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full text-xs hover:bg-primary/10 dark:hover:bg-primary/20">
                            <Plus className="h-3 w-3 mr-1" />
                            Thêm Công Việc
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Thêm Công Việc vào "{column.name}"</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddTask} className="space-y-4">
                            <div>
                                <Label htmlFor="task-title">Tiêu đề Công việc</Label>
                                <Input
                                    id="task-title"
                                    value={taskTitle}
                                    onChange={(e) => setTaskTitle(e.target.value)}
                                    placeholder="Tiêu đề công việc"
                                    disabled={isLoading}
                                />
                            </div>
                            <div>
                                <Label htmlFor="task-priority">Ưu tiên</Label>
                                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as 'low' | 'medium' | 'high' | 'urgent')}>
                                    <SelectTrigger id="task-priority">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low (Thấp)</SelectItem>
                                        <SelectItem value="medium">Medium (Trung bình)</SelectItem>
                                        <SelectItem value="high">High (Cao)</SelectItem>
                                        <SelectItem value="urgent">Urgent (Khẩn cấp)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter className="pt-4">
                                <Button variant="outline" onClick={() => setIsAddTaskOpen(false)} type="button" disabled={isLoading}>
                                    Hủy
                                </Button>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    Thêm
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

interface TaskCardProps {
    task: Task;
    users: Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>;
    groups: Group[];
    spaces: Space[];
    currentUserId: string;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<Task | undefined>;
    onDelete: (taskId: string) => Promise<void>;
}

const TaskCard = ({ task, users, groups, spaces, currentUserId, onUpdate, onDelete }: TaskCardProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [formData, setFormData] = useState(task);
    const [isLoading, setIsLoading] = useState(false);

    const assignee = users.find(u => u.id === task.assignee_id);
    const group = groups.find(g => g.id === task.group_id);
    const space = spaces.find(s => s.id === task.space_id);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await onUpdate(task.id, formData);
            setIsOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            await onDelete(task.id);
            setIsOpen(false);
            setIsDeleteConfirmOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setFormData(task);
    }, [task]);

    return (
        <>
            <Card className="bg-white dark:bg-gray-700 border-l-4 border-gray-200 dark:border-gray-600 hover:shadow-lg cursor-pointer transition-all" onClick={() => setIsOpen(true)}>
                <CardContent className="p-3 space-y-2">
                    <h4 className="text-sm font-medium line-clamp-2 dark:text-white">{task.title}</h4>

                    {(space || group) && (
                        <div className="flex flex-wrap gap-1">
                            {space && (
                                <Badge variant="outline" className="text-xs bg-cyan-50 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700">
                                    {space.name}
                                </Badge>
                            )}
                            {group && !space && (
                                <Badge variant="outline" className="text-xs">
                                    {group.name}
                                </Badge>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-1 items-center">
                        <Badge className={`text-xs ${priorityColors[task.priority]} font-semibold`} variant="secondary">
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </Badge>
                        {task.deadline && (
                            <p className="text-xs text-muted-foreground dark:text-gray-400">
                                📅 {format(new Date(task.deadline), 'MMM dd, yyyy')}
                            </p>
                        )}
                    </div>
                    {assignee && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
                            <img
                                src={assignee.avatar_url || `https://placehold.co/20x20/2563EB/ffffff?text=${(assignee.first_name || 'U').charAt(0)}`}
                                alt={`${assignee.first_name} avatar`}
                                className="w-5 h-5 rounded-full object-cover"
                            />
                            {assignee.first_name} {assignee.last_name}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Chỉnh sửa Công việc</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit-title">Tiêu đề</Label>
                            <Input
                                id="edit-title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-description">Mô tả</Label>
                            <Input
                                id="edit-description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                                disabled={isLoading}
                                placeholder="Mô tả công việc"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-priority">Ưu tiên</Label>
                            <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as 'low' | 'medium' | 'high' | 'urgent' })}>
                                <SelectTrigger id="edit-priority">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low (Thấp)</SelectItem>
                                    <SelectItem value="medium">Medium (Trung bình)</SelectItem>
                                    <SelectItem value="high">High (Cao)</SelectItem>
                                    <SelectItem value="urgent">Urgent (Khẩn cấp)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="edit-assignee">Người được giao</Label>
                            <Select value={formData.assignee_id || ''} onValueChange={(v) => setFormData({ ...formData, assignee_id: v || null })}>
                                <SelectTrigger id="edit-assignee">
                                    <SelectValue placeholder="Chưa giao" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.first_name} {user.last_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="edit-deadline">Deadline</Label>
                            <Input
                                id="edit-deadline"
                                type="date"
                                value={formData.deadline ? formData.deadline.split('T')[0] : ''}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value || null })}
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between pt-4">
                        <DialogTrigger asChild>
                            <Button variant="destructive" onClick={() => setIsDeleteConfirmOpen(true)} disabled={isLoading} size="sm">
                                <Trash2 className="h-4 w-4 mr-2" /> Xóa
                            </Button>
                        </DialogTrigger>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsOpen(false)} type="button" disabled={isLoading}>
                                Hủy
                            </Button>
                            <Button onClick={handleSave} disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Lưu
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận Xóa Công việc</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn xóa công việc "{task.title}" không? Hành động này không thể hoàn tác.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isLoading}>
                            Hủy
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Xóa Công việc
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

interface ColumnDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (columnData: { name: string; color: string }) => void;
    column: KanbanColumnData | null;
}

const ColumnDialog = ({ isOpen, onClose, onSave, column }: ColumnDialogProps) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState('gray');

    useEffect(() => {
        if (column) {
            setName(column.name);
            setColor(column.color);
        } else {
            setName('');
            setColor('gray');
        }
    }, [column]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            // Basic validation
            return;
        }
        onSave({ name, color });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{column ? 'Sửa Cột' : 'Tạo Cột Mới'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="column-name">Tên Cột</Label>
                        <Input
                            id="column-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ví dụ: Cần làm"
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="column-color">Màu Sắc</Label>
                        <Select value={color} onValueChange={setColor}>
                            <SelectTrigger id="column-color">
                                <SelectValue placeholder="Chọn màu" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(colorBgClasses).map(([colorKey, className]) => (
                                    <SelectItem key={colorKey} value={colorKey}>
                                        <div className="flex items-center">
                                            <span className={`w-4 h-4 rounded-full mr-2 ${colorBgClasses[colorKey as keyof typeof colorBgClasses].split(' ')[0]}`}></span>
                                            {colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
                        <Button type="submit">Lưu</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};