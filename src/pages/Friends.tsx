import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Check, X, Users, UserMinus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface UserResult {
  user_id: string;
  username: string;
  display_name: string | null;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_profile?: UserResult;
  to_profile?: UserResult;
}

interface Friend {
  user_id: string;
  username: string;
  display_name: string | null;
}

export default function Friends() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');

  const fetchFriends = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (!data) return;
    const friendIds = data.map(f => f.user_id === user.id ? f.friend_id : f.user_id);
    if (friendIds.length === 0) { setFriends([]); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name')
      .in('user_id', friendIds);

    setFriends(profiles || []);
  };

  const fetchRequests = async () => {
    if (!user) return;

    const { data: incoming } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending');

    if (incoming && incoming.length > 0) {
      const fromIds = incoming.map(r => r.from_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name')
        .in('user_id', fromIds);

      const enriched = incoming.map(r => ({
        ...r,
        from_profile: profiles?.find(p => p.user_id === r.from_user_id),
      }));
      setIncomingRequests(enriched);
    } else {
      setIncomingRequests([]);
    }

    const { data: outgoing } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('from_user_id', user.id)
      .eq('status', 'pending');

    if (outgoing && outgoing.length > 0) {
      const toIds = outgoing.map(r => r.to_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name')
        .in('user_id', toIds);

      const enriched = outgoing.map(r => ({
        ...r,
        to_profile: profiles?.find(p => p.user_id === r.to_user_id),
      }));
      setOutgoingRequests(enriched);
    } else {
      setOutgoingRequests([]);
    }
  };

  useEffect(() => {
    fetchFriends();
    fetchRequests();
  }, [user]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, display_name')
      .ilike('username', `%${searchQuery.toLowerCase()}%`)
      .neq('user_id', user.id)
      .limit(10);
    setSearchResults(data || []);
    setSearching(false);
  };

  const sendRequest = async (toUserId: string) => {
    if (!user) return;
    const { error } = await supabase.from('friend_requests').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
    });
    if (error) {
      if (error.code === '23505') toast.error('Request already sent!');
      else toast.error('Failed to send request');
    } else {
      toast.success('Friend request sent! 🤝');
      fetchRequests();
    }
  };

  const acceptRequest = async (requestId: string, fromUserId: string) => {
    if (!user) return;
    const { error } = await supabase.rpc('accept_friend_request', { _request_id: requestId });
    if (error) {
      toast.error('Failed to accept');
      return;
    }
    toast.success('Friend added! 🎉');
    fetchFriends();
    fetchRequests();
  };

  const rejectRequest = async (requestId: string) => {
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', requestId);
    toast.success('Request declined');
    fetchRequests();
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    await supabase.from('friendships').delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
    toast.success('Friend removed');
    fetchFriends();
  };

  const isFriend = (userId: string) => friends.some(f => f.user_id === userId);
  const hasPendingRequest = (userId: string) =>
    outgoingRequests.some(r => r.to_user_id === userId) ||
    incomingRequests.some(r => r.from_user_id === userId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Friends 👥</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect with friends and compete together!
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'friends' as const, label: 'Friends', icon: Users, count: friends.length },
          { id: 'requests' as const, label: 'Requests', icon: UserPlus, count: incomingRequests.length },
          { id: 'search' as const, label: 'Find Users', icon: Search },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="bg-primary-foreground/20 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search Tab */}
      {tab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <AnimatePresence mode="popLayout">
            {searchResults.map(result => (
              <motion.div
                key={result.user_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-card p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-display font-bold">{result.display_name || result.username}</p>
                  <p className="text-sm text-muted-foreground">@{result.username}</p>
                </div>
                {isFriend(result.user_id) ? (
                  <span className="text-sm text-primary font-medium">✅ Friends</span>
                ) : hasPendingRequest(result.user_id) ? (
                  <span className="text-sm text-muted-foreground">Pending...</span>
                ) : (
                  <Button size="sm" onClick={() => sendRequest(result.user_id)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Add
                  </Button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {searchResults.length === 0 && searchQuery && !searching && (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          )}
        </div>
      )}

      {/* Requests Tab */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {incomingRequests.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-sm text-muted-foreground mb-3">Incoming Requests</h3>
              {incomingRequests.map(req => (
                <div key={req.id} className="glass-card p-4 flex items-center justify-between mb-2">
                  <div>
                    <p className="font-display font-bold">
                      {req.from_profile?.display_name || req.from_profile?.username || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground">@{req.from_profile?.username}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => acceptRequest(req.id, req.from_user_id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectRequest(req.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {outgoingRequests.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-sm text-muted-foreground mb-3">Sent Requests</h3>
              {outgoingRequests.map(req => (
                <div key={req.id} className="glass-card p-4 flex items-center justify-between mb-2">
                  <div>
                    <p className="font-display font-bold">
                      {req.to_profile?.display_name || req.to_profile?.username || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground">@{req.to_profile?.username}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Pending</span>
                </div>
              ))}
            </div>
          )}

          {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-2">📬</p>
              <p>No pending requests</p>
            </div>
          )}
        </div>
      )}

      {/* Friends Tab */}
      {tab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-2">👥</p>
              <p>No friends yet. Search for users to add!</p>
            </div>
          ) : (
            friends.map(friend => (
              <motion.div
                key={friend.user_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-4 flex items-center justify-between group"
              >
                <div>
                  <p className="font-display font-bold">{friend.display_name || friend.username}</p>
                  <p className="text-sm text-muted-foreground">@{friend.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => removeFriend(friend.user_id)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
