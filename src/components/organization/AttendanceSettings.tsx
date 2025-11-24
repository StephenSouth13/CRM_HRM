import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Users, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client"; // Import supabase

// --- INTERFACES ---
// Định nghĩa cấu trúc tối thiểu của Team cần thiết cho settings
interface Team {
  id: string;
  name: string;
}
// Cấu trúc để lưu vị trí (ví dụ: trong localStorage hoặc DB)
interface LocationSettings {
  officeLocation: { lat: string; lng: string };
  radius: string; // tính bằng mét
}
// --- END INTERFACES ---

const STORAGE_KEY = 'attendanceSettingsByTeam';

const AttendanceSettings = () => {
  // State chung lưu trữ cài đặt của TẤT CẢ các team
  const [allTeamSettings, setAllTeamSettings] = useState<Record<string, LocationSettings>>({}); 
  const [teams, setTeams] = useState<Team[]>([]); // Danh sách teams từ Supabase
  const [loadingTeams, setLoadingTeams] = useState(true);

  // State hiện tại (Hiển thị và chỉnh sửa cho team đang chọn)
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [officeLocation, setOfficeLocation] = useState({ lat: "", lng: "" });
  const [radius, setRadius] = useState("100");
  
  const { toast } = useToast();

  // --- HÀM TẢI DỮ LIỆU TEAMS (Lấy từ component TeamsManagement) ---
  const fetchTeams = useCallback(async () => {
    try {
      setLoadingTeams(true);
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`id, name`) // Chỉ cần ID và Name
        .order('name');
      
      if (teamError) throw teamError;
      
      const fetchedTeams = teamData as Team[] || [];
      setTeams(fetchedTeams);
      
      // Tự động chọn team đầu tiên nếu có
      if (fetchedTeams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(fetchedTeams[0].id);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Lỗi tải đội nhóm:', errorMessage);
      toast({ title: "Lỗi", description: "Không thể tải danh sách đội nhóm.", variant: "destructive" });
    } finally {
      setLoadingTeams(false);
    }
  }, [toast, selectedTeamId]);
  
  // --- HIỆU ỨNG TẢI DỮ LIỆU ---
  
  // 1. Tải danh sách Teams và cài đặt chung
  useEffect(() => {
    fetchTeams();
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
      setAllTeamSettings(JSON.parse(savedSettings));
    }
  }, [fetchTeams]);

  // 2. Cập nhật UI khi team được chọn thay đổi
  useEffect(() => {
    if (!selectedTeamId) return;

    // Tải cài đặt của team được chọn từ state chung
    const currentSettings = allTeamSettings[selectedTeamId] || { 
      officeLocation: { lat: "", lng: "" }, 
      radius: "100" 
    };
    
    setOfficeLocation(currentSettings.officeLocation);
    setRadius(currentSettings.radius);
    
    // Optional: Toast thông báo đã tải
    const currentTeam = teams.find(t => t.id === selectedTeamId);
    if (currentTeam) {
        toast({
            title: "Tải cài đặt thành công",
            description: `Đang xem và chỉnh sửa cài đặt cho ${currentTeam.name}.`,
        });
    }

  }, [selectedTeamId, allTeamSettings, teams, toast]);
  
  // --- LOGIC CHỨC NĂNG ---

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOfficeLocation({
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString()
          });
          toast({
            title: "Vị trí đã được lấy",
            description: "Vị trí hiện tại được đặt làm vị trí văn phòng",
          });
        },
        (error) => {
          console.error('Lỗi lấy vị trí:', error);
          toast({
            title: "Lỗi",
            description: "Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền.",
            variant: "destructive"
          });
        }
      );
    } else {
      toast({
        title: "Lỗi",
        description: "Trình duyệt không hỗ trợ Geolocation.",
        variant: "destructive"
      });
    }
  };

  const handleSave = () => {
    if (!selectedTeamId) {
        toast({ title: "Lỗi", description: "Vui lòng chọn một đội nhóm trước khi lưu.", variant: "destructive" });
        return;
    }

    // Cập nhật state chung với cài đặt của team hiện tại
    const updatedSettings = {
      ...allTeamSettings,
      [selectedTeamId]: { // Lưu trữ theo team ID
        officeLocation,
        radius
      }
    };
    
    setAllTeamSettings(updatedSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
    
    toast({
      title: "Thành công",
      description: `Cài đặt vị trí đã được lưu cho ${teams.find(t => t.id === selectedTeamId)?.name}.`,
    });
  };

  // --- UI RENDER ---

  if (loadingTeams) {
    return (
      <Card className="shadow-lg p-6">
        <div className="text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 inline animate-spin mr-2" /> Đang tải danh sách đội nhóm...
        </div>
      </Card>
    );
  }

  const currentTeamName = teams.find(t => t.id === selectedTeamId)?.name || 'Chưa Chọn Team';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Cài đặt Vị trí Chấm công (Theo Team)
        </CardTitle>
        <CardDescription>
          Cấu hình vị trí văn phòng và bán kính check-in/out cho từng đội nhóm cụ thể.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* --- Phần Chọn Team --- */}
        <div>
          <Label htmlFor="team-select" className="flex items-center gap-1 mb-1 font-semibold">
            <Users className="h-4 w-4" />
            Chọn Đội nhóm
          </Label>
          <Select 
            value={selectedTeamId} 
            onValueChange={setSelectedTeamId} 
            disabled={teams.length === 0}
          >
            <SelectTrigger id="team-select" className="w-full">
              <SelectValue placeholder="Chọn một đội nhóm" />
            </SelectTrigger>
            <SelectContent>
              {teams.length === 0 ? (
                <SelectItem value="no-teams" disabled>Không có đội nhóm nào</SelectItem>
              ) : (
                teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        
        {/* Đường kẻ phân cách */}
        <hr className="my-4" />

        {/* --- Phần Cấu hình Vị trí --- */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Cấu hình Vị trí cho Team: 
            <span className="text-primary ml-1">{currentTeamName}</span>
          </h3>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="lat">Vĩ độ (Latitude)</Label>
              <Input
                id="lat"
                type="number"
                step="any"
                value={officeLocation.lat}
                onChange={(e) => setOfficeLocation({ ...officeLocation, lat: e.target.value })}
                placeholder="e.g., 21.028511"
                disabled={!selectedTeamId}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="lng">Kinh độ (Longitude)</Label>
              <Input
                id="lng"
                type="number"
                step="any"
                value={officeLocation.lng}
                onChange={(e) => setOfficeLocation({ ...officeLocation, lng: e.target.value })}
                placeholder="e.g., 105.804817"
                disabled={!selectedTeamId}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGetCurrentLocation}
            className="w-full"
            disabled={!selectedTeamId}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Sử dụng Vị trí Hiện tại
          </Button>

          <div>
            <Label htmlFor="radius">Bán kính Check-in (mét)</Label>
            <Input
              id="radius"
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="100"
              disabled={!selectedTeamId}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Nhân viên phải nằm trong bán kính này để chấm công hợp lệ.
            </p>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} className="w-full" disabled={!selectedTeamId}>
              Lưu Cài đặt Vị trí
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceSettings;
