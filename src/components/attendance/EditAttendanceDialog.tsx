import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  user_name: string;
  user_email: string;
  team_name: string | null;
}

interface EditAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: DailyRecord;
  onSave: () => Promise<void>;
}

const EditAttendanceDialog = ({ open, onOpenChange, record, onSave }: EditAttendanceDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    check_in_time: record.check_in_time ? new Date(record.check_in_time).toISOString().slice(11, 16) : '',
    check_out_time: record.check_out_time ? new Date(record.check_out_time).toISOString().slice(11, 16) : '',
    status: record.status,
    notes: record.notes || ''
  });

  const calculateHours = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return 0;
    const [inHour, inMin] = checkIn.split(':').map(Number);
    const [outHour, outMin] = checkOut.split(':').map(Number);
    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;
    return Math.max(0, (outMinutes - inMinutes) / 60);
  };

  const hours = calculateHours(formData.check_in_time, formData.check_out_time);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const attendanceDate = record.attendance_date;
      const [inHour, inMin] = formData.check_in_time.split(':').map(Number);
      const [outHour, outMin] = formData.check_out_time.split(':').map(Number);

      const checkInTime = new Date(attendanceDate);
      checkInTime.setHours(inHour, inMin, 0, 0);

      const checkOutTime = new Date(attendanceDate);
      checkOutTime.setHours(outHour, outMin, 0, 0);

      const { error } = await supabase
        .from('daily_attendance')
        .update({
          check_in_time: checkInTime.toISOString(),
          check_out_time: checkOutTime.toISOString(),
          total_hours: hours,
          status: formData.status,
          notes: formData.notes
        })
        .eq('id', record.id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã cập nhật bản ghi chấm công"
      });

      await onSave();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa chấm công</DialogTitle>
          <DialogDescription>
            {record.user_name} - {format(new Date(record.attendance_date), 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Check-in Time */}
          <div className="space-y-2">
            <Label htmlFor="check-in">Giờ vào</Label>
            <Input
              id="check-in"
              type="time"
              value={formData.check_in_time}
              onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
            />
          </div>

          {/* Check-out Time */}
          <div className="space-y-2">
            <Label htmlFor="check-out">Giờ ra</Label>
            <Input
              id="check-out"
              type="time"
              value={formData.check_out_time}
              onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
            />
          </div>

          {/* Total Hours Display */}
          <div className="space-y-2">
            <Label>Tổng giờ làm</Label>
            <div className="text-2xl font-bold text-green-600">
              {hours.toFixed(2)} giờ
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as any })}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Có công</SelectItem>
                <SelectItem value="absent">Vắng</SelectItem>
                <SelectItem value="leave">Nghỉ phép</SelectItem>
                <SelectItem value="late">Đi trễ</SelectItem>
                <SelectItem value="pending">Chờ xử lý</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Thêm ghi chú..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAttendanceDialog;
