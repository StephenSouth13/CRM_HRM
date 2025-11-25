import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserRole, getUserProfile } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@/lib/auth";
import { Loader2, FileText, Clock, Users, Plus, Send, CheckCircle2, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  content: string;
  tasks_completed: string[] | null;
  status: 'submitted' | 'pending_review' | 'approved' | 'rejected';
  approved_by: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  user?: { first_name: string | null; last_name: string | null; email: string };
  approver?: { first_name: string | null; last_name: string | null };
}

interface MeetingMinutes {
  id: string;
  title: string;
  meeting_date: string;
  notes: string | null;
  attendees: string[] | null;
  created_by: string;
  status: 'draft' | 'completed' | 'archived';
  action_items: string[] | null;
  created_at: string;
  updated_at: string;
  creator?: { first_name: string | null; last_name: string | null; email: string };
}

const ReportsTab = ({ role }: { role: UserRole }) => {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');
  const [userId, setUserId] = useState<string>('');
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  
  // Dialog states for creating reports
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingMinutes | null>(null);
  
  // Form states
  const [newReport, setNewReport] = useState({ report_date: '', content: '' });
  const [newMeeting, setNewMeeting] = useState({ title: '', meeting_date: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadUserData();
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

  const loadUserData = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        setUserId(user.id);
        const profile = await getUserProfile(user.id);
        if (profile?.team_id) {
          setUserTeamId(profile.team_id);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load daily reports based on role
      let reportsQuery = supabase
        .from('daily_reports')
        .select('*, user:user_id(first_name, last_name, email), approver:approved_by(first_name, last_name)');

      // Filter based on role
      if (role === 'staff') {
        // Staff can only see their own reports
        reportsQuery = reportsQuery.eq('user_id', user.id);
      } else if (role === 'leader') {
        // Leaders see their team's reports
        const profile = await getUserProfile(user.id);
        if (profile?.team_id) {
          reportsQuery = reportsQuery
            .select('*, user:user_id(first_name, last_name, email), approver:approved_by(first_name, last_name)')
            .in('user_id', 
              (await supabase
                .from('profiles')
                .select('id')
                .eq('team_id', profile.team_id))
              .data?.map(p => p.id) || []
            );
        }
      }
      // admin/hr see all reports - no filter

      const { data: reportsData, error: reportsError } = await reportsQuery
        .order('report_date', { ascending: false });

      if (!reportsError) {
        setReports(reportsData || []);
      } else {
        // Table might not exist yet - initialize with empty
        if (reportsError.code === 'PGRST116' || reportsError.message?.includes('relation')) {
          setReports([]);
        } else {
          throw reportsError;
        }
      }

      // Load meeting minutes based on role
      let meetingsQuery = supabase
        .from('meeting_minutes')
        .select('*, creator:created_by(first_name, last_name, email)');

      if (role !== 'admin' && role !== 'leader') {
        // Only show meetings where user is creator or attendee
        meetingsQuery = meetingsQuery
          .or(`created_by.eq.${user.id},attendees.cs.["${user.id}"]`);
      }

      const { data: meetingsData, error: meetingsError } = await meetingsQuery
        .order('meeting_date', { ascending: false });

      if (!meetingsError) {
        setMeetings(meetingsData || []);
      } else {
        if (meetingsError.code === 'PGRST116' || meetingsError.message?.includes('relation')) {
          setMeetings([]);
        } else {
          throw meetingsError;
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải báo cáo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReport.report_date || !newReport.content.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('daily_reports')
        .insert([{
          user_id: userId,
          report_date: newReport.report_date,
          content: newReport.content,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        }]);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Báo cáo đã được gửi"
      });

      setNewReport({ report_date: '', content: '' });
      setReportDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error creating report:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tạo báo cáo",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeeting.title || !newMeeting.meeting_date) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('meeting_minutes')
        .insert([{
          title: newMeeting.title,
          meeting_date: newMeeting.meeting_date,
          notes: newMeeting.notes,
          created_by: userId,
          status: 'draft'
        }]);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Biên bản họp đã được tạo"
      });

      setNewMeeting({ title: '', meeting_date: '', notes: '' });
      setMeetingDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tạo biên bản họp",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReport = async (reportId: string, approved: boolean) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('daily_reports')
        .update({
          status: approved ? 'approved' : 'rejected',
          approved_by: userId
        })
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: approved ? "Báo cáo đã được phê duyệt" : "Báo cáo đã bị từ chối"
      });

      loadData();
      setViewDialogOpen(false);
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật báo cáo",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canApproveReports = ['admin', 'leader'].includes(role);
  const canViewAllReports = ['admin', 'leader'].includes(role);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Đã phê duyệt</Badge>;
      case 'submitted':
      case 'pending_review':
        return <Badge className="bg-blue-100 text-blue-800">Chờ phê duyệt</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Bị từ chối</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Nháp</Badge>;
    }
  };

  const getFullName = (obj: { first_name: string | null; last_name: string | null } | undefined) => {
    if (!obj) return 'Unknown';
    return `${obj.first_name || ''} ${obj.last_name || ''}`.trim() || 'Unknown';
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
                <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Báo Cáo Mới
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tạo Báo Cáo Hàng Ngày</DialogTitle>
                      <DialogDescription>
                        Ghi lại công việc đã hoàn thành trong ngày
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateReport} className="space-y-4">
                      <div>
                        <Label htmlFor="report-date">Ngày</Label>
                        <Input
                          id="report-date"
                          type="date"
                          value={newReport.report_date}
                          onChange={(e) => setNewReport({ ...newReport, report_date: e.target.value })}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <Label htmlFor="report-content">Nội dung công việc đã hoàn thành</Label>
                        <Textarea
                          id="report-content"
                          value={newReport.content}
                          onChange={(e) => setNewReport({ ...newReport, content: e.target.value })}
                          placeholder="Mô tả công việc đã hoàn thành trong ngày..."
                          rows={5}
                          disabled={isSubmitting}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setReportDialogOpen(false)} disabled={isSubmitting}>
                          Hủy
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          Gửi Báo Cáo
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
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
                          <div className="flex-1">
                            <h4 className="font-semibold">
                              Báo Cáo ngày {format(new Date(report.report_date), 'dd MMMM yyyy', { locale: vi })}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {getFullName(report.user)} • {format(new Date(report.submitted_at), 'dd MMM HH:mm', { locale: vi })}
                            </p>
                          </div>
                          {getStatusBadge(report.status)}
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">{report.content}</p>
                        {report.status === 'approved' && report.approver && (
                          <p className="text-xs text-green-700 mt-2">
                            ✓ Phê duyệt bởi {getFullName(report.approver)}
                          </p>
                        )}
                        <div className="mt-3 pt-3 border-t flex gap-2">
                          <Dialog open={viewDialogOpen && selectedReport?.id === report.id} onOpenChange={setViewDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedReport(report)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Xem Chi Tiết
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Báo Cáo Hàng Ngày</DialogTitle>
                              </DialogHeader>
                              {selectedReport && (
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground">Ngày</h4>
                                    <p>{format(new Date(selectedReport.report_date), 'dd MMMM yyyy', { locale: vi })}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground">Người báo cáo</h4>
                                    <p>{getFullName(selectedReport.user)}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground">Nội dung</h4>
                                    <p className="whitespace-pre-wrap text-sm">{selectedReport.content}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground">Trạng thái</h4>
                                    <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
                                  </div>
                                  {canApproveReports && selectedReport.status === 'submitted' && (
                                    <DialogFooter className="flex gap-2 pt-4">
                                      <Button
                                        variant="outline"
                                        onClick={() => handleApproveReport(selectedReport.id, false)}
                                        disabled={isSubmitting}
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Từ Chối
                                      </Button>
                                      <Button
                                        onClick={() => handleApproveReport(selectedReport.id, true)}
                                        disabled={isSubmitting}
                                      >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Phê Duyệt
                                      </Button>
                                    </DialogFooter>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
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
                <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Biên Bản Mới
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tạo Biên Bản Họp</DialogTitle>
                      <DialogDescription>
                        Ghi lại nội dung và kết quả của cuộc họp
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateMeeting} className="space-y-4">
                      <div>
                        <Label htmlFor="meeting-title">Tiêu đề cuộc họp</Label>
                        <Input
                          id="meeting-title"
                          value={newMeeting.title}
                          onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                          placeholder="Tiêu đề cuộc họp"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <Label htmlFor="meeting-date">Thời gian họp</Label>
                        <Input
                          id="meeting-date"
                          type="datetime-local"
                          value={newMeeting.meeting_date}
                          onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <Label htmlFor="meeting-notes">Nội dung biên bản</Label>
                        <Textarea
                          id="meeting-notes"
                          value={newMeeting.notes}
                          onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                          placeholder="Ghi chú cuộc họp..."
                          rows={5}
                          disabled={isSubmitting}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setMeetingDialogOpen(false)} disabled={isSubmitting}>
                          Hủy
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          Tạo Biên Bản
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
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
                          <div className="flex-1">
                            <h4 className="font-semibold">{meeting.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {getFullName(meeting.creator)} • {format(new Date(meeting.meeting_date), 'dd MMM yyyy HH:mm', { locale: vi })}
                            </p>
                          </div>
                          <Badge variant={meeting.status === 'completed' ? 'default' : 'outline'}>
                            {meeting.status === 'draft' ? 'Nháp' : meeting.status === 'completed' ? 'Hoàn tất' : 'Lưu trữ'}
                          </Badge>
                        </div>
                        {meeting.notes && (
                          <p className="text-sm text-gray-700 line-clamp-2">{meeting.notes}</p>
                        )}
                        {meeting.attendees && meeting.attendees.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            👥 {meeting.attendees.length} người tham dự
                          </p>
                        )}
                        <div className="mt-3 pt-3 border-t flex gap-2">
                          <Button variant="outline" size="sm">Xem Chi Tiết</Button>
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
            <strong>ℹ️ Thông tin:</strong> Báo cáo được lưu trữ trong cơ sở dữ liệu để theo dõi lịch sử và tạo báo cáo tổng hợp. 
            {canApproveReports && " Bạn có quyền phê duyệt báo cáo từ nhóm của mình."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
