import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Link as LinkIcon, Check, X, Clock, Users } from "lucide-react";

interface Participant {
  id: string;
  user_id: string;
  booking_id: string;
  is_organizer: boolean;
  status: 'invited' | 'accepted' | 'declined' | 'joined';
  joined_at: string | null;
  google_meet_link: string | null;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface RoomParticipantsManagerProps {
  bookingId: string;
  isOrganizer: boolean;
  googleMeetLink?: string | null;
}

const RoomParticipantsManager = ({ bookingId, isOrganizer, googleMeetLink }: RoomParticipantsManagerProps) => {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [googleMeetUrl, setGoogleMeetUrl] = useState<string | null>(googleMeetLink || null);
  const [isCreatingMeet, setIsCreatingMeet] = useState(false);

  // Load current user
  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    loadCurrentUser();
  }, []);

  // Load participants
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('room_participants')
          .select(`
            *,
            user:user_id(id, first_name, last_name, email, avatar_url)
          `)
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setParticipants(data || []);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error loading participants:', errorMessage);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải danh sách người tham gia',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadParticipants();
  }, [bookingId, toast]);

  // Load all users for selection
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url')
          .order('last_name', { ascending: true });

        if (error) throw error;
        setAllUsers(data || []);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    loadUsers();
  }, []);

  const handleAddParticipant = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn người tham gia',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('room_participants')
        .insert({
          booking_id: bookingId,
          user_id: selectedUserId,
          added_by: currentUser?.id,
          status: 'invited',
          is_organizer: false
        });

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: 'Người tham gia đã được thêm'
      });

      setSelectedUserId('');
      setIsAddOpen(false);

      // Reload participants
      const { data } = await supabase
        .from('room_participants')
        .select(`
          *,
          user:user_id(id, first_name, last_name, email, avatar_url)
        `)
        .eq('booking_id', bookingId);

      if (data) setParticipants(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Lỗi',
        description: errorMessage || 'Không thể thêm người tham gia',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('room_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: 'Người tham gia đã được xóa'
      });

      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Lỗi',
        description: errorMessage || 'Không thể xóa người tham gia',
        variant: 'destructive'
      });
    }
  };

  const handleCreateGoogleMeet = async () => {
    try {
      setIsCreatingMeet(true);
      // Generate a simple Google Meet URL format
      // In production, you would integrate with Google Calendar API or generate a unique meeting ID
      const meetingId = `meet-${bookingId}-${Date.now()}`;
      const googleMeetLink = `https://meet.google.com/${meetingId}`;

      // Update room booking with Google Meet link
      const { error } = await supabase
        .from('room_bookings')
        .update({ google_meet_link: googleMeetLink })
        .eq('id', bookingId);

      if (error) throw error;

      setGoogleMeetUrl(googleMeetLink);

      toast({
        title: 'Thành công',
        description: 'Google Meet đã được tạo'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Lỗi',
        description: errorMessage || 'Không thể tạo Google Meet',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingMeet(false);
    }
  };

  const handleJoinMeeting = () => {
    if (googleMeetUrl) {
      window.open(googleMeetUrl, '_blank');
      // Update participant status to joined
      const updateJoinStatus = async () => {
        const participant = participants.find(p => p.user_id === currentUser?.id);
        if (participant) {
          await supabase
            .from('room_participants')
            .update({ status: 'joined', joined_at: new Date().toISOString() })
            .eq('id', participant.id);
        }
      };
      updateJoinStatus();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'declined':
        return <X className="h-4 w-4 text-red-600" />;
      case 'joined':
        return <Check className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'joined':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'declined':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Đang tải danh sách người tham gia...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Người Tham Gia Cuộc Họp
            </span>
            {isOrganizer && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm Người Tham Gia
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Thêm Người Tham Gia</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Chọn Người Dùng</label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Tìm kiếm người dùng..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allUsers
                            .filter(user => !participants.some(p => p.user_id === user.id))
                            .map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.first_name} {user.last_name} ({user.email})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                      Hủy
                    </Button>
                    <Button onClick={handleAddParticipant}>
                      Thêm
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardTitle>
          <CardDescription>
            {participants.length} người tham gia
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Google Meet Section */}
          {isOrganizer && (
            <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Google Meet
                  </h4>
                  {googleMeetUrl ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      <a href={googleMeetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {googleMeetUrl}
                      </a>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Chưa tạo Google Meet</p>
                  )}
                </div>
                {!googleMeetUrl && (
                  <Button
                    size="sm"
                    onClick={handleCreateGoogleMeet}
                    disabled={isCreatingMeet}
                  >
                    {isCreatingMeet ? 'Đang tạo...' : 'Tạo Google Meet'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Join Meeting Button */}
          {!isOrganizer && googleMeetUrl && (
            <Button
              onClick={handleJoinMeeting}
              className="w-full"
              size="lg"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Tham Gia Google Meet
            </Button>
          )}

          {/* Participants List */}
          <div className="space-y-2">
            {participants.length > 0 ? (
              participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participant.user?.avatar_url || undefined} />
                      <AvatarFallback>
                        {(participant.user?.first_name?.[0] || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {participant.user?.first_name} {participant.user?.last_name}
                        {participant.is_organizer && (
                          <Badge className="ml-2" variant="secondary">
                            Tổ Chức Viên
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {participant.user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(participant.status)}`}>
                      {getStatusIcon(participant.status)}
                      {participant.status === 'invited' && 'Chờ Phản Hồi'}
                      {participant.status === 'accepted' && 'Đã Chấp Nhận'}
                      {participant.status === 'declined' && 'Đã Từ Chối'}
                      {participant.status === 'joined' && 'Đã Tham Gia'}
                    </div>

                    {isOrganizer && !participant.is_organizer && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveParticipant(participant.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-6">
                Chưa có người tham gia
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomParticipantsManager;
