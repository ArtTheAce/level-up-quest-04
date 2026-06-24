import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserCheck, UserX, Search, Users, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

// Profile shape from the profiles table.
// 'id' is set to profiles.user_id (the auth user UUID) — matching the pattern
// used in RivalryTab and SocialTab. profiles.level does not exist; it lives in game_state.
interface Profile {
  id: string;         // = profiles.user_id
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

// Lightweight request row — profile resolved separately
interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  profile: Profile | null;  // resolved after fetch
}

/** Fetch profiles for a list of auth user IDs */
async function fetchProfiles(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', userIds);
  return (data || []).map(p => ({
    id: p.user_id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
  }));
}

export default function Friends() {
  // useAuth().profile has no .id — use user.id (the auth UUID) for all DB queries
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (user) loadFriendsData();
  }, [user]);

  async function loadFriendsData() {
    if (!user) return;
    setLoading(true);
    try {
      // ── Friends ────────────────────────────────────────────────────────
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (friendships && friendships.length > 0) {
        const friendIds = friendships.map(f =>
          f.user_id === user.id ? f.friend_id : f.user_id
        );
        setFriends(await fetchProfiles(friendIds));
      } else {
        setFriends([]);
      }

      // ── Incoming requests (current user is to_user_id) ─────────────────
      const { data: rawIncoming } = await supabase
        .from('friend_requests')
        .select('id, from_user_id, to_user_id, status')
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      if (rawIncoming && rawIncoming.length > 0) {
        const senderIds = rawIncoming.map(r => r.from_user_id);
        const senderProfiles = await fetchProfiles(senderIds);
        const profileMap = Object.fromEntries(senderProfiles.map(p => [p.id, p]));
        setIncomingRequests(rawIncoming.map(r => ({
          ...r,
          profile: profileMap[r.from_user_id] ?? null,
        })));
      } else {
        setIncomingRequests([]);
      }

      // ── Outgoing requests (current user is from_user_id) ───────────────
      const { data: rawOutgoing } = await supabase
        .from('friend_requests')
        .select('id, from_user_id, to_user_id, status')
        .eq('from_user_id', user.id)
        .eq('status', 'pending');

      if (rawOutgoing && rawOutgoing.length > 0) {
        const receiverIds = rawOutgoing.map(r => r.to_user_id);
        const receiverProfiles = await fetchProfiles(receiverIds);
        const profileMap = Object.fromEntries(receiverProfiles.map(p => [p.id, p]));
        setOutgoingRequests(rawOutgoing.map(r => ({
          ...r,
          profile: profileMap[r.to_user_id] ?? null,
        })));
      } else {
        setOutgoingRequests([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers(query: string) {
    if (!query.trim() || !user) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .ilike('username', `%${query}%`)
        .neq('user_id', user.id)
        .limit(10);
      setSearchResults((data || []).map(p => ({
        id: p.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      })));
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(userId: string) {
    if (!user) return;
    const { error } = await supabase.from('friend_requests').insert({
      from_user_id: user.id,
      to_user_id: userId,
      status: 'pending',
    });
    if (error) { toast.error('Failed to send friend request'); return; }
    toast.success('Friend request sent! 📨');
    loadFriendsData();
  }

  // Feature 3: Cancel an outgoing friend request
  async function cancelRequest(requestId: string) {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);
    if (error) { toast.error('Failed to cancel request'); return; }
    toast.success('Friend request cancelled');
    setOutgoingRequests(prev => prev.filter(r => r.id !== requestId));
    if (searchQuery.trim()) searchUsers(searchQuery);
  }

  async function acceptRequest(requestId: string) {
    const { error } = await supabase.rpc('accept_friend_request', { _request_id: requestId });
    if (error) { toast.error('Failed to accept request'); return; }
    toast.success('Friend added! 🎉');
    loadFriendsData();
  }

  async function rejectRequest(requestId: string) {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    if (error) { toast.error('Failed to decline request'); return; }
    toast.success('Request declined');
    setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
  }

  async function removeFriend(friendId: string) {
    if (!user) return;
    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
    if (error) { toast.error('Failed to remove friend'); return; }
    toast.success('Friend removed');
    setFriends(prev => prev.filter(f => f.id !== friendId));
  }

  const isFriend = (uid: string) => friends.some(f => f.id === uid);
  const getOutgoingReq = (uid: string) => outgoingRequests.find(r => r.to_user_id === uid);
  const hasPendingIncoming = (uid: string) => incomingRequests.some(r => r.from_user_id === uid);

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
        <h2 className="font-display font-bold text-base">Find People</h2>
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
              {searchResults.map(result => {
                const friend = isFriend(result.id);
                const outgoingReq = getOutgoingReq(result.id);
                const incoming = hasPendingIncoming(result.id);
                return (
                  <div key={result.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={result.avatar_url ?? undefined} />
                      <AvatarFallback>{(result.display_name || result.username)[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.display_name || result.username}</p>
                      <p className="text-xs text-muted-foreground">@{result.username}</p>
                    </div>
                    {friend ? (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <UserCheck className="h-4 w-4" /> Friends
                      </span>
                    ) : incoming ? (
                      <span className="text-xs text-muted-foreground">Sent you a request</span>
                    ) : outgoingReq ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelRequest(outgoingReq.id)}
                        className="text-destructive hover:text-destructive gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => sendRequest(result.id)}>
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
            <Clock className="h-5 w-5 text-primary" /> <span className="text-base">Incoming Requests</span>
            <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
              {incomingRequests.length}
            </span>
          </h2>
          {incomingRequests.map(req => {
            const p = req.profile;
            return (
              <div key={req.id} className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p?.avatar_url ?? undefined} />
                  <AvatarFallback>{((p?.display_name || p?.username) ?? 'U')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p?.display_name || p?.username}</p>
                  <p className="text-xs text-muted-foreground">@{p?.username}</p>
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
            );
          })}
        </div>
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base text-muted-foreground">Sent Requests</h2>
          {outgoingRequests.map(req => {
            const p = req.profile;
            return (
              <div key={req.id} className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p?.avatar_url ?? undefined} />
                  <AvatarFallback>{((p?.display_name || p?.username) ?? 'U')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p?.display_name || p?.username}</p>
                  <p className="text-xs text-muted-foreground">@{p?.username}</p>
                </div>
                {/* Feature 3: Cancel button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancelRequest(req.id)}
                  className="text-destructive hover:text-destructive gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Friends List */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="font-display font-bold flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" /> <span className="text-base">My Friends</span>
          {!loading && <span className="text-muted-foreground font-normal text-sm">({friends.length})</span>}
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
                <p className="text-xs text-muted-foreground">@{friend.username}</p>
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
