import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "../App";
import axios from "axios";
import { toast } from "sonner";
import { 
  Search, MessageCircle, Coins, User, LogOut, UserPlus, Check, X, 
  Clock, Users, MapPin, ArrowLeft
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const FriendRequestsPage = () => {
  const navigate = useNavigate();
  const { user, logout, settings } = useAuth();
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("sigmat_token");
    try {
      const [receivedRes, sentRes, friendsRes] = await Promise.all([
        axios.get(`${API}/friends/requests/received`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/friends/requests/sent`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/friends/list`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setReceivedRequests(receivedRes.data);
      setSentRequests(sentRes.data);
      setFriends(friendsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (requestId) => {
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.post(`${API}/friends/requests/${requestId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Zahtjev prihvaćen! Sada ste prijatelji.");
      fetchData();
    } catch (error) {
      toast.error("Greška pri prihvaćanju zahtjeva");
    }
  };

  const rejectRequest = async (requestId) => {
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.post(`${API}/friends/requests/${requestId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Zahtjev odbijen");
      fetchData();
    } catch (error) {
      toast.error("Greška pri odbijanju zahtjeva");
    }
  };

  const cancelRequest = async (requestId) => {
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.delete(`${API}/friends/requests/${requestId}/cancel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Zahtjev otkazan");
      fetchData();
    } catch (error) {
      toast.error("Greška pri otkazivanju zahtjeva");
    }
  };

  const removeFriend = async (friendId) => {
    if (!window.confirm("Jesi li siguran da želiš ukloniti ovog prijatelja?")) return;
    
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.delete(`${API}/friends/${friendId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Prijatelj uklonjen");
      fetchData();
    } catch (error) {
      toast.error("Greška pri uklanjanju prijatelja");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={settings.logo_url} alt="SIGMAT SMS Logo" className="h-10 w-10 object-contain" />
            <span className="text-2xl font-bold text-slate-900 hidden md:block" style={{ fontFamily: 'Manrope, sans-serif' }}>
              SIGMAT
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate("/dashboard")} className="nav-link flex items-center gap-2 py-2">
              <User className="w-5 h-5" /><span>Početna</span>
            </button>
            <button onClick={() => navigate("/search")} className="nav-link flex items-center gap-2 py-2">
              <Search className="w-5 h-5" /><span>Pretraga</span>
            </button>
            <button onClick={() => navigate("/chat")} className="nav-link flex items-center gap-2 py-2">
              <MessageCircle className="w-5 h-5" /><span>Poruke</span>
            </button>
            <button onClick={() => navigate("/friend-requests")} className="nav-link active flex items-center gap-2 py-2">
              <UserPlus className="w-5 h-5" /><span>Zahtjevi</span>
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/buy-points")} className="points-badge flex items-center gap-2">
              <Coins className="w-4 h-4" /><span>{user.points} bodova</span>
            </button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500 hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 main-content">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Prijatelji i zahtjevi
          </h1>
          <p className="text-slate-600">Upravljaj zahtjevima za prijateljstvo i prijateljima</p>
        </div>

        <Tabs defaultValue="received" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="received" className="data-[state=active]:bg-[#0056D2] data-[state=active]:text-white">
              Primljeni zahtjevi
              {receivedRequests.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{receivedRequests.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="data-[state=active]:bg-[#0056D2] data-[state=active]:text-white">
              Poslani zahtjevi
            </TabsTrigger>
            <TabsTrigger value="friends" className="data-[state=active]:bg-[#0056D2] data-[state=active]:text-white">
              Prijatelji ({friends.length})
            </TabsTrigger>
          </TabsList>

          {/* Received Requests */}
          <TabsContent value="received">
            <div className="bg-white rounded-2xl card-shadow p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0056D2]" />
                Primljeni zahtjevi za prijateljstvo
              </h2>
              
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                      <div className="w-14 h-14 bg-slate-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : receivedRequests.length > 0 ? (
                <div className="space-y-4">
                  {receivedRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl" data-testid={`received-request-${req.id}`}>
                      <div 
                        className="w-14 h-14 rounded-full overflow-hidden cursor-pointer"
                        onClick={() => navigate(`/profile/${req.sender.id}`)}
                      >
                        {req.sender.profile_photo ? (
                          <img src={req.sender.profile_photo} alt={req.sender.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#0056D2] to-[#FF9F1C] flex items-center justify-center text-white font-bold text-lg">
                            {req.sender.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p 
                          className="font-semibold text-slate-900 cursor-pointer hover:text-[#0056D2]"
                          onClick={() => navigate(`/profile/${req.sender.id}`)}
                        >
                          {req.sender.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {req.sender.city} • {req.sender.age} god.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => acceptRequest(req.id)}
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 rounded-full"
                          data-testid={`accept-${req.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Prihvati
                        </Button>
                        <Button
                          onClick={() => rejectRequest(req.id)}
                          size="sm"
                          variant="outline"
                          className="rounded-full border-red-300 text-red-500 hover:bg-red-50"
                          data-testid={`reject-${req.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserPlus className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Nema novih zahtjeva</h3>
                  <p className="text-slate-500">Kada ti netko pošaje zahtjev za prijateljstvo, pojavit će se ovdje</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Sent Requests */}
          <TabsContent value="sent">
            <div className="bg-white rounded-2xl card-shadow p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Poslani zahtjevi (na čekanju)
              </h2>
              
              {sentRequests.length > 0 ? (
                <div className="space-y-4">
                  {sentRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl" data-testid={`sent-request-${req.id}`}>
                      <div 
                        className="w-14 h-14 rounded-full overflow-hidden cursor-pointer"
                        onClick={() => navigate(`/profile/${req.receiver.id}`)}
                      >
                        {req.receiver.profile_photo ? (
                          <img src={req.receiver.profile_photo} alt={req.receiver.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#0056D2] to-[#FF9F1C] flex items-center justify-center text-white font-bold text-lg">
                            {req.receiver.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{req.receiver.name}</p>
                        <p className="text-sm text-slate-500">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {req.receiver.city} • {req.receiver.age} god.
                        </p>
                      </div>
                      <Button
                        onClick={() => cancelRequest(req.id)}
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        data-testid={`cancel-${req.id}`}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Otkaži
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Nema poslanih zahtjeva</h3>
                  <p className="text-slate-500 mb-4">Pronađi ljude i pošalji im zahtjev za prijateljstvo</p>
                  <Button onClick={() => navigate("/search")} className="bg-[#0056D2] hover:bg-[#0044A6] rounded-full">
                    <Search className="w-4 h-4 mr-2" />
                    Pretraži korisnike
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Friends List */}
          <TabsContent value="friends">
            <div className="bg-white rounded-2xl card-shadow p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-500" />
                Moji prijatelji
              </h2>
              
              {friends.length > 0 ? (
                <div className="space-y-4">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl" data-testid={`friend-${friend.id}`}>
                      <div 
                        className="w-14 h-14 rounded-full overflow-hidden cursor-pointer"
                        onClick={() => navigate(`/profile/${friend.id}`)}
                      >
                        {friend.profile_photo ? (
                          <img src={friend.profile_photo} alt={friend.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#0056D2] to-[#FF9F1C] flex items-center justify-center text-white font-bold text-lg">
                            {friend.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p 
                          className="font-semibold text-slate-900 cursor-pointer hover:text-[#0056D2]"
                          onClick={() => navigate(`/profile/${friend.id}`)}
                        >
                          {friend.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {friend.city} • {friend.age} god.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => navigate(`/chat/${friend.id}`)}
                          size="sm"
                          className="bg-[#0056D2] hover:bg-[#0044A6] rounded-full"
                          data-testid={`chat-${friend.id}`}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Poruka
                        </Button>
                        <Button
                          onClick={() => removeFriend(friend.id)}
                          size="sm"
                          variant="outline"
                          className="rounded-full text-red-500 border-red-200 hover:bg-red-50"
                          data-testid={`remove-${friend.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Nemaš prijatelja</h3>
                  <p className="text-slate-500 mb-4">Pretraži korisnike i pošalji zahtjeve za prijateljstvo</p>
                  <Button onClick={() => navigate("/search")} className="bg-[#0056D2] hover:bg-[#0044A6] rounded-full">
                    <Search className="w-4 h-4 mr-2" />
                    Pretraži korisnike
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile Navigation */}
      <div className="mobile-nav md:hidden">
        <button onClick={() => navigate("/dashboard")} className="mobile-nav-item">
          <User className="w-6 h-6" /><span>Početna</span>
        </button>
        <button onClick={() => navigate("/search")} className="mobile-nav-item">
          <Search className="w-6 h-6" /><span>Pretraga</span>
        </button>
        <button onClick={() => navigate("/friend-requests")} className="mobile-nav-item active">
          <UserPlus className="w-6 h-6" /><span>Zahtjevi</span>
        </button>
        <button onClick={() => navigate("/chat")} className="mobile-nav-item">
          <MessageCircle className="w-6 h-6" /><span>Poruke</span>
        </button>
      </div>
    </div>
  );
};
