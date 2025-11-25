import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, GitCommit, GitPullRequest, Code2, AlertCircle } from "lucide-react";

interface PullRequest {
  id: string;
  title: string;
  status: 'open' | 'merged' | 'draft' | 'closed';
  branch: string;
  author: string;
  createdAt: string;
}

interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
  taskId?: string;
}

const DevelopmentTab = () => {
  const [pullRequests] = useState<PullRequest[]>([
    {
      id: 'PR-123',
      title: 'Implement user authentication',
      status: 'open',
      branch: 'feature/auth',
      author: 'John Dev',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'PR-122',
      title: 'Fix performance issues on dashboard',
      status: 'merged',
      branch: 'hotfix/performance',
      author: 'Jane Dev',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]);

  const [commits] = useState<Commit[]>([
    {
      hash: 'a1b2c3d',
      message: 'Refactor authentication module',
      author: 'John Dev',
      date: new Date().toISOString(),
      taskId: 'TASK-001'
    },
    {
      hash: 'e4f5g6h',
      message: 'Add unit tests for API endpoints',
      author: 'Jane Dev',
      date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      taskId: 'TASK-002'
    }
  ]);

  const getStatusColor = (status: PullRequest['status']) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'merged':
        return 'bg-purple-100 text-purple-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: PullRequest['status']) => {
    switch (status) {
      case 'open':
        return 'Mở';
      case 'merged':
        return 'Đã Merge';
      case 'draft':
        return 'Nháp';
      case 'closed':
        return 'Đóng';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins}m trước`;
    if (diffHours < 24) return `${diffHours}h trước`;
    if (diffDays < 7) return `${diffDays}d trước`;

    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Development Tracking</h2>
        <p className="text-muted-foreground mt-1">Theo dõi Commits, Pull Requests, và Branches</p>
      </div>

      {/* Pull Requests Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5" />
            Pull Requests ({pullRequests.length})
          </CardTitle>
          <CardDescription>
            Theo dõi các pull request đang mở và đã merge
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pullRequests.length > 0 ? (
            pullRequests.map((pr) => (
              <div key={pr.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium">{pr.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pr.id} • {pr.author}
                    </p>
                  </div>
                  <Badge className={getStatusColor(pr.status)}>
                    {getStatusLabel(pr.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {pr.branch}
                  </span>
                  <span>{formatDate(pr.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              Không có pull request nào
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commits Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Commits Gần Đây ({commits.length})
          </CardTitle>
          <CardDescription>
            Các commit gần đây liên quan đến công việc
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {commits.length > 0 ? (
            commits.map((commit) => (
              <div key={commit.hash} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium">{commit.message}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {commit.author} • {commit.hash}
                    </p>
                  </div>
                  {commit.taskId && (
                    <Badge variant="secondary">{commit.taskId}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(commit.date)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              Không có commit nào
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branches Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Active Branches
          </CardTitle>
          <CardDescription>
            Các nhánh đang được phát triển
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border rounded-lg p-4">
            <h4 className="font-medium">main</h4>
            <p className="text-xs text-muted-foreground mt-1">Nhánh chính - production</p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-medium">develop</h4>
            <p className="text-xs text-muted-foreground mt-1">Nhánh phát triển - staging</p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-medium">feature/auth</h4>
            <p className="text-xs text-muted-foreground mt-1">Tính năng xác thực</p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-medium">hotfix/performance</h4>
            <p className="text-xs text-muted-foreground mt-1">Sửa lỗi hiệu suất</p>
          </div>
        </CardContent>
      </Card>

      {/* Integration Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Code2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900">Development Integration</p>
              <p className="text-blue-700 text-xs mt-1">
                Kết nối với GitHub, GitLab, hoặc Bitbucket để tự động theo dõi commits, PRs, và branches liên quan đến công việc.
              </p>
              <Button variant="outline" size="sm" className="mt-3">
                Cấu Hình Git Integration
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DevelopmentTab;
