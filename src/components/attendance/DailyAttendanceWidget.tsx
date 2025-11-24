import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, LogOut, TrendingUp, Calendar as CalendarIcon, Loader2, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { vi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser, getUserRole } from "@/lib/auth";

interface AttendanceSession {
  id: string;
  user_id: string;
  session_date: string;
  check_in: string;
  check_out: string | null;
  location_checkin: string | null;
  location_checkout: string | null;
  notes: string | null;
  is_auto_checkout: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface DailyRecord {
  id: string;
  user_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number;
  session_count: number;
  status: 'pending' | 'present' | 'absent' | 'late' | 'leave';
  notes: string | null;
  created_at: string;
}

interface DailyStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  totalHours: number;
  averageHoursPerDay: number;
}

const DailyAttendanceWidget = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("staff");
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([]);
  const [todayRecord, setTodayRecord] = useState<DailyRecord | null>(null);
  const [allRecords, setAllRecords] = useState<DailyRecord[]>([]);
  const [stats, setStats] = useState<DailyStats>({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    totalHours: 0,
    averageHoursPerDay: 0
  });
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [hasUnclosedSession, setHasUnclosedSession] = useState(false);

  const calculateStats = useCallback((records: DailyRecord[]) => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const monthRecords = records.filter(r => {
      const recordDate = new Date(r.attendance_date);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    const presentDays = monthRecords.filter(r => r.status === 'present').length;
    const absentDays = monthRecords.filter(r => r.status === 'absent' || r.status === 'leave').length;
    const totalHours = monthRecords.reduce((sum, r) => sum + r.total_hours, 0);

    setStats({
      totalDays: monthRecords.length,
      presentDays,
      absentDays,
      totalHours,
      averageHoursPerDay: presentDays > 0 ? totalHours / presentDays : 0
    });
  }, []);

  const getLocation = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
          },
          () => {
            resolve("Không lấy được vị trí");
          },
          { timeout: 5000 }
        );
      } else {
        resolve("Trình duyệt không hỗ trợ vị trí");
      }
    });
  };

  const loadTodaySessions = useCallback(async (uid: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];

      const { data: records, error: recordsError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', uid)
        .gte('timestamp', `${today}T00:00:00`)
        .lt('timestamp', `${tomorrow}T00:00:00`)
        .order('timestamp', { ascending: true });

      if (recordsError) throw new Error(recordsError.message);

      // Group records into sessions (check_in followed by check_out)
      const sessions: any[] = [];
      let currentSession: any = null;

      (records || []).forEach(record => {
        if (record.type === 'check_in') {
          if (currentSession) {
            sessions.push(currentSession);
          }
          currentSession = {
            id: record.id,
            user_id: record.user_id,
            check_in: record.timestamp,
            check_out: null,
            location_checkin: record.location,
            location_checkout: null,
            notes: record.notes
          };
        } else if (record.type === 'check_out' && currentSession) {
          currentSession.check_out = record.timestamp;
          currentSession.location_checkout = record.location;
          sessions.push(currentSession);
          currentSession = null;
        }
      });

      // Add unclosed session if exists
      if (currentSession) {
        sessions.push(currentSession);
      }

      setTodaySessions(sessions);

      // Check if any session is unclosed
      const unclosed = sessions.some(s => !s.check_out);
      setHasUnclosedSession(unclosed);

      // Calculate daily summary
      const totalHours = sessions.reduce((sum, session) => {
        if (session.check_in && session.check_out) {
          const inTime = new Date(session.check_in).getTime();
          const outTime = new Date(session.check_out).getTime();
          return sum + (outTime - inTime) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);

      if (sessions.length > 0) {
        setTodayRecord({
          id: `daily-${uid}-${today}`,
          user_id: uid,
          attendance_date: today,
          check_in_time: sessions[0].check_in,
          check_out_time: sessions[sessions.length - 1].check_out,
          total_hours: totalHours,
          session_count: sessions.length,
          status: 'present',
          notes: null,
          created_at: new Date().toISOString()
        });
      } else {
        setTodayRecord(null);
      }
    } catch (error) {
      let errorMessage = 'Không thể tải chấm công hôm nay';
      try {
        if (error instanceof Error) {
          errorMessage = error.message;
        }
      } catch (e) {
        // Error object might not be accessible due to response streaming issues
        console.error('Could not access error message:', e);
      }
      console.error('Error loading today sessions:', errorMessage);
    }
  }, []);

  const loadAllRecords = useCallback(async (uid: string) => {
    try {
      // Load 90 days of attendance records
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const startDate = ninetyDaysAgo.toISOString();

      const { data: records, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', uid)
        .gte('timestamp', startDate)
        .order('timestamp', { ascending: false });

      if (error) throw new Error(error.message);

      // Group records by date and create daily summaries
      const dailyMap = new Map<string, any>();

      (records || []).forEach(record => {
        const date = record.timestamp.split('T')[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            id: `daily-${uid}-${date}`,
            user_id: uid,
            attendance_date: date,
            check_in_time: null,
            check_out_time: null,
            total_hours: 0,
            session_count: 0,
            status: 'absent',
            notes: null,
            created_at: record.created_at
          });
        }

        const daily = dailyMap.get(date)!;
        if (record.type === 'check_in') {
          if (!daily.check_in_time) {
            daily.check_in_time = record.timestamp;
          }
          daily.session_count += 1;
        } else if (record.type === 'check_out') {
          daily.check_out_time = record.timestamp;
        }
      });

      // Calculate hours and determine status
      const dailyRecords = Array.from(dailyMap.values()).map(daily => {
        if (daily.check_in_time && daily.check_out_time) {
          const inTime = new Date(daily.check_in_time).getTime();
          const outTime = new Date(daily.check_out_time).getTime();
          daily.total_hours = (outTime - inTime) / (1000 * 60 * 60);
          daily.status = 'present';
        }
        return daily;
      });

      setAllRecords(dailyRecords);
      calculateStats(dailyRecords);
    } catch (error) {
      let errorMessage = 'Không thể tải lịch sử chấm công';
      try {
        if (error instanceof Error) {
          errorMessage = error.message;
        }
      } catch (e) {
        // Error object might not be accessible due to response streaming issues
        console.error('Could not access error message:', e);
      }
      console.error('Error loading attendance records:', errorMessage);
    }
  }, [calculateStats]);

  useEffect(() => {
    const initUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setUserId(user.id);
        const role = await getUserRole(user.id);
        setUserRole(role || 'staff');
        await loadTodaySessions(user.id);
        await loadAllRecords(user.id);
      }
    };
    initUser();
  }, [loadTodaySessions, loadAllRecords]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`attendance-user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_sessions',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadTodaySessions(userId);
          loadAllRecords(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadTodaySessions, loadAllRecords]);

  const handleCheckIn = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const location = await getLocation();
      const checkInTime = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('attendance_sessions')
        .insert({
          user_id: userId,
          session_date: today,
          check_in: checkInTime,
          location_checkin: location
        });

      if (error) throw new Error(error.message);

      toast({
        title: "Vào làm thành công",
        description: `${format(new Date(), 'HH:mm')} - Vị trí: ${location}`,
      });

      await loadTodaySessions(userId);
      await loadAllRecords(userId);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi chấm công",
        description: error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!userId || !hasUnclosedSession) return;

    setIsLoading(true);
    try {
      const location = await getLocation();
      const checkOutTime = new Date().toISOString();

      // Find the unclosed session
      const unclosedSession = todaySessions.find(s => !s.check_out);
      if (!unclosedSession) throw new Error("Không tìm thấy phi��n làm việc");

      const { error } = await supabase
        .from('attendance_sessions')
        .update({
          check_out: checkOutTime,
          location_checkout: location
        })
        .eq('id', unclosedSession.id);

      if (error) throw new Error(error.message);

      const checkinTime = new Date(unclosedSession.check_in);
      const checkoutTime = new Date(checkOutTime);
      const hours = (checkoutTime.getTime() - checkinTime.getTime()) / (1000 * 60 * 60);

      toast({
        title: "Ra về thành công",
        description: `${format(new Date(), 'HH:mm')} - Làm việc: ${hours.toFixed(2)} giờ`,
      });

      await loadTodaySessions(userId);
      await loadAllRecords(userId);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi chấm công",
        description: error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = allRecords.filter(record => {
    const recordDate = new Date(record.attendance_date);
    const today = new Date().toISOString().split('T')[0];

    if (activeTab === 'today') {
      return record.attendance_date === today;
    } else if (activeTab === 'week') {
      return recordDate >= startOfWeek(new Date()) && recordDate <= endOfWeek(new Date());
    } else {
      return recordDate >= startOfMonth(new Date()) && recordDate <= endOfMonth(new Date());
    }
  });

  return (
    <div className="space-y-6">
      {/* Today's Status */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary-glow/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Chấm công hôm nay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Check-in/Out Buttons */}
          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1"
              disabled={hasUnclosedSession || isLoading}
              onClick={handleCheckIn}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Vào ({format(new Date(), 'HH:mm')})
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={!hasUnclosedSession || isLoading}
              onClick={handleCheckOut}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Ra ({format(new Date(), 'HH:mm')})
            </Button>
          </div>

          {/* Today's Summary */}
          {todayRecord && (
            <div className="grid grid-cols-2 gap-3 bg-background rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground">Giờ vào</p>
                <p className="text-lg font-semibold text-foreground">
                  {(() => {
                    const isValidDate = (dateString: string | null): boolean => {
                      if (!dateString) return false;
                      const date = new Date(dateString);
                      return date instanceof Date && !isNaN(date.getTime());
                    };
                    if (!isValidDate(todayRecord.check_in_time)) return '---';
                    try {
                      return format(new Date(todayRecord.check_in_time!), 'HH:mm');
                    } catch {
                      return '---';
                    }
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Giờ ra</p>
                <p className="text-lg font-semibold text-foreground">
                  {(() => {
                    const isValidDate = (dateString: string | null): boolean => {
                      if (!dateString) return false;
                      const date = new Date(dateString);
                      return date instanceof Date && !isNaN(date.getTime());
                    };
                    if (!isValidDate(todayRecord.check_out_time)) return '---';
                    try {
                      return format(new Date(todayRecord.check_out_time!), 'HH:mm');
                    } catch {
                      return '---';
                    }
                  })()}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Tổng giờ làm hôm nay</p>
                <p className="text-2xl font-bold text-green-600">{todayRecord.total_hours.toFixed(2)} h</p>
              </div>
            </div>
          )}

          {/* Sessions List */}
          {todaySessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Phiên làm việc ({todaySessions.length})</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {todaySessions.map((session, idx) => {
                  const isValidDate = (dateString: string | null): boolean => {
                    if (!dateString) return false;
                    const date = new Date(dateString);
                    return date instanceof Date && !isNaN(date.getTime());
                  };

                  const formatDate = (dateString: string | null, formatStr: string) => {
                    if (!isValidDate(dateString)) return '---';
                    try {
                      return format(new Date(dateString), formatStr);
                    } catch {
                      return '---';
                    }
                  };

                  const sessionHours = session.check_out && isValidDate(session.check_out) && isValidDate(session.check_in)
                    ? (new Date(session.check_out).getTime() - new Date(session.check_in).getTime()) / (1000 * 60 * 60)
                    : null;

                  return (
                    <div key={session.id} className="flex items-center justify-between p-2 rounded-lg bg-background text-xs border">
                      <div className="flex-1">
                        <p className="font-semibold">Phiên #{idx + 1}</p>
                        <p className="text-muted-foreground">
                          {formatDate(session.check_in, 'HH:mm')}
                          {session.check_out && ` → ${formatDate(session.check_out, 'HH:mm')}`}
                        </p>
                        {!session.check_out && <Badge className="mt-1">Đang làm</Badge>}
                      </div>
                      {sessionHours && (
                        <div className="text-right">
                          <p className="font-bold text-green-600">{sessionHours.toFixed(2)}h</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="shadow-soft">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Tổng ngày công</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-2xl font-bold font-heading">{stats.totalDays}</div>
            <p className="text-xs text-muted-foreground mt-1">Tháng này</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Đã công</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-2xl font-bold font-heading text-green-600">{stats.presentDays}</div>
            <p className="text-xs text-success mt-1">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              Tốt
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Vắng</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-2xl font-bold font-heading text-red-600">{stats.absentDays}</div>
            <p className="text-xs text-destructive mt-1">Cần chú ý</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Trung bình</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-2xl font-bold font-heading text-blue-600">{stats.averageHoursPerDay.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">Giờ/ngày</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="font-heading">Lịch sử chấm công</CardTitle>
          <CardDescription>Chi tiết giờ vào/ra từng ngày</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'today' | 'week' | 'month')} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today">Hôm nay</TabsTrigger>
              <TabsTrigger value="week">Tuần này</TabsTrigger>
              <TabsTrigger value="month">Tháng này</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-3 mt-4">
              {filteredRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Không có lịch sử chấm công</p>
              ) : (
                filteredRecords.map((record) => {
                  const isValidDate = (dateString: string | null): boolean => {
                    if (!dateString) return false;
                    const date = new Date(dateString);
                    return date instanceof Date && !isNaN(date.getTime());
                  };

                  const formatDate = (dateString: string | null, formatStr: string, opts?: any) => {
                    if (!isValidDate(dateString)) return '---';
                    try {
                      return format(new Date(dateString), formatStr, opts);
                    } catch {
                      return '---';
                    }
                  };

                  const statusColor =
                    record.status === 'present' ? 'bg-green-100 text-green-700' :
                    record.status === 'absent' ? 'bg-red-100 text-red-700' :
                    record.status === 'leave' ? 'bg-blue-100 text-blue-700' :
                    record.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700';
                  const statusText =
                    record.status === 'present' ? 'Có công' :
                    record.status === 'absent' ? 'Vắng' :
                    record.status === 'leave' ? 'Nghỉ phép' :
                    record.status === 'late' ? 'Đi trễ' :
                    'Chờ xử lý';

                  return (
                    <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{formatDate(record.attendance_date, 'EEEE, dd/MM', { locale: vi })}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {record.check_in_time && record.check_out_time && isValidDate(record.check_in_time) && isValidDate(record.check_out_time)
                            ? `${formatDate(record.check_in_time, 'HH:mm')} → ${formatDate(record.check_out_time, 'HH:mm')}`
                            : record.check_in_time && isValidDate(record.check_in_time)
                            ? `Vào: ${formatDate(record.check_in_time, 'HH:mm')}`
                            : 'Không có dữ liệu'
                          }
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <Badge className={`${statusColor} border-0`}>{statusText}</Badge>
                        <p className="font-bold text-sm text-green-600">{record.total_hours.toFixed(2)}h</p>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyAttendanceWidget;
