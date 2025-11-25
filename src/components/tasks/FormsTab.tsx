import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, FileText, Send } from "lucide-react";

interface Form {
  id: string;
  title: string;
  description: string;
  fields: string[];
  createdAt: string;
  usageCount: number;
}

const FormsTab = () => {
  const [forms, setForms] = useState<Form[]>([
    {
      id: '1',
      title: 'Bug Report',
      description: 'Báo cáo lỗi phần mềm chi tiết',
      fields: ['Mô tả lỗi', 'Cách tái hiện', 'Kết quả mong đợi', 'Hệ thống'],
      createdAt: new Date().toISOString(),
      usageCount: 12
    },
    {
      id: '2',
      title: 'Feature Request',
      description: 'Yêu cầu tính năng mới',
      fields: ['Tên tính năng', 'Mô tả', 'Lợi ích', 'Độ ưu tiên'],
      createdAt: new Date().toISOString(),
      usageCount: 8
    },
    {
      id: '3',
      title: 'Performance Issue',
      description: 'Báo cáo vấn đề hiệu suất',
      fields: ['Mô tả vấn đề', 'Tác động', 'Cách tái hiện', 'Môi trường'],
      createdAt: new Date().toISOString(),
      usageCount: 5
    }
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', description: '', fields: '' });
  const { toast } = useToast();

  const handleAddForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.title.trim() || !newForm.description.trim()) return;

    const fieldsList = newForm.fields
      .split('\n')
      .map(f => f.trim())
      .filter(f => f);

    const form: Form = {
      id: Date.now().toString(),
      title: newForm.title,
      description: newForm.description,
      fields: fieldsList.length > 0 ? fieldsList : ['Nội dung'],
      createdAt: new Date().toISOString(),
      usageCount: 0
    };

    setForms([...forms, form]);
    setNewForm({ title: '', description: '', fields: '' });
    setDialogOpen(false);
    toast({
      title: 'Thành công',
      description: 'Biểu mẫu đã được tạo'
    });
  };

  const deleteForm = (id: string) => {
    setForms(forms.filter(f => f.id !== id));
    toast({
      title: 'Thành công',
      description: 'Biểu mẫu đã được xóa'
    });
  };

  const useForm = (form: Form) => {
    // In real implementation, this would navigate to create a task with this template
    toast({
      title: 'Sử dụng Biểu Mẫu',
      description: `Tạo công việc từ "${form.title}" - tính năng sẽ sớm có`
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Form */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Biểu Mẫu & Templates</h2>
          <p className="text-muted-foreground mt-1">Tạo công việc từ các biểu mẫu có sẵn</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Biểu Mẫu Mới
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tạo Biểu Mẫu Mới</DialogTitle>
              <DialogDescription>Tạo biểu mẫu tạo công việc để chuẩn hóa quy trình</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddForm} className="space-y-4">
              <div>
                <Label htmlFor="form-title">Tên Biểu Mẫu</Label>
                <Input
                  id="form-title"
                  value={newForm.title}
                  onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                  placeholder="ví dụ: Bug Report"
                />
              </div>
              <div>
                <Label htmlFor="form-description">Mô Tả</Label>
                <Input
                  id="form-description"
                  value={newForm.description}
                  onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  placeholder="Mô tả biểu mẫu"
                />
              </div>
              <div>
                <Label htmlFor="form-fields">Các Trường (mỗi dòng một trường)</Label>
                <Textarea
                  id="form-fields"
                  value={newForm.fields}
                  onChange={(e) => setNewForm({ ...newForm, fields: e.target.value })}
                  placeholder="Tên trường 1&#10;Tên trường 2&#10;Tên trường 3"
                  rows={5}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                <Button type="submit">Tạo Biểu Mẫu</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Forms Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {forms.map((form) => (
          <Card key={form.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{form.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {form.description}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fields */}
              <div>
                <h4 className="text-sm font-medium mb-2">Các Trường:</h4>
                <div className="space-y-1">
                  {form.fields.map((field, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span>{field}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats and Actions */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">
                    Đã sử dụng {form.usageCount} lần
                  </span>
                  <Badge variant="outline">{form.fields.length} trường</Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => useForm(form)}
                    className="flex-1"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Sử dụng
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteForm(form.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {forms.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-lg font-medium">Chưa có biểu mẫu nào</p>
            <p className="text-sm mt-1">Tạo biểu mẫu đầu tiên để chuẩn hóa tạo công việc</p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>📋 Biểu Mẫu:</strong> Tạo các biểu mẫu chuẩn để đảm bảo thông tin đầy đủ khi tạo công việc. Mỗi biểu mẫu có thể được sử dụng lặp lại với các giá trị khác nhau.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FormsTab;
