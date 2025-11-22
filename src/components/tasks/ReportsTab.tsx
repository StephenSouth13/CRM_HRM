import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserRole } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@/lib/auth";
import { Loader2, FileText, Clock, Users, Plus } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  content: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface MeetingMinutes {
  id: string;
  title: string;
  meeting_date: string;
  created_by: string;
  status: 'draft' | 'completed' | 'archived';
  attendees: string[];
  created_at: string;
}

const ReportsTab = ({ role }: { role: UserRole }) => {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');
  const { toast } = useToast();

  useEffect(() => {
    loadData();

    // Subscribe to real-time updates
    const reportsChannel = supabase
      .channel('daily_reports-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, () => {
        loadData();
      })
      .subscribe();

    const meetingsChannel = supabase
      .channel('meeting_minutes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_minutes' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(meetingsChannel);
    };
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load daily reports
      let reportsQuery = supabase.from('daily_reports').select('*');

      if (role !== 'admin' && role !== 'hr') {
        reportsQuery = reportsQuery.eq('user_id', user.id);
      }

      const { data: reportsData, error: reportsError } = await reportsQuery.order('report_date', { ascending: false });
      if (reportsError) {
        console.error('Reports query error:', reportsError);
        throw new Error(reportsError.message || 'Failed to load reports');
      }
      setReports(reportsData || []);

      // Load meeting minutes
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meeting_minutes')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (meetingsError) {
        console.error('Meetings query error:', meetingsError);
        throw new Error(meetingsError.message || 'Failed to load meetings');
      }
      setMeetings(meetingsData || []);

    } catch (error) {
      let errorMessage = 'Không thể tải báo cáo. Vui lòng thử lại sau.';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      console.error('Error loading reports:', error);
      toast({
        title: "Lỗi tải báo cáo",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Phê duyệt</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-800">Đã gửi</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Từ chối</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Nháp</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Báo Cáo & Biên Bản
          </CardTitle>
          <CardDescription>
            Quản lý báo cáo hàng ngày, biên bản họp và các mục hành động
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Báo Cáo Hàng Ngày
              </TabsTrigger>
              <TabsTrigger value="meetings" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Biên Bản Họp
              </TabsTrigger>
            </TabsList>

            {/* Daily Reports Tab */}
            <TabsContent value="reports" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Báo Cáo Hàng Ngày</h3>
                <Button size="sm" onClick={() => toast({
                  title: "Feature Coming Soon",
                  description: "Report creation will be available soon"
                })}>
                  <Plus className="h-4 w-4 mr-2" />
                  Báo Cáo Mới
                </Button>
              </div>

              {reports.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    Không có báo cáo nào. Hãy tạo báo cáo đầu tiên của bạn!
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <Card key={report.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">
                              Báo Cáo ngày {format(new Date(report.report_date), 'dd MMMM yyyy', { locale: vi })}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Tạo lúc: {format(new Date(report.created_at), 'dd MMM HH:mm', { locale: vi })}
                            </p>
                          </div>
                          {getStatusBadge(report.status)}
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">{report.content}</p>
                        <div className="mt-3 pt-3 border-t flex gap-2">
                          <Button variant="outline" size="sm">Xem Chi Tiết</Button>
                          {report.status === 'draft' && (
                            <Button variant="outline" size="sm">Chỉnh Sửa</Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Meeting Minutes Tab */}
            <TabsContent value="meetings" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Biên Bản Họp</h3>
                <Button size="sm" onClick={() => toast({
                  title: "Feature Coming Soon",
                  description: "Meeting minutes creation will be available soon"
                })}>
                  <Plus className="h-4 w-4 mr-2" />
                  Họp Mới
                </Button>
              </div>

              {meetings.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    Không có biên bản họp nào.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {meetings.map((meeting) => (
                    <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{meeting.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Ngày họp: {format(new Date(meeting.meeting_date), 'dd MMM yyyy HH:mm', { locale: vi })}
                            </p>
                          </div>
                          {getStatusBadge(meeting.status)}
                        </div>
                        <p className="text-sm text-gray-600">
                          👥 {meeting.attendees?.length || 0} người tham dự
                        </p>
                        <div className="mt-3 pt-3 border-t flex gap-2">
                          <Button variant="outline" size="sm">Xem Chi Tiết</Button>
                          <Button variant="outline" size="sm">Mục Hành Động</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>ℹ️ Thông tin:</strong> Báo cáo được lưu trữ trong cơ sở dữ liệu để theo dõi lịch sử và tạo báo cáo tổng hợp. Bất kỳ mục hành động nào từ biên bản họp sẽ tự động tạo thành công việc trong hệ thống.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
