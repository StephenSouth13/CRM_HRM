import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Target, Plus, CheckCircle2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Goal {
  id: string;
  title: string;
  description?: string;
  category: 'product' | 'business' | 'team' | 'learning';
  status: 'active' | 'completed' | 'on_hold';
  progress: number;
  dueDate?: string;
  createdAt: string;
}

const GoalsTab = () => {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      title: 'Tăng tốc độ phản hồi hệ thống',
      description: 'Giảm thời gian phản hồi trung bình xuống dưới 200ms',
      category: 'product',
      status: 'active',
      progress: 65,
      dueDate: '2024-Q4',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Tăng tỷ lệ giữ chân người dùng',
      description: 'Đạt tỷ lệ giữ chân 85% trong quý này',
      category: 'business',
      status: 'active',
      progress: 45,
      dueDate: '2024-Q4',
      createdAt: new Date().toISOString()
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', category: 'product' });

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.title.trim()) return;

    const goal: Goal = {
      id: Date.now().toString(),
      title: newGoal.title,
      category: newGoal.category as Goal['category'],
      status: 'active',
      progress: 0,
      createdAt: new Date().toISOString()
    };

    setGoals([...goals, goal]);
    setNewGoal({ title: '', category: 'product' });
    setDialogOpen(false);
  };

  const updateGoalProgress = (id: string, progress: number) => {
    setGoals(goals.map(g => g.id === id ? { ...g, progress: Math.min(100, progress) } : g));
  };

  const toggleGoalStatus = (id: string) => {
    setGoals(goals.map(g => 
      g.id === id ? { ...g, status: g.status === 'completed' ? 'active' : 'completed' } : g
    ));
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
  };

  const getCategoryColor = (category: Goal['category']) => {
    switch (category) {
      case 'product': return 'bg-blue-100 text-blue-800';
      case 'business': return 'bg-green-100 text-green-800';
      case 'team': return 'bg-purple-100 text-purple-800';
      case 'learning': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const categoryLabels = {
    product: 'Sản Phẩm',
    business: 'Kinh Doanh',
    team: 'Nhóm',
    learning: 'Học Tập'
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const avgProgress = activeGoals.length > 0 
    ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Mục tiêu Hoạt Động</div>
            <div className="text-2xl font-bold mt-2">{activeGoals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tiến Độ Trung Bình</div>
            <div className="text-2xl font-bold mt-2">{avgProgress}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Hoàn Thành</div>
            <div className="text-2xl font-bold mt-2 text-green-600">{completedGoals.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Header with Add Goal */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Mục Tiêu & OKRs</h2>
          <p className="text-muted-foreground mt-1">Định hướng và theo dõi tiến độ đạt mục tiêu</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Thêm Mục Tiêu
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm Mục Tiêu Mới</DialogTitle>
              <DialogDescription>Tạo mục tiêu hoặc OKR mới cho nhóm</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <Label htmlFor="goal-title">Tiêu Đề</Label>
                <Input
                  id="goal-title"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="Nhập tiêu đề mục tiêu"
                />
              </div>
              <div>
                <Label htmlFor="goal-category">Danh Mục</Label>
                <select
                  id="goal-category"
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="product">Sản Phẩm</option>
                  <option value="business">Kinh Doanh</option>
                  <option value="team">Nhóm</option>
                  <option value="learning">Học Tập</option>
                </select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                <Button type="submit">Thêm Mục Tiêu</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {activeGoals.length > 0 ? (
          activeGoals.map((goal) => (
            <Card key={goal.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleGoalStatus(goal.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Circle className="h-6 w-6" />
                      </button>
                      <div>
                        <h3 className="text-lg font-semibold">{goal.title}</h3>
                        {goal.description && (
                          <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge className={getCategoryColor(goal.category)}>
                    {categoryLabels[goal.category]}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Tiến Độ</span>
                      <span className="text-sm font-semibold">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={goal.progress}
                      onChange={(e) => updateGoalProgress(goal.id, parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteGoal(goal.id)}
                    >
                      Xóa
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground py-8">
              Chưa có mục tiêu nào. Tạo mục tiêu đầu tiên!
            </CardContent>
          </Card>
        )}
      </div>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Mục Tiêu Hoàn Thành ({completedGoals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedGoals.map((goal) => (
                <div key={goal.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="line-through text-muted-foreground">{goal.title}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleGoalStatus(goal.id)}
                  >
                    Mở lại
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>💡 OKRs:</strong> Đặt mục tiêu rõ ràng (Objectives) và kết quả chính (Key Results) để hướng dẫn công việc hàng ngày.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoalsTab;
