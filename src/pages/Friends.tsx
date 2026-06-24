import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserCheck, UserX, Search, Users, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  profiles: Profile;
}

export default function Friends() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (profile) {
      loadFriendsData();
    }
  }, [profile]);

  async function loadFriendsData() {
    if (!profile) return;
    setLoading(true);
    try {
      // Load friendships
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${profile.id},user_id_2.eq.${profile.id}`);

      if (friendships) {
        const friendIds = friendships.map(f =>
          f.user_id_1 === profile.id ? f.user_id_2 : f.user_id_1
        );
        if (friendIds.length > 0) {
          const { data: friendProfiles } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, level')
            .in('id', friendIds);
          setFriends(friendProfiles || []);
        } else {
          setFriends([]);
        }
      }

      // Load incoming requests
      const { data: incoming } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status, created_at, profiles!friend_requests_sender_id_fkey(id, username, display_name, avatar_url, level)')
        .eq('receiver_id', profile.id)
        .eq('status', 'pending');
      setIncomingRequests((incoming as unknown as FriendRequest[]) || []);

      // Load outgoing requests
      const { data: outgoing } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status, created_at, profiles!friend_requests_receiver_id_fkey(id, username, display_name, avatar_url, level)')
        .eq('sender_id', profile.id)
        .eq('status', 'pending');
      setOutgoingRequests((outgoing as unknown as FriendRequest[]) || []);
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers(query: string) {
    if (!query.trim() || !profile) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, level')
        .ilike('username', `%${query}%`)
        .neq('id', profile.id)
        .limit(10);
      setSearchResults(data || []);
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(userId: string) {
    if (!profile) return;
    const { error } = await supabase.from('friend_requests').insert({
      sender_id: profile.id,
      receiver_id: userId,
      status: 'pending',
    });
    if (error) {
      toast.error('Failed to send friend request');
      return;
    }
    toast.success('Friend request sent! 📨');
    loadFriendsData();
    // Update search results UI
    setSearchResults(prev => prev.map(u => u.id === userId ? { ...u } : u));
  }

  // Feature 3: Cancel outgoing friend request
  async function cancelRequest(requestId: string) {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);
    if (error) {
      toast.error('Failed to cancel request');
      return;
    }
    toast.success('Friend request cancelled');
    setOutgoingRequests(prev => prev.filter(r => r.id !== requestId));
    // Refresh search results so user can re-send if needed
    if (searchQuery.trim()) {
      searchUsers(searchQuery);
    }
  }

  async function acceptRequest(requestId: string) {
    const { error } = await supabase.rpc('accept_friend_request', { request_id: requestId });
    if (error) {
      toast.error('Failed to accept request');
      return;
    }
    toast.success('Friend added! 🎉');
    loadFriendsData();
  }

  async function rejectRequest(requestId: string) {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    if (error) {
      toast.error('Failed to decline request');
      return;
    }
    toast.success('Request declined');
    setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
  }

  async function removeFriend(friendId: string) {
    if (!profile) return;
    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(
        `and(user_id_1.eq.${profile.id},user_id_2.eq.${friendId}),and(user_id_1.eq.${friendId},user_id_2.eq.${profile.id})`
      );
    if (error) {
      toast.error('Failed to remove friend');
      return;
    }
    toast.success('Friend removed');
    setFriends(prev => prev.filter(f => f.id !== friendId));
  }

  const isFriend = (userId: string) => friends.some(f => f.id === userId);
  const hasPendingOutgoing = (userId: string) => outgoingRequests.some(r => r.profiles?.id === userId);
  const getOutgoingRequest = (userId: string) => outgoingRequests.find(r => r.profiles?.id === userId);
  const hasPendingIncoming = (userId: string) => incomingRequests.some(r => r.profiles?.id === userId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" /> Friends
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Find study buddies, challenge rivals, build your crew.</p>
      </div>

      {/* Search */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="font-display font-bold">Find People</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by username…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUsers(searchQuery)}
            />
          </div>
          <Button onClick={() => searchUsers(searchQuery)} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </div>

        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              {searchResults.map(user => {
                const friend = isFriend(user.id);
                const outgoing = hasPendingOutgoing(user.id);
                const outgoingReq = getOutgoingRequest(user.id);
                const incoming = hasPendingIncoming(user.id);
                return (
                  <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback>{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.display_name || user.username}</p>
                      <p className="text-xs text-muted-foreground">@{user.username} · Lv {user.level}</p>
                    </div>
                    {friend ? (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <UserCheck className="h-4 w-4" /> Friends
                      </span>
                    ) : incoming ? (
                      <span className="text-xs text-muted-foreground">Sent you a request</span>
                    ) : outgoing && outgoingReq ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelRequest(outgoingReq.id)}
                        className="text-destructive hover:text-destructive gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => sendRequest(user.id)}>
                        <UserPlus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h2 className="font-display font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Incoming Requests
            <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
              {incomingRequests.length}
            </span>
          </h2>
          {incomingRequests.map(req => (
            <div key={req.id} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={req.profiles?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {((req.profiles?.display_name || req.profiles?.username) ?? 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{req.profiles?.display_name || req.profiles?.username}</p>
                <p className="text-xs text-muted-foreground">@{req.profiles?.username} · Lv {req.profiles?.level}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => acceptRequest(req.id)}>
                  <UserCheck className="h-4 w-4 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => rejectRequest(req.id)}>
                  <UserX className="h-4 w-4 mr-1" /> Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h2 className="font-display font-bold text-muted-foreground">Sent Requests</h2>
          {outgoingRequests.map(req => (
            <div key={req.id} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={req.profiles?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {((req.profiles?.display_name || req.profiles?.username) ?? 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{req.profiles?.display_name || req.profiles?.username}</p>
                <p className="text-xs text-muted-foreground">@{req.profiles?.username} · Lv {req.profiles?.level}</p>
              </div>
              {/* Feature 3: Cancel button for outgoing requests */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => cancelRequest(req.id)}
                className="text-destructive hover:text-destructive gap-1"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="font-display font-bold flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" /> My Friends
          {!loading && (
            <span className="text-muted-foreground font-normal text-sm">({friends.length})</span>
          )}
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No friends yet. Search for people to add!</p>
        ) : (
          friends.map(friend => (
            <div key={friend.id} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={friend.avatar_url ?? undefined} />
                <AvatarFallback>{(friend.display_name || friend.username)[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{friend.display_name || friend.username}</p>
                <p className="text-xs text-muted-foreground">@{friend.username} · Lv {friend.level}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFriend(friend.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <UserX className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
