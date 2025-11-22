import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AttendanceSettings {
  id: string;
  team_id: string | null;
  auto_checkout_enabled: boolean;
  auto_checkout_time: string;
  max_hours_per_day: number;
  office_latitude: number | null;
  office_longitude: number | null;
  check_in_radius_meters: number;
  require_location_checkin: boolean;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
}

const AttendanceSettingsPanel = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  const loadTeams = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('teams').select('id, name');
      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }, []);

  const loadSettings = useCallback(async (teamId: string | null = null) => {
    setIsLoading(true);
    try {
      let query = supabase.from('attendance_settings').select('*');
      
      if (teamId) {
        query = query.eq('team_id', teamId);
      } else {
        query = query.is('team_id', null);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
      } else if (!teamId) {
        // Use defaults if no settings found
        setSettings({
          id: '',
          team_id: null,
          auto_checkout_enabled: true,
          auto_checkout_time: '23:59:00',
          max_hours_per_day: 14,
          office_latitude: null,
          office_longitude: null,
          check_in_radius_meters: 100,
          require_location_checkin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải cài đặt"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTeams();
    loadSettings();
  }, [loadTeams, loadSettings]);

  const handleTeamChange = (teamId: string) => {
    setSelectedTeam(teamId);
    loadSettings(teamId || null);
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      if (settings.id) {
        // Update existing
        const { error } = await supabase
          .from('attendance_settings')
          .update({
            auto_checkout_enabled: settings.auto_checkout_enabled,
            auto_checkout_time: settings.auto_checkout_time,
            max_hours_per_day: settings.max_hours_per_day,
            office_latitude: settings.office_latitude,
            office_longitude: settings.office_longitude,
            check_in_radius_meters: settings.check_in_radius_meters,
            require_location_checkin: settings.require_location_checkin
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('attendance_settings')
          .insert({
            team_id: settings.team_id,
            auto_checkout_enabled: settings.auto_checkout_enabled,
            auto_checkout_time: settings.auto_checkout_time,
            max_hours_per_day: settings.max_hours_per_day,
            office_latitude: settings.office_latitude,
            office_longitude: settings.office_longitude,
            check_in_radius_meters: settings.check_in_radius_meters,
            require_location_checkin: settings.require_location_checkin
          });

        if (error) throw error;
      }

      toast({
        title: "Thành công",
        description: "Đã lưu cài đặt chấm công"
      });

      await loadSettings(settings.team_id);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể lưu cài đặt"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoCheckout = async () => {
    try {
      setIsSaving(true);

      // Call auto-checkout logic via database
      const { data, error } = await supabase.rpc('auto_checkout_unclosed_sessions', {
        max_hours_limit: settings?.max_hours_per_day || 14
      });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: `Đã auto-checkout ${data?.count || 0} phiên làm việc`
      });
    } catch (error) {
      console.error('Error in auto-checkout:', error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể thực hiện auto-checkout"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Không thể tải cài đặt</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Phòng ban</CardTitle>
          <CardDescription>Chọn phòng ban để cấu hình, để trống để sử dụng cài đặt toàn cục</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeam} onValueChange={handleTeamChange}>
            <SelectTrigger>
              <SelectValue placeholder="Cài đặt toàn cục (Global)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Cài đặt toàn cục (Global)</SelectItem>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Auto-Checkout Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Tự động Checkout
          </CardTitle>
          <CardDescription>Cấu hình chấm công tự động khi nhân viên quên bấm Ra</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-checkout-enabled">Bật tự động Checkout</Label>
            <Switch
              id="auto-checkout-enabled"
              checked={settings.auto_checkout_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_checkout_enabled: checked })}
            />
          </div>

          {settings.auto_checkout_enabled && (
            <>
              {/* Time Setting */}
              <div className="space-y-2">
                <Label htmlFor="auto-checkout-time">Thời gian auto-checkout</Label>
                <Input
                  id="auto-checkout-time"
                  type="time"
                  value={settings.auto_checkout_time.slice(0, 5)}
                  onChange={(e) => setSettings({ ...settings, auto_checkout_time: `${e.target.value}:00` })}
                />
                <p className="text-xs text-muted-foreground">
                  Thời gian tự động chấm công Ra nếu nhân viên quên bấm (mặc định: 23:59)
                </p>
              </div>

              {/* Max Hours */}
              <div className="space-y-2">
                <Label htmlFor="max-hours">Giới hạn giờ làm tối đa (giờ/ngày)</Label>
                <Input
                  id="max-hours"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={settings.max_hours_per_day}
                  onChange={(e) => setSettings({ ...settings, max_hours_per_day: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Ngăn chặn ghi nhận quá {settings.max_hours_per_day}h làm việc trong một ngày (VD: 14h)
                </p>
              </div>
            </>
          )}

          {/* Manual Trigger */}
          {settings.auto_checkout_enabled && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAutoCheckout}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Chạy Auto-Checkout Ngay
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Location Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Cài đặt Vị trí</CardTitle>
          <CardDescription>Cấu hình kiểm tra vị trí chấm công</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Require Location */}
          <div className="flex items-center justify-between">
            <Label htmlFor="require-location">Yêu cầu ghi lại vị trí</Label>
            <Switch
              id="require-location"
              checked={settings.require_location_checkin}
              onCheckedChange={(checked) => setSettings({ ...settings, require_location_checkin: checked })}
            />
          </div>

          {settings.require_location_checkin && (
            <>
              {/* Latitude */}
              <div className="space-y-2">
                <Label htmlFor="latitude">Vĩ độ (Latitude)</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.0001"
                  placeholder="VD: 20.9978"
                  value={settings.office_latitude || ''}
                  onChange={(e) => setSettings({ ...settings, office_latitude: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>

              {/* Longitude */}
              <div className="space-y-2">
                <Label htmlFor="longitude">Kinh độ (Longitude)</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.0001"
                  placeholder="VD: 105.8341"
                  value={settings.office_longitude || ''}
                  onChange={(e) => setSettings({ ...settings, office_longitude: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>

              {/* Radius */}
              <div className="space-y-2">
                <Label htmlFor="radius">Bán kính kiểm tra (mét)</Label>
                <Input
                  id="radius"
                  type="number"
                  min="10"
                  step="10"
                  value={settings.check_in_radius_meters}
                  onChange={(e) => setSettings({ ...settings, check_in_radius_meters: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Nhân viên phải ở trong vòng {settings.check_in_radius_meters}m từ vị trí văn phòng
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        <Save className="h-4 w-4 mr-2" />
        Lưu Cài Đặt
      </Button>
    </div>
  );
};

export default AttendanceSettingsPanel;
