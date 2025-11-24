import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Users, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CreateRoomDialog from "./CreateRoomDialog";
import { SkeletonCard } from "@/components/ui/skeleton-card";

const RoomList = ({ role }: { role: UserRole }) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_rooms')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching rooms:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {role === 'admin' && (
        <div className="flex justify-end">
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Room
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <Card key={room.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {room.name}
                <Badge variant="outline">Active</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {room.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {room.location}
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                Capacity: {room.capacity} people
              </div>

              {room.equipment && room.equipment.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Monitor className="h-4 w-4" />
                    Equipment:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {room.equipment.map((item: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {role === 'admin' && (
        <CreateRoomDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onRoomCreated={fetchRooms}
        />
      )}
    </div>
  );
};

export default RoomList;
