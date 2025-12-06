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
import { Plus, Trash2, Edit2, Loader2, AlertCircle, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

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
    status: 'todo' | 'in_progress' | 'review' | 'done';
    group_id: string | null;
    space_id: string | null;
    field_id: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

// Task status with display information
interface TaskStatus {
    value: 'todo' | 'in_progress' | 'review' | 'done';
    label: string;
    color: string;
}

const TASK_STATUSES: TaskStatus[] = [
    { value: 'todo', label: 'To Do', color: 'blue' },
    { value: 'in_progress', label: 'In Progress', color: 'yellow' },
    { value: 'review', label: 'Review', color: 'purple' },
    { value: 'done', label: 'Done', color: 'green' }
];

// --- useBoard HOOK LOGIC ---
const useBoard = (teamId: string) => {
    const { toast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch tasks
    const fetchTasks = useCallback(async () => {
        if (!teamId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('team_id', teamId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTasks(data || []);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            toast({
                title: 'Lỗi',
                description: 'Không tải được công việc',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    }, [teamId, toast]);

    // Create task
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

    // Update task
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

    // Delete task
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

    // Get tasks for a specific status
    const getTasksInStatus = useCallback((status: 'todo' | 'in_progress' | 'review' | 'done') => {
        return tasks.filter(t => t.status === status);
    }, [tasks]);

    // Initial load and Real-time subscription
    useEffect(() => {
        if (teamId) {
            fetchTasks();
        }
    }, [teamId, fetchTasks]);

    useEffect(() => {
        if (!teamId) return;

        // Subscriptions
        const tasksChannel = supabase
            .channel(`tasks-${teamId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `team_id=eq.${teamId}` }, () => {
                fetchTasks();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(tasksChannel);
        };
    }, [teamId, fetchTasks]);

    return {
        tasks,
        loading,
        createTask,
        updateTask,
        deleteTask,
        getTasksInStatus,
    };
};

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
    const {
        tasks,
        loading,
        createTask,
        updateTask,
        deleteTask,
        getTasksInStatus
    } = useBoard(teamId);

    // Group and Space states
    const [groups, setGroups] = useState<Group[]>([]);
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
    const [groupsLoading, setGroupsLoading] = useState(true);

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [assigneeFilter, setAssigneeFilter] = useState('all');

    // Fetch groups and spaces
    useEffect(() => {
        const fetchGroupsAndSpaces = async () => {
            try {
                setGroupsLoading(true);
                const { data: groupsData, error: groupsError } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('team_id', teamId)
                    .eq('is_active', true)
                    .order('position', { ascending: true });

                if (groupsError) {
                    console.error('Groups fetch error:', groupsError.message, groupsError);
                    throw new Error(`Failed to fetch groups: ${groupsError.message}`);
                }

                const fetchedGroups = (groupsData || []) as Group[];
                setGroups(fetchedGroups);

                if (fetchedGroups.length > 0 && !selectedGroupId) {
                    const defaultGroup = fetchedGroups[0];
                    setSelectedGroupId(defaultGroup.id);

                    const { data: spacesData, error: spacesError } = await supabase
                        .from('spaces')
                        .select('*')
                        .eq('group_id', defaultGroup.id)
                        .eq('is_active', true)
                        .order('position', { ascending: true });

                    if (spacesError) {
                        console.error('Spaces fetch error:', spacesError.message, spacesError);
                        throw new Error(`Failed to fetch spaces: ${spacesError.message}`);
                    }

                    const fetchedSpaces = (spacesData || []) as Space[];
                    setSpaces(fetchedSpaces);
                    if (fetchedSpaces.length > 0) {
                        setSelectedSpaceId(fetchedSpaces[0].id);
                    }
                } else if (fetchedGroups.length === 0) {
                    console.warn('No groups found for team:', teamId);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('Error fetching groups and spaces:', errorMessage);
                toast({
                    title: 'Lỗi',
                    description: errorMessage || 'Không tải được nhóm và không gian',
                    variant: 'destructive'
                });
                setGroups([]);
                setSpaces([]);
            } finally {
                setGroupsLoading(false);
            }
        };

        if (teamId) {
            fetchGroupsAndSpaces();
        }
    }, [teamId, toast]);

    // Handle group change
    const handleGroupChange = async (groupId: string) => {
        setSelectedGroupId(groupId);
        setSelectedSpaceId('');

        try {
            const { data: spacesData, error } = await supabase
                .from('spaces')
                .select('*')
                .eq('group_id', groupId)
                .eq('is_active', true)
                .order('position', { ascending: true });

            if (error) {
                console.error('Spaces fetch error:', error.message, error);
                throw new Error(`Failed to fetch spaces: ${error.message}`);
            }

            const fetchedSpaces = (spacesData || []) as Space[];
            setSpaces(fetchedSpaces);
            if (fetchedSpaces.length > 0) {
                setSelectedSpaceId(fetchedSpaces[0].id);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error fetching spaces:', errorMessage);
            toast({
                title: 'Lỗi',
                description: errorMessage || 'Không tải được không gian',
                variant: 'destructive'
            });
            setSpaces([]);
        }
    };

    // Filter tasks based on search, group, space, and other filters
    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const matchesSearch = searchQuery === '' ||
                task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

            const matchesGroup = !selectedGroupId || task.group_id === selectedGroupId;
            const matchesSpace = !selectedSpaceId || task.space_id === selectedSpaceId;
            const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
            const matchesAssignee = assigneeFilter === 'all' || task.assignee_id === assigneeFilter;

            return matchesSearch && matchesGroup && matchesSpace && matchesPriority && matchesAssignee;
        });
    }, [tasks, searchQuery, selectedGroupId, selectedSpaceId, priorityFilter, assigneeFilter]);

    const uniquePriorities = useMemo(() =>
        ['all', ...new Set(tasks.map(t => t.priority))],
        [tasks]
    );

    const uniqueAssignees = useMemo(() =>
        [...new Set(tasks.filter(t => t.assignee_id).map(t => t.assignee_id))],
        [tasks]
    );

    const clearFilters = () => {
        setSearchQuery('');
        setPriorityFilter('all');
        setAssigneeFilter('all');
    };

    const hasActiveFilters = searchQuery || priorityFilter !== 'all' || assigneeFilter !== 'all';

    if (loading) {
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
            {/* Group and Space Selection Controls - Only show if groups exist */}
            {groups.length > 0 && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground">Chọn Nhóm & Không Gian</h3>
                        {(selectedGroupId || selectedSpaceId) && (
                            <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (groups.length > 0) {
                                    setSelectedGroupId(groups[0].id);
                                }
                                setSelectedSpaceId('');
                            }}
                            className="text-xs"
                        >
                                <X className="h-3 w-3 mr-1" />
                                Đặt lại
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Group Selector */}
                        {groups.length > 0 && (
                            <Select value={selectedGroupId || ''} onValueChange={handleGroupChange}>
                                <SelectTrigger className="bg-white dark:bg-gray-700">
                                    <SelectValue placeholder="Chọn Nhóm..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.map(group => (
                                        <SelectItem key={group.id} value={group.id}>
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: `var(--color-${group.color || 'blue'})` }}
                                                ></span>
                                                {group.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Space Selector */}
                        {spaces.length > 0 && (
                            <Select value={selectedSpaceId || '__all__'} onValueChange={(value) => setSelectedSpaceId(value === '__all__' ? '' : value)}>
                                <SelectTrigger className="bg-white dark:bg-gray-700">
                                    <SelectValue placeholder="Chọn Không Gian..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">Tất cả Không Gian</SelectItem>
                                    {spaces.map(space => (
                                        <SelectItem key={space.id} value={space.id}>
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: `var(--color-${space.color || 'cyan'})` }}
                                                ></span>
                                                {space.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {selectedGroupId && (
                        <div className="text-xs text-muted-foreground">
                            Nhóm: <span className="font-semibold">{groups.find(g => g.id === selectedGroupId)?.name}</span>
                            {selectedSpaceId && (
                                <> • Không gian: <span className="font-semibold">{spaces.find(s => s.id === selectedSpaceId)?.name}</span></>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Search and Filter Controls */}
            <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Tìm kiếm & Lọc</h3>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="text-xs"
                        >
                            <X className="h-4 w-4 mr-1" />
                            Xóa lọc
                        </Button>
                    )}
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm kiếm công việc theo tiêu đề hoặc mô tả..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-700"
                    />
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Priority Filter */}
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="bg-white dark:bg-gray-700">
                            <SelectValue placeholder="Lọc theo ưu tiên" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả ưu tiên</SelectItem>
                            {uniquePriorities.map(priority => (
                                priority !== 'all' && (
                                    <SelectItem key={priority} value={priority}>
                                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                                    </SelectItem>
                                )
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Assignee Filter */}
                    <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                        <SelectTrigger className="bg-white dark:bg-gray-700">
                            <SelectValue placeholder="Lọc theo người được giao" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả người được giao</SelectItem>
                            {uniqueAssignees.map(assigneeId => (
                                <SelectItem key={assigneeId} value={assigneeId}>
                                    ID: {assigneeId.substring(0, 8)}...
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Results Info */}
                <div className="text-xs text-muted-foreground">
                    {filteredTasks.length === tasks.length
                        ? `Tổng cộng ${tasks.length} công việc`
                        : `Hiển thị ${filteredTasks.length} / ${tasks.length} công việc`}
                </div>
            </div>

            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Bảng Kanban</h2>
            </div>

            {tasks.length === 0 ? (
                <Card className="bg-muted/50 dark:bg-gray-800">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Chưa có công việc nào. Hãy tạo một công việc để bắt đầu!</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-max overflow-x-auto min-h-[500px]">
                    {TASK_STATUSES.map(status => {
                        const statusTasks = filteredTasks.filter(t => t.status === status.value);
                        return (
                            <KanbanColumn
                                key={status.value}
                                status={status}
                                tasks={statusTasks}
                                userId={userId}
                                users={users}
                                teamId={teamId}
                                selectedGroupId={selectedGroupId}
                                selectedSpaceId={selectedSpaceId}
                                groups={groups}
                                spaces={spaces}
                                onCreateTask={createTask}
                                onUpdateTask={updateTask}
                                onDeleteTask={deleteTask}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface KanbanColumnProps {
    status: TaskStatus;
    tasks: Task[];
    userId: string;
    teamId: string;
    selectedGroupId: string;
    selectedSpaceId: string;
    groups: Group[];
    spaces: Space[];
    users: Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>;
    onCreateTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) => Promise<Task | undefined>;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<Task | undefined>;
    onDeleteTask: (taskId: string) => Promise<void>;
}

const KanbanColumn = ({
    status,
    tasks,
    userId,
    teamId,
    selectedGroupId,
    selectedSpaceId,
    groups,
    spaces,
    users,
    onCreateTask,
    onUpdateTask,
    onDeleteTask,
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
                status: status.value
            });
            setTaskTitle('');
            setTaskPriority('medium');
            setIsAddTaskOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    const colorClass = colorBgClasses[status.color as keyof typeof colorBgClasses];

    return (
        <Card className={`${colorClass} w-full min-w-[280px] max-w-full h-fit shadow-lg dark:shadow-xl`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider dark:text-gray-200">
                        {status.label}
                        <Badge variant="secondary" className="ml-2 text-xs dark:bg-gray-700 dark:text-gray-300">
                            {tasks.length}
                        </Badge>
                    </CardTitle>
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
                            <DialogTitle>Thêm Công Việc vào "{status.label}"</DialogTitle>
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
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<Task | undefined>;
    onDelete: (taskId: string) => Promise<void>;
}

const TaskCard = ({ task, users, groups, spaces, onUpdate, onDelete }: TaskCardProps) => {
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

                    {/* Space and Group Info */}
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
                            <Label htmlFor="edit-status">Trạng thái</Label>
                            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as 'todo' | 'in_progress' | 'review' | 'done' })}>
                                <SelectTrigger id="edit-status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todo">To Do</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="review">Review</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
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
                        <div>
                            <Label htmlFor="edit-group">Nhóm</Label>
                            <Select value={formData.group_id || '__none__'} onValueChange={(v) => setFormData({ ...formData, group_id: v === '__none__' ? null : v, space_id: null })}>
                                <SelectTrigger id="edit-group">
                                    <SelectValue placeholder="Chọn Nhóm" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Không có nhóm</SelectItem>
                                    {groups.map(group => (
                                        <SelectItem key={group.id} value={group.id}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.group_id && spaces.filter(s => s.group_id === formData.group_id).length > 0 && (
                            <div>
                                <Label htmlFor="edit-space">Không Gian</Label>
                                <Select value={formData.space_id || '__none__'} onValueChange={(v) => setFormData({ ...formData, space_id: v === '__none__' ? null : v })}>
                                    <SelectTrigger id="edit-space">
                                        <SelectValue placeholder="Chọn Không Gian" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Không có không gian</SelectItem>
                                        {spaces.filter(s => s.group_id === formData.group_id).map(space => (
                                            <SelectItem key={space.id} value={space.id}>
                                                {space.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
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
