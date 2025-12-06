import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import RoomParticipantsManager from "./RoomParticipantsManager";

const MyBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    const fetchMyBookings = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        setCurrentUserId(user.id);

        const { data, error } = await supabase
          .from('room_bookings')
          .select('*')
          .eq('user_id', user.id)
          .order('start_time', { ascending: false });

        if (error) throw error;
        setBookings(data || []);
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyBookings();
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading your bookings...</div>;
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Bạn chưa có lịch đặt phòng nào</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <div className="border-b">
            <div className="flex items-center justify-between p-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{booking.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Phòng: {booking.room_id}
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span>
                    📅 {format(new Date(booking.start_time), 'MMM dd, yyyy HH:mm')}
                  </span>
                  <span>
                    ⏱️ {format(new Date(booking.end_time), 'HH:mm')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    booking.status === 'approved' ? 'default' :
                    booking.status === 'rejected' ? 'destructive' : 'secondary'
                  }
                >
                  {booking.status === 'approved' ? 'Phê Duyệt' :
                   booking.status === 'rejected' ? 'Bị Từ Chối' : 'Chờ Duyệt'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedBookingId(expandedBookingId === booking.id ? null : booking.id)}
                >
                  {expandedBookingId === booking.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {expandedBookingId === booking.id && (
            <CardContent className="pt-4">
              <RoomParticipantsManager
                bookingId={booking.id}
                isOrganizer={booking.user_id === currentUserId}
                googleMeetLink={booking.google_meet_link}
              />
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};

export default MyBookings;
