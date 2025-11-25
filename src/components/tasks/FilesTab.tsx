import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { File, FileText, Image, FileAudio, FileVideo, Upload, Trash2, Download, Share2, Folder } from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  type: 'document' | 'image' | 'audio' | 'video' | 'other';
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  taskId?: string;
}

const FilesTab = () => {
  const [files] = useState<FileItem[]>([
    {
      id: '1',
      name: 'Project Requirements.pdf',
      type: 'document',
      size: 2048000,
      uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      uploadedBy: 'John Manager',
      taskId: 'TASK-001'
    },
    {
      id: '2',
      name: 'Design Mockup.png',
      type: 'image',
      size: 5242880,
      uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      uploadedBy: 'Jane Designer',
      taskId: 'TASK-002'
    },
    {
      id: '3',
      name: 'API Documentation.docx',
      type: 'document',
      size: 1048576,
      uploadedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      uploadedBy: 'Bob Developer',
      taskId: 'TASK-003'
    }
  ]);

  const getFileIcon = (type: FileItem['type']) => {
    switch (type) {
      case 'document':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'image':
        return <Image className="h-5 w-5 text-green-600" />;
      case 'audio':
        return <FileAudio className="h-5 w-5 text-purple-600" />;
      case 'video':
        return <FileVideo className="h-5 w-5 text-red-600" />;
      default:
        return <File className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTypeLabel = (type: FileItem['type']) => {
    const labels = {
      document: 'Tài liệu',
      image: 'Hình ảnh',
      audio: 'Âm thanh',
      video: 'Video',
      other: 'Khác'
    };
    return labels[type];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tài Liệu & File Đính Kèm</h2>
          <p className="text-muted-foreground mt-1">Quản lý các tài liệu, hình ảnh và file liên quan đến công việc</p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Tải File Lên
        </Button>
      </div>

      {/* File Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tổng File</div>
            <div className="text-2xl font-bold mt-2">{files.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Dung Lượng Sử Dụng</div>
            <div className="text-2xl font-bold mt-2">
              {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tài Liệu</div>
            <div className="text-2xl font-bold mt-2">
              {files.filter(f => f.type === 'document').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Hình Ảnh</div>
            <div className="text-2xl font-bold mt-2">
              {files.filter(f => f.type === 'image').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            File Gần Đây
          </CardTitle>
          <CardDescription>
            {files.length} file trong hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length > 0 ? (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-5 gap-4 px-4 py-2 bg-muted/50 rounded-lg text-sm font-semibold text-muted-foreground">
                <div>Tên File</div>
                <div>Loại</div>
                <div>Kích Thước</div>
                <div>Ngày Tải Lên</div>
                <div>Hành Động</div>
              </div>

              {files.map((file) => (
                <div key={file.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2 md:mb-0 md:grid md:grid-cols-5 md:gap-4">
                    <div className="flex items-start gap-3 col-span-1">
                      {getFileIcon(file.type)}
                      <div className="flex-1">
                        <h4 className="font-medium truncate">{file.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {file.uploadedBy}
                        </p>
                      </div>
                    </div>

                    <div className="hidden md:block">
                      <Badge variant="outline">{getTypeLabel(file.type)}</Badge>
                    </div>

                    <div className="hidden md:block text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </div>

                    <div className="hidden md:block text-sm text-muted-foreground">
                      {formatDate(file.uploadedAt)}
                    </div>

                    <div className="hidden md:flex gap-1">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>

                    {/* Mobile Actions */}
                    <div className="md:hidden flex gap-1 col-start-2">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Details */}
                  <div className="md:hidden text-xs text-muted-foreground mt-2 space-y-1">
                    <div>Loại: {getTypeLabel(file.type)}</div>
                    <div>Kích thước: {formatFileSize(file.size)}</div>
                    <div>Tải lên: {formatDate(file.uploadedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <File className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-lg font-medium">Chưa có file nào</p>
              <p className="text-sm mt-1">Tải file lên để chia sẻ với nhóm</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Hoạt Động Gần Đây</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {files.slice(0, 3).map((file) => (
              <div key={file.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  {getFileIcon(file.type)}
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.uploadedBy}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(file.uploadedAt)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Storage Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>📁 Lưu Trữ:</strong> Tất cả file được mã hóa và lưu trữ an toàn. Bạn có thể chia sẻ file với các thành viên nhóm hoặc công khai trên web.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FilesTab;
