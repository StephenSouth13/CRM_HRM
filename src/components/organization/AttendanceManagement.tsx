import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Users, Clock, Settings, Edit2, Save, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Team {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  team_id: string;
}

interface ShiftConfig {
  id: string;
  team_id: string;
  shift_type: 'morning' | 'afternoon' | 'overtime';
  start_time: string;
  end_time: string;
  required: boolean;
}

interface ShiftAttendanceRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  shift_type: 'morning' | 'afternoon' | 'overtime';
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'pending' | 'checked_in' | 'completed' | 'absent';
}

const SHIFT_TYPES = [
  { value: 'morning', label: 'Buổi Sáng' },
  { value: 'afternoon', label: 'Buổi Chiều' },
  { value: 'overtime', label: 'Tăng Ca' }
];

const AttendanceManagement = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('shifts');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [shiftConfigs, setShiftConfigs] = useState<ShiftConfig[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<ShiftAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftConfig | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationSettings, setLocationSettings] = useState({ lat: "", lng: "", radius: "100" });

  // Load teams
  const loadTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (error) throw error;

      const teamList = data as Team[] || [];
      setTeams(teamList);
      if (teamList.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teamList[0].id);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải danh sách đội nhóm"
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeamId, toast]);

  // Load shift configurations for selected team
  const loadShiftConfigs = useCallback(async (teamId: string) => {
    if (!teamId) return;

    try {
      const { data, error } = await supabase
        .from('shift_configurations')
        .select('*')
        .eq('team_id', teamId)
        .order('shift_type');

      if (error) throw error;
      setShiftConfigs(data || []);
    } catch (error) {
      console.error('Error loading shift configs:', error);
    }
  }, []);

  // Load attendance records for selected team and date
  const loadAttendanceRecords = useCallback(async (teamId: string, date: string) => {
    if (!teamId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('shift_attendance_view')
        .select('*')
        .eq('team_id', teamId)
        .eq('date', date)
        .order('user_name');

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (error) {
      console.error('Error loading attendance records:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load location settings
  const loadLocationSettings = useCallback(async (teamId: string) => {
    if (!teamId) return;

    try {
      const { data, error } = await supabase
        .from('attendance_settings')
        .select('*')
        .eq('team_id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setLocationSettings({
          lat: data.office_latitude || "",
          lng: data.office_longitude || "",
          radius: data.check_in_radius?.toString() || "100"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error loading location settings:', errorMessage);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: `Không thể tải cài đặt vị trí: ${errorMessage}`
      });
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Load configs and records when team or date changes
  useEffect(() => {
    if (selectedTeamId) {
      loadShiftConfigs(selectedTeamId);
      loadAttendanceRecords(selectedTeamId, selectedDate);
      loadLocationSettings(selectedTeamId);
    }
  }, [selectedTeamId, selectedDate, loadShiftConfigs, loadAttendanceRecords, loadLocationSettings]);

  const handleSaveShiftConfig = async () => {
    if (!editingShift || !selectedTeamId) return;

    try {
      setIsLoading(true);

      if (editingShift.id.startsWith('new-')) {
        const { error } = await supabase
          .from('shift_configurations')
          .insert({
            team_id: selectedTeamId,
            shift_type: editingShift.shift_type,
            start_time: editingShift.start_time,
            end_time: editingShift.end_time,
            required: editingShift.required
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shift_configurations')
          .update({
            start_time: editingShift.start_time,
            end_time: editingShift.end_time,
            required: editingShift.required
          })
          .eq('id', editingShift.id);

        if (error) throw error;
      }

      setShowEditDialog(false);
      setEditingShift(null);
      await loadShiftConfigs(selectedTeamId);

      toast({
        title: "Thành công",
        description: "Cấu hình ca làm đã được lưu"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể lưu cấu hình"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewShift = () => {
    setEditingShift({
      id: `new-${Date.now()}`,
      team_id: selectedTeamId,
      shift_type: 'morning',
      start_time: '08:00',
      end_time: '11:30',
      required: true
    });
    setShowEditDialog(true);
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa ca làm này?')) return;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('shift_configurations')
        .delete()
        .eq('id', shiftId);

      if (error) throw error;

      await loadShiftConfigs(selectedTeamId);
      toast({
        title: "Thành công",
        description: "Ca làm đã được xóa"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xóa ca làm"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLocationSettings = async () => {
    if (!selectedTeamId) return;

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('attendance_settings')
        .upsert({
          team_id: selectedTeamId,
          office_latitude: parseFloat(locationSettings.lat) || null,
          office_longitude: parseFloat(locationSettings.lng) || null,
          check_in_radius: parseInt(locationSettings.radius) || 100
        }, { onConflict: 'team_id' });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Cài đặt vị trí đã được lưu"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể lưu cài đặt"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'checked_in':
        return 'bg-blue-100 text-blue-700';
      case 'absent':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'checked_in':
        return 'Đang làm';
      case 'absent':
        return 'Vắng mặt';
      default:
        return 'Chờ xử lý';
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Selection */}
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="team-select" className="font-semibold">
              Chọn Đội Nhóm
            </Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger id="team-select">
                <SelectValue placeholder="Chọn một đội nhóm" />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shifts" className="data-[state=active]:bg-primary">
            <Clock className="h-4 w-4 mr-2" />
            Quản lý Ca
          </TabsTrigger>
          <TabsTrigger value="attendance" className="data-[state=active]:bg-primary">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Chấm Công
          </TabsTrigger>
          <TabsTrigger value="location" className="data-[state=active]:bg-primary">
            <MapPin className="h-4 w-4 mr-2" />
            Vị Trí
          </TabsTrigger>
        </TabsList>

        {/* Shift Management Tab */}
        <TabsContent value="shifts" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-heading font-semibold">Cấu hình Ca Làm</h3>
            <Button onClick={handleAddNewShift} disabled={isLoading}>
              Thêm Ca Mới
            </Button>
          </div>

          <div className="space-y-3">
            {shiftConfigs.map(shift => {
              const shiftLabel = SHIFT_TYPES.find(st => st.value === shift.shift_type)?.label;
              return (
                <Card key={shift.id} className="hover:shadow-medium transition-shadow">
                  <CardContent className="p-3 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-base md:text-lg">{shiftLabel}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {shift.start_time} - {shift.end_time}
                      </p>
                      {shift.required && (
                        <Badge variant="secondary" className="mt-2 w-fit text-xs">Bắt buộc</Badge>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingShift(shift);
                          setShowEditDialog(true);
                        }}
                        disabled={isLoading}
                        className="text-xs md:text-sm"
                      >
                        <Edit2 className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        <span className="hidden sm:inline">Sửa</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteShift(shift.id)}
                        disabled={isLoading}
                        className="text-xs md:text-sm"
                      >
                        <X className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {shiftConfigs.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Chưa có cấu hình ca làm. Vui lòng thêm mới.</p>
            </Card>
          )}
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date-select" className="font-semibold">
              Chọn Ngày
            </Label>
            <Input
              id="date-select"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              <p className="mt-2 text-muted-foreground">Đang tải...</p>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Không có dữ liệu chấm công cho ngày này</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {attendanceRecords.map(record => (
                <Card key={record.id} className="overflow-hidden hover:shadow-medium transition-shadow">
                  <CardContent className="p-3 md:p-6">
                    <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm md:text-base truncate">{record.user_name}</p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">{record.user_email}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs md:text-sm font-medium">
                            {SHIFT_TYPES.find(st => st.value === record.shift_type)?.label}
                          </span>
                          <Badge className={`${getStatusBadgeColor(record.status)} border-0 text-xs flex-shrink-0`}>
                            {getStatusLabel(record.status)}
                          </Badge>
                        </div>
                        {record.check_in && (
                          <p className="text-xs text-muted-foreground">
                            Vào: {new Date(record.check_in).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {record.check_out && (
                          <p className="text-xs text-muted-foreground">
                            Ra: {new Date(record.check_out).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Location Settings Tab */}
        <TabsContent value="location" className="mt-6 space-y-4">
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Cài đặt Vị trí Chấm công
              </CardTitle>
              <CardDescription>
                Cấu hình vị trí văn phòng và bán kính cho phép chấm công
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lat" className="font-semibold">
                    Vĩ độ (Latitude)
                  </Label>
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    value={locationSettings.lat}
                    onChange={(e) => setLocationSettings({ ...locationSettings, lat: e.target.value })}
                    placeholder="e.g., 21.028511"
                  />
                </div>
                <div>
                  <Label htmlFor="lng" className="font-semibold">
                    Kinh độ (Longitude)
                  </Label>
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    value={locationSettings.lng}
                    onChange={(e) => setLocationSettings({ ...locationSettings, lng: e.target.value })}
                    placeholder="e.g., 105.804817"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="radius" className="font-semibold">
                  Bán kính Check-in (mét)
                </Label>
                <Input
                  id="radius"
                  type="number"
                  value={locationSettings.radius}
                  onChange={(e) => setLocationSettings({ ...locationSettings, radius: e.target.value })}
                  placeholder="100"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Nhân viên phải nằm trong bán kính này để chấm công hợp lệ
                </p>
              </div>

              <Button onClick={handleSaveLocationSettings} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Lưu Cài đặt Vị trí
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Shift Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingShift?.id.startsWith('new-') ? 'Thêm Ca Làm Mới' : 'Sửa Ca Làm'}
            </DialogTitle>
          </DialogHeader>
          {editingShift && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="shift-type" className="font-semibold">
                  Loại Ca
                </Label>
                <Select
                  value={editingShift.shift_type}
                  onValueChange={(value) => setEditingShift({ ...editingShift, shift_type: value as any })}
                >
                  <SelectTrigger id="shift-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFT_TYPES.map(shift => (
                      <SelectItem key={shift.value} value={shift.value}>
                        {shift.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time" className="font-semibold">
                    Giờ Bắt Đầu
                  </Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={editingShift.start_time}
                    onChange={(e) => setEditingShift({ ...editingShift, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end-time" className="font-semibold">
                    Giờ Kết Thúc
                  </Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={editingShift.end_time}
                    onChange={(e) => setEditingShift({ ...editingShift, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={editingShift.required}
                  onChange={(e) => setEditingShift({ ...editingShift, required: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="required" className="cursor-pointer">
                  Ca làm bắt buộc
                </Label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Hủy
                </Button>
                <Button onClick={handleSaveShiftConfig} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Lưu
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceManagement;
