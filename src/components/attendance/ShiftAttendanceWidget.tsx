import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, XCircle, TrendingUp, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth";

type ShiftType = 'morning' | 'afternoon' | 'overtime';

interface ShiftRecord {
  id: string;
  user_id: string;
  type: 'check_in' | 'check_out';
  timestamp: string;
  shift_type: ShiftType;
  status?: 'pending' | 'checked_in' | 'completed' | 'absent';
  location: string | null;
  notes: string | null;
  is_leave?: boolean;
  leave_type?: 'annual' | 'sick' | 'unpaid' | null;
}

interface ShiftStats {
  totalShifts: number;
  completedShifts: number;
  pendingShifts: number;
  absentShifts: number;
}

const SHIFT_TIMES = {
  morning: { label: 'Buổi Sáng', start: '08:00', end: '11:30' },
  afternoon: { label: 'Buổi Chiều', start: '13:00', end: '17:00' },
  overtime: { label: 'Tăng Ca', start: '17:00', end: '19:00' }
};

const ShiftAttendanceWidget = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [todayRecords, setTodayRecords] = useState<ShiftRecord[]>([]);
  const [allRecords, setAllRecords] = useState<ShiftRecord[]>([]);
  const [stats, setStats] = useState<ShiftStats>({
    totalShifts: 0,
    completedShifts: 0,
    pendingShifts: 0,
    absentShifts: 0
  });
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');

  const calculateStats = useCallback((records: ShiftRecord[]) => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const monthRecords = records.filter(r => {
      const recordDate = new Date(r.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    // Count by shift type per day
    const shiftsByDay: { [key: string]: ShiftRecord[] } = {};
    monthRecords.forEach(r => {
      const dateStr = new Date(r.timestamp).toISOString().split('T')[0];
      if (!shiftsByDay[dateStr]) shiftsByDay[dateStr] = [];
      shiftsByDay[dateStr].push(r);
    });

    let completedShifts = 0;
    let pendingShifts = 0;
    let absentShifts = 0;

    Object.values(shiftsByDay).forEach(dayRecords => {
      const hasCheckIn = dayRecords.some(r => r.type === 'check_in');
      const hasCheckOut = dayRecords.some(r => r.type === 'check_out');

      if (dayRecords.some(r => r.is_leave)) {
        absentShifts++;
      } else if (hasCheckIn && hasCheckOut) {
        completedShifts++;
      } else if (hasCheckIn) {
        pendingShifts++;
      } else {
        absentShifts++;
      }
    });

    setStats({
      totalShifts: Object.keys(shiftsByDay).length,
      completedShifts,
      pendingShifts,
      absentShifts
    });
  }, []);

  const loadAllAttendance = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', uid)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAllRecords(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  }, [calculateStats]);

  const loadTodayAttendance = useCallback(async (uid: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', uid)
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`)
        .order('shift_type');

      if (error) throw error;
      setTodayRecords(data || []);
    } catch (error) {
      console.error('Error loading today attendance:', error);
    }
  }, []);

  useEffect(() => {
    const initUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setUserId(user.id);
        await loadTodayAttendance(user.id);
        await loadAllAttendance(user.id);
      }
    };
    initUser();
  }, [loadTodayAttendance, loadAllAttendance]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadTodayAttendance(userId);
          loadAllAttendance(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadTodayAttendance, loadAllAttendance]);

  const getLocation = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve(`${position.coords.latitude}, ${position.coords.longitude}`);
          },
          () => {
            resolve("Location unavailable");
          }
        );
      } else {
        resolve("Geolocation not supported");
      }
    });
  };

  const handleShiftCheckIn = async (shiftType: ShiftType) => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const location = await getLocation();
      const timestamp = new Date().toISOString();

      const { error } = await supabase
        .from('attendance')
        .insert({
          user_id: userId,
          type: 'check_in',
          timestamp,
          shift_type: shiftType,
          location,
          is_leave: false
        });

      if (error) throw error;

      toast({
        title: "Chấm công thành công",
        description: `Đã chấm công ${SHIFT_TIMES[shiftType].label} lúc ${format(new Date(), 'HH:mm')}`,
      });

      await loadTodayAttendance(userId);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Chấm công thất bại",
        description: error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShiftCheckOut = async (shiftType: ShiftType) => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const location = await getLocation();
      const timestamp = new Date().toISOString();

      const { error } = await supabase
        .from('attendance')
        .insert({
          user_id: userId,
          type: 'check_out',
          timestamp,
          shift_type: shiftType,
          location,
          is_leave: false
        });

      if (error) throw error;

      toast({
        title: "Chấm công thành công",
        description: `Đã chấm công ra ${SHIFT_TIMES[shiftType].label} lúc ${format(new Date(), 'HH:mm')}`,
      });

      await loadTodayAttendance(userId);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Chấm công thất bại",
        description: error instanceof Error ? error.message : "Vui lòng thử lại",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getShiftStatus = (record: ShiftRecord | undefined): { status: string; color: string; icon: React.ComponentType<any> } => {
    if (!record) {
      return { status: 'Chưa chấm', color: 'bg-gray-100 text-gray-700', icon: Clock };
    }
    
    if (record.status === 'completed') {
      return { status: 'Hoàn thành', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
    }
    
    if (record.status === 'checked_in') {
      return { status: 'Đang làm', color: 'bg-blue-100 text-blue-700', icon: Clock };
    }
    
    if (record.status === 'absent') {
      return { status: 'Vắng mặt', color: 'bg-red-100 text-red-700', icon: XCircle };
    }

    return { status: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
  };

  const renderShiftCard = (shiftType: ShiftType) => {
    const shiftInfo = SHIFT_TIMES[shiftType];
    const shiftRecords = todayRecords.filter(r => r.shift_type === shiftType);
    const hasCheckIn = shiftRecords.some(r => r.type === 'check_in');
    const hasCheckOut = shiftRecords.some(r => r.type === 'check_out');
    const checkInRecord = shiftRecords.find(r => r.type === 'check_in');
    const checkOutRecord = shiftRecords.find(r => r.type === 'check_out');

    let statusText = 'Chưa chấm';
    let color = 'bg-gray-100 text-gray-700';

    if (hasCheckIn && hasCheckOut) {
      statusText = 'Hoàn thành';
      color = 'bg-green-100 text-green-700';
    } else if (hasCheckIn && !hasCheckOut) {
      statusText = 'Đang làm';
      color = 'bg-blue-100 text-blue-700';
    }

    const isCompleted = hasCheckIn && hasCheckOut;

    return (
      <Card key={shiftType} className="overflow-hidden hover:shadow-medium transition-shadow">
        <CardContent className="p-3 md:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-heading font-semibold text-base md:text-lg">{shiftInfo.label}</h4>
              <p className="text-xs md:text-sm text-muted-foreground">
                {shiftInfo.start} - {shiftInfo.end}
              </p>
            </div>
            <Badge className={`${color} border-0 text-xs flex-shrink-0`}>
              {statusText}
            </Badge>
          </div>

          {record && (
            <div className="text-xs md:text-sm space-y-1 bg-muted/50 rounded p-2">
              {record.check_in && (
                <p className="text-foreground">
                  <span className="font-medium">Vào:</span> {format(new Date(record.check_in), 'HH:mm')}
                </p>
              )}
              {record.check_out && (
                <p className="text-foreground">
                  <span className="font-medium">Ra:</span> {format(new Date(record.check_out), 'HH:mm')}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1 text-xs md:text-sm h-9 md:h-10"
              disabled={isCompleted || isLoading}
              onClick={() => handleShiftCheckIn(shiftType)}
            >
              {isLoading ? <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" /> : <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
              <span className="hidden sm:inline">Vào</span>
              <span className="sm:hidden">Vào</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs md:text-sm h-9 md:h-10"
              disabled={!isCheckedIn || isCompleted || isLoading}
              onClick={() => handleShiftCheckOut(shiftType)}
            >
              {isLoading ? <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" /> : <XCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />}
              <span className="hidden sm:inline">Ra</span>
              <span className="sm:hidden">Ra</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const filteredRecords = allRecords.filter(record => {
    const recordDate = new Date(record.date);
    if (activeTab === 'today') {
      return record.date === new Date().toISOString().split('T')[0];
    } else if (activeTab === 'week') {
      return recordDate >= startOfWeek(new Date()) && recordDate <= endOfWeek(new Date());
    } else {
      return recordDate >= startOfMonth(new Date()) && recordDate <= endOfMonth(new Date());
    }
  });

  return (
    <div className="space-y-6">
      {/* Today's Shifts */}
      <div>
        <h3 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Chấm công hôm nay
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(SHIFT_TIMES) as ShiftType[]).map(shiftType => renderShiftCard(shiftType))}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="shadow-soft">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Tổng ca làm</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
            <div className="text-xl md:text-2xl font-bold font-heading">{stats.totalShifts}</div>
            <p className="text-xs text-muted-foreground mt-1">Tháng này</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Hoàn thành</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
            <div className="text-xl md:text-2xl font-bold font-heading text-green-600">{stats.completedShifts}</div>
            <p className="text-xs text-success mt-1">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              Tốt
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Chờ xử lý</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
            <div className="text-xl md:text-2xl font-bold font-heading text-blue-600">{stats.pendingShifts}</div>
            <p className="text-xs text-muted-foreground mt-1">Đang làm</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Vắng mặt</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
            <div className="text-xl md:text-2xl font-bold font-heading text-red-600">{stats.absentShifts}</div>
            <p className="text-xs text-destructive mt-1">Cần chú ý</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="font-heading">Lịch sử chấm công</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'today' | 'week' | 'month')} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today" className="data-[state=active]:bg-primary">Hôm nay</TabsTrigger>
              <TabsTrigger value="week" className="data-[state=active]:bg-primary">Tuần này</TabsTrigger>
              <TabsTrigger value="month" className="data-[state=active]:bg-primary">Tháng này</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-3 mt-4">
              {filteredRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Không có lịch sử chấm công</p>
              ) : (
                filteredRecords.map((record) => {
                  const shiftInfo = SHIFT_TIMES[record.shift_type];
                  const { status: statusText, color } = getShiftStatus(record);
                  
                  return (
                    <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{shiftInfo.label}</p>
                          <Badge variant="outline" className="text-xs">
                            {format(new Date(record.date), 'MMM dd')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {record.check_in && record.check_out
                            ? `${format(new Date(record.check_in), 'HH:mm')} - ${format(new Date(record.check_out), 'HH:mm')}`
                            : record.check_in
                            ? `Vào: ${format(new Date(record.check_in), 'HH:mm')}`
                            : 'Chưa chấm công'
                          }
                        </p>
                      </div>
                      <Badge className={`${color} border-0`}>{statusText}</Badge>
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

export default ShiftAttendanceWidget;
