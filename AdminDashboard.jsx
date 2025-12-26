import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "../App";
import axios from "axios";
import { toast } from "sonner";
import { 
  Users, Settings, LogOut, Coins, Search, Trash2, Pause, Ban, CheckCircle, 
  Upload, Image, RefreshCw, Plus, Home, LogIn, UserPlus, Eye, X, Check,
  ImageOff, UserCircle, MapPin, Calendar, Mail, Send, Bell, Megaphone,
  Video, ToggleLeft, ToggleRight, DollarSign, CreditCard
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, logout, settings, refreshSettings } = useAuth();
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pendingImages, setPendingImages] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showAddPointsDialog, setShowAddPointsDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [pointsToAdd, setPointsToAdd] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [broadcastForm, setBroadcastForm] = useState({ title: "", content: "", type: "info", image_url: "", video_url: "" });
  const [broadcastImageFile, setBroadcastImageFile] = useState(null);
  const [broadcastVideoFile, setBroadcastVideoFile] = useState(null);
  const [appSettings, setAppSettings] = useState({
    logo_url: "",
    background_url: "",
    landing_hero_url: "",
    login_bg_url: "",
    register_bg_url: "",
    payment_mode: "paid",
    paypal_email: "paybey2@gmail.com"
  });
  const [paypalEmail, setPaypalEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const logoInputRef = useRef(null);
  const landingHeroRef = useRef(null);
  const loginBgRef = useRef(null);
  const registerBgRef = useRef(null);
  const broadcastImageRef = useRef(null);
  const broadcastVideoRef = useRef(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/admin/login");
      return;
    }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    const token = localStorage.getItem("sigmat_token");
    try {
      const [usersRes, settingsRes, paymentsRes, pendingRes, broadcastsRes] = await Promise.all([
        axios.get(`${API}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/payments`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/pending-images`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/broadcasts`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setUsers(usersRes.data);
      setAppSettings(settingsRes.data);
      setPaypalEmail(settingsRes.data.paypal_email || "paybey2@gmail.com");
      setPayments(paymentsRes.data);
      setPendingImages(pendingRes.data);
      setBroadcasts(broadcastsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const viewUserProfile = async (userId) => {
    const token = localStorage.getItem("sigmat_token");
    try {
      const res = await axios.get(`${API}/admin/users/${userId}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setViewingProfile(res.data);
      setShowProfileDialog(true);
    } catch (error) {
      toast.error("Greška pri učitavanju profila");
    }
  };

  const sendMessageToUser = async () => {
    if (!selectedUser || !messageContent.trim()) return;
    
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.post(`${API}/admin/send-user-message`, {
        user_id: selectedUser.id,
        content: messageContent
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Poruka poslana korisniku ${selectedUser.name}`);
      setShowMessageDialog(false);
      setMessageContent("");
    } catch (error) {
      toast.error("Greška pri slanju poruke");
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.content.trim()) {
      toast.error("Unesite naslov i sadržaj obavijesti");
      return;
    }
    
    const token = localStorage.getItem("sigmat_token");
    try {
      let imageUrl = broadcastForm.image_url;
      let videoUrl = broadcastForm.video_url;
      
      // Upload image if selected
      if (broadcastImageFile) {
        const formData = new FormData();
        formData.append("file", broadcastImageFile);
        const uploadRes = await axios.post(`${API}/admin/upload`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
        });
        imageUrl = uploadRes.data.url;
      }
      
      // Upload video if selected
      if (broadcastVideoFile) {
        const formData = new FormData();
        formData.append("file", broadcastVideoFile);
        const uploadRes = await axios.post(`${API}/admin/upload`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
        });
        videoUrl = uploadRes.data.url;
      }
      
      await axios.post(`${API}/admin/broadcast`, {
        ...broadcastForm,
        image_url: imageUrl,
        video_url: videoUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Obavijest poslana svim korisnicima!");
      setShowBroadcastDialog(false);
      setBroadcastForm({ title: "", content: "", type: "info", image_url: "", video_url: "" });
      setBroadcastImageFile(null);
      setBroadcastVideoFile(null);
      fetchData();
    } catch (error) {
      toast.error("Greška pri slanju obavijesti");
    }
  };

  const deleteBroadcast = async (broadcastId) => {
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.delete(`${API}/admin/broadcasts/${broadcastId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Obavijest obrisana");
      fetchData();
    } catch (error) {
      toast.error("Greška pri brisanju obavijesti");
    }
  };

  const togglePaymentMode = async () => {
    const token = localStorage.getItem("sigmat_token");
    const newMode = appSettings.payment_mode === "paid" ? "free" : "paid";
    try {
      await axios.put(`${API}/admin/settings`, { payment_mode: newMode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppSettings(prev => ({ ...prev, payment_mode: newMode }));
      toast.success(newMode === "free" ? "Poruke su sada BESPLATNE!" : "Poruke se sada PLAĆAJU!");
      refreshSettings();
    } catch (error) {
      toast.error("Greška pri promjeni načina plaćanja");
    }
  };

  const updatePaypalEmail = async () => {
    if (!paypalEmail.trim() || !paypalEmail.includes("@")) {
      toast.error("Unesite ispravnu email adresu");
      return;
    }
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.put(`${API}/admin/settings`, { paypal_email: paypalEmail }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppSettings(prev => ({ ...prev, paypal_email: paypalEmail }));
      toast.success("PayPal email ažuriran!");
      refreshSettings();
    } catch (error) {
      toast.error("Greška pri ažuriranju PayPal emaila");
    }
  };

  const approveImage = async (userId, photoId) => {
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.put(`${API}/admin/images/${userId}/${photoId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Slika odobrena");
      fetchData();
    } catch (error) {
      toast.error("Greška pri odobravanju slike");
    }
  };

  const rejectImage = async (userId, photoId) => {
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.put(`${API}/admin/images/${userId}/${photoId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Slika odbijena i obrisana");
      fetchData();
    } catch (error) {
      toast.error("Greška pri odbijanju slike");
    }
  };

  const updateUserStatus = async (userId, status) => {
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.put(`${API}/admin/users/${userId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Status ažuriran`);
      fetchData();
      setShowUserDialog(false);
    } catch (error) {
      toast.error("Greška pri ažuriranju");
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Obrisati korisnika?")) return;
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.delete(`${API}/admin/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Korisnik obrisan");
      fetchData();
      setShowUserDialog(false);
    } catch (error) {
      toast.error("Greška");
    }
  };

  const addPointsToUser = async () => {
    if (!selectedUser || !pointsToAdd) return;
    const token = localStorage.getItem("sigmat_token");
    try {
      await axios.post(`${API}/admin/users/${selectedUser.id}/add-points?points=${parseInt(pointsToAdd)}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Dodano ${pointsToAdd} bodova`);
      setShowAddPointsDialog(false);
      setPointsToAdd("");
      fetchData();
    } catch (error) {
      toast.error("Greška");
    }
  };

  const handleFileUpload = async (file, settingKey) => {
    if (!file) return;
    setUploading(true);
    const token = localStorage.getItem("sigmat_token");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const uploadRes = await axios.post(`${API}/admin/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      await axios.put(`${API}/admin/settings`, { [settingKey]: uploadRes.data.url }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Slika ažurirana!");
      fetchData();
      refreshSettings();
    } catch (error) {
      toast.error("Greška pri uploadu");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case "active": return <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">Aktivan</span>;
      case "paused": return <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full text-xs">Pauziran</span>;
      case "blocked": return <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-full text-xs">Blokiran</span>;
      default: return null;
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={settings.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
            <span className="text-xl font-bold text-white">SIGMAT <span className="text-amber-400 text-sm">Admin</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowBroadcastDialog(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              <Megaphone className="w-4 h-4 mr-2" />Pošalji obavijest
            </Button>
            <Button variant="ghost" onClick={fetchData} className="text-slate-400 hover:text-white">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="users" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Users className="w-4 h-4 mr-2" />Korisnici
            </TabsTrigger>
            <TabsTrigger value="moderation" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <ImageOff className="w-4 h-4 mr-2" />Moderacija
              {pendingImages.length > 0 && <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingImages.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="broadcasts" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Bell className="w-4 h-4 mr-2" />Obavijesti
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Coins className="w-4 h-4 mr-2" />Plaćanja
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
              <Settings className="w-4 h-4 mr-2" />Postavke
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Ukupno</p>
                <p className="text-2xl font-bold text-white">{users.length}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Aktivni</p>
                <p className="text-2xl font-bold text-green-400">{users.filter(u => u.status === "active").length}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Pauzirani</p>
                <p className="text-2xl font-bold text-amber-400">{users.filter(u => u.status === "paused").length}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Blokirani</p>
                <p className="text-2xl font-bold text-red-400">{users.filter(u => u.status === "blocked").length}</p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <Input placeholder="Pretraži..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-slate-800 border-slate-700 text-white" />
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900 text-left">
                      <th className="p-4 text-slate-400 font-medium">Korisnik</th>
                      <th className="p-4 text-slate-400 font-medium">Email</th>
                      <th className="p-4 text-slate-400 font-medium">Grad</th>
                      <th className="p-4 text-slate-400 font-medium">Bodovi</th>
                      <th className="p-4 text-slate-400 font-medium">Status</th>
                      <th className="p-4 text-slate-400 font-medium">Akcije</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                              {u.profile_photo ? (
                                <img src={u.profile_photo} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[#0056D2] to-[#FF9F1C] flex items-center justify-center text-white font-bold">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">{u.name}</p>
                              <p className="text-slate-500 text-sm">{u.gender === "male" ? "M" : "Ž"} • {u.age} god.</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-slate-400">{u.email}</td>
                        <td className="p-4 text-slate-400">{u.city}</td>
                        <td className="p-4 text-amber-400 font-semibold">{u.points}</td>
                        <td className="p-4">{getStatusBadge(u.status)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => viewUserProfile(u.id)} className="text-blue-400 hover:text-blue-300" title="Vidi profil">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(u); setShowMessageDialog(true); }} className="text-green-400 hover:text-green-300" title="Pošalji poruku">
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(u); setShowUserDialog(true); }} className="text-slate-400 hover:text-white" title="Upravljaj">
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedUser(u); setShowAddPointsDialog(true); }} className="text-amber-400 hover:text-amber-300" title="Dodaj bodove">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Moderation Tab */}
          <TabsContent value="moderation" className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ImageOff className="w-5 h-5 text-red-400" />Slike na čekanju
              </h3>
              {pendingImages.length > 0 ? (
                <div className="space-y-6">
                  {pendingImages.map((item) => (
                    <div key={item.user_id} className="bg-slate-900 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          {item.pending_images[0]?.url ? (
                            <div className="w-full h-full bg-gradient-to-br from-[#0056D2] to-[#FF9F1C] flex items-center justify-center text-white font-bold">
                              {item.user_name.charAt(0)}
                            </div>
                          ) : (
                            <UserCircle className="w-10 h-10 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-semibold">{item.user_name}</p>
                          <p className="text-slate-400 text-sm">{item.user_email}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {item.pending_images.map((img) => (
                          <div key={img.id} className="relative group">
                            <img src={img.url} alt="Pending" className="w-full h-40 object-cover rounded-lg" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <Button size="sm" onClick={() => approveImage(item.user_id, img.id)} className="bg-green-500 hover:bg-green-600">
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => rejectImage(item.user_id, img.id)} className="bg-red-500 hover:bg-red-600">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Check className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-slate-400">Nema slika na čekanju</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Broadcasts Tab */}
          <TabsContent value="broadcasts" className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-400" />Poslane obavijesti
                </h3>
                <Button onClick={() => setShowBroadcastDialog(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                  <Plus className="w-4 h-4 mr-2" />Nova obavijest
                </Button>
              </div>
              {broadcasts.length > 0 ? (
                <div className="space-y-4">
                  {broadcasts.map((b) => (
                    <div key={b.id} className={`p-4 rounded-xl border ${
                      b.type === "promo" ? "bg-amber-500/10 border-amber-500/30" :
                      b.type === "warning" ? "bg-red-500/10 border-red-500/30" :
                      "bg-blue-500/10 border-blue-500/30"
                    }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-white font-semibold">{b.title}</h4>
                          <p className="text-slate-300 mt-1">{b.content}</p>
                          <p className="text-slate-500 text-sm mt-2">{new Date(b.created_at).toLocaleString("hr-HR")}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => deleteBroadcast(b.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Nema poslanih obavijesti</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 text-left">
                    <th className="p-4 text-slate-400">ID</th>
                    <th className="p-4 text-slate-400">Korisnik</th>
                    <th className="p-4 text-slate-400">Bodovi</th>
                    <th className="p-4 text-slate-400">Cijena</th>
                    <th className="p-4 text-slate-400">Status</th>
                    <th className="p-4 text-slate-400">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-slate-700">
                      <td className="p-4 text-slate-400 font-mono text-xs">{p.id.slice(0, 8)}...</td>
                      <td className="p-4 text-slate-400 font-mono text-xs">{p.user_id.slice(0, 8)}...</td>
                      <td className="p-4 text-amber-400 font-semibold">{p.amount}</td>
                      <td className="p-4 text-white">{p.price.toFixed(2)}€</td>
                      <td className="p-4">{p.status === "completed" ? <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">Završeno</span> : <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full text-xs">Čeka</span>}</td>
                      <td className="p-4 text-slate-400 text-sm">{new Date(p.created_at).toLocaleString("hr-HR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Payment Mode Toggle */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-400" />
                Način plaćanja poruka
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300">Trenutni način:</p>
                  <p className={`text-2xl font-bold ${appSettings.payment_mode === "free" ? "text-green-400" : "text-amber-400"}`}>
                    {appSettings.payment_mode === "free" ? "🆓 BESPLATNO" : "💰 PLAĆANJE"}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    {appSettings.payment_mode === "free" 
                      ? "Svi korisnici mogu slati poruke besplatno" 
                      : "Korisnici plaćaju 1 bod po poruci"}
                  </p>
                </div>
                <Button 
                  onClick={togglePaymentMode}
                  className={`${appSettings.payment_mode === "free" ? "bg-amber-500 hover:bg-amber-600" : "bg-green-500 hover:bg-green-600"} text-white px-6 py-3`}
                >
                  {appSettings.payment_mode === "free" ? (
                    <>
                      <DollarSign className="w-5 h-5 mr-2" />
                      Uključi plaćanje
                    </>
                  ) : (
                    <>
                      <ToggleRight className="w-5 h-5 mr-2" />
                      Uključi besplatno
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* PayPal Email Settings */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" />
                PayPal Email za naplatu
              </h3>
              <div className="flex gap-4">
                <Input 
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="vas-paypal@email.com"
                  className="bg-slate-900 border-slate-700 text-white flex-1"
                />
                <Button onClick={updatePaypalEmail} className="bg-blue-500 hover:bg-blue-600">
                  <Check className="w-4 h-4 mr-2" />
                  Spremi
                </Button>
              </div>
              <p className="text-slate-500 text-sm mt-2">Trenutni: {appSettings.paypal_email || "paybey2@gmail.com"}</p>
            </div>

            {/* Image Settings */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Image className="w-5 h-5 text-amber-400" />Logo</h3>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden">
                    {appSettings.logo_url ? <img src={appSettings.logo_url} alt="Logo" className="max-h-full" /> : <Image className="w-8 h-8 text-slate-600" />}
                  </div>
                  <input type="file" ref={logoInputRef} onChange={(e) => handleFileUpload(e.target.files[0], "logo_url")} accept="image/*" className="hidden" />
                  <Button onClick={() => logoInputRef.current?.click()} disabled={uploading} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                    <Upload className="w-4 h-4 mr-2" />Promijeni
                  </Button>
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Home className="w-5 h-5 text-blue-400" />Početna slika</h3>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 bg-slate-900 rounded-xl overflow-hidden">
                    {appSettings.landing_hero_url ? <img src={appSettings.landing_hero_url} alt="Hero" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Image className="w-8 h-8 text-slate-600" /></div>}
                  </div>
                  <input type="file" ref={landingHeroRef} onChange={(e) => handleFileUpload(e.target.files[0], "landing_hero_url")} accept="image/*" className="hidden" />
                  <Button onClick={() => landingHeroRef.current?.click()} disabled={uploading} className="bg-blue-500 hover:bg-blue-600"><Upload className="w-4 h-4 mr-2" />Promijeni</Button>
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><LogIn className="w-5 h-5 text-green-400" />Login slika</h3>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 bg-slate-900 rounded-xl overflow-hidden">
                    {appSettings.login_bg_url ? <img src={appSettings.login_bg_url} alt="Login" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Image className="w-8 h-8 text-slate-600" /></div>}
                  </div>
                  <input type="file" ref={loginBgRef} onChange={(e) => handleFileUpload(e.target.files[0], "login_bg_url")} accept="image/*" className="hidden" />
                  <Button onClick={() => loginBgRef.current?.click()} disabled={uploading} className="bg-green-500 hover:bg-green-600"><Upload className="w-4 h-4 mr-2" />Promijeni</Button>
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-purple-400" />Registracija slika</h3>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 bg-slate-900 rounded-xl overflow-hidden">
                    {appSettings.register_bg_url ? <img src={appSettings.register_bg_url} alt="Register" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Image className="w-8 h-8 text-slate-600" /></div>}
                  </div>
                  <input type="file" ref={registerBgRef} onChange={(e) => handleFileUpload(e.target.files[0], "register_bg_url")} accept="image/*" className="hidden" />
                  <Button onClick={() => registerBgRef.current?.click()} disabled={uploading} className="bg-purple-500 hover:bg-purple-600"><Upload className="w-4 h-4 mr-2" />Promijeni</Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Send Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Pošalji poruku korisniku</DialogTitle>
            <DialogDescription className="text-slate-400">Poruka za: {selectedUser?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Unesite poruku..."
              className="bg-slate-900 border-slate-700 text-white min-h-32"
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowMessageDialog(false)} className="flex-1 border-slate-600 text-slate-300">Odustani</Button>
              <Button onClick={sendMessageToUser} className="flex-1 bg-green-500 hover:bg-green-600">
                <Send className="w-4 h-4 mr-2" />Pošalji
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast Dialog */}
      <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Pošalji obavijest svim korisnicima</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Naslov</Label>
              <Input
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                placeholder="Naslov obavijesti"
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">Tip</Label>
              <Select value={broadcastForm.type} onValueChange={(v) => setBroadcastForm({ ...broadcastForm, type: v })}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Informacija</SelectItem>
                  <SelectItem value="promo">Promocija</SelectItem>
                  <SelectItem value="warning">Upozorenje</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Sadržaj</Label>
              <Textarea
                value={broadcastForm.content}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, content: e.target.value })}
                placeholder="Sadržaj obavijesti..."
                className="bg-slate-900 border-slate-700 text-white min-h-24"
              />
            </div>
            
            {/* Image Upload */}
            <div>
              <Label className="text-slate-300 flex items-center gap-2">
                <Image className="w-4 h-4" />Slika (opcionalno)
              </Label>
              <div className="flex items-center gap-3 mt-2">
                {broadcastImageFile ? (
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg">
                    <Image className="w-4 h-4 text-green-400" />
                    <span className="text-slate-300 text-sm">{broadcastImageFile.name}</span>
                    <button onClick={() => setBroadcastImageFile(null)} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input 
                      type="file" 
                      ref={broadcastImageRef} 
                      onChange={(e) => setBroadcastImageFile(e.target.files[0])} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => broadcastImageRef.current?.click()}
                      className="border-slate-600 text-slate-300"
                    >
                      <Upload className="w-4 h-4 mr-2" />Dodaj sliku
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Video Upload */}
            <div>
              <Label className="text-slate-300 flex items-center gap-2">
                <Video className="w-4 h-4" />Video (opcionalno)
              </Label>
              <div className="flex items-center gap-3 mt-2">
                {broadcastVideoFile ? (
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg">
                    <Video className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-300 text-sm">{broadcastVideoFile.name}</span>
                    <button onClick={() => setBroadcastVideoFile(null)} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input 
                      type="file" 
                      ref={broadcastVideoRef} 
                      onChange={(e) => setBroadcastVideoFile(e.target.files[0])} 
                      accept="video/*" 
                      className="hidden" 
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => broadcastVideoRef.current?.click()}
                      className="border-slate-600 text-slate-300"
                    >
                      <Upload className="w-4 h-4 mr-2" />Dodaj video
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowBroadcastDialog(false)} className="flex-1 border-slate-600 text-slate-300">Odustani</Button>
              <Button onClick={sendBroadcast} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900">
                <Megaphone className="w-4 h-4 mr-2" />Pošalji svima
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Profil korisnika</DialogTitle>
          </DialogHeader>
          {viewingProfile && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden">
                  {viewingProfile.profile_photo ? (
                    <img src={viewingProfile.profile_photo} alt={viewingProfile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0056D2] to-[#FF9F1C] flex items-center justify-center text-white text-2xl font-bold">
                      {viewingProfile.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{viewingProfile.name}</h3>
                  <p className="text-slate-400">{viewingProfile.email}</p>
                  <p className="text-slate-400">{viewingProfile.city} • {viewingProfile.age} god.</p>
                </div>
              </div>
              {viewingProfile.bio && <div className="bg-slate-900 rounded-lg p-4"><p className="text-white">{viewingProfile.bio}</p></div>}
              {viewingProfile.gallery?.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-2">Galerija</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingProfile.gallery.map((p) => (
                      <img key={p.id} src={p.url} alt="" className="w-full h-24 object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User Management Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Upravljanje: {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => updateUserStatus(selectedUser.id, "active")} className={selectedUser.status === "active" ? "bg-green-600" : "bg-slate-700"}>Aktivan</Button>
                <Button onClick={() => updateUserStatus(selectedUser.id, "paused")} className={selectedUser.status === "paused" ? "bg-amber-600" : "bg-slate-700"}>Pauza</Button>
                <Button onClick={() => updateUserStatus(selectedUser.id, "blocked")} className={selectedUser.status === "blocked" ? "bg-red-600" : "bg-slate-700"}>Blokiran</Button>
              </div>
              <Button onClick={() => deleteUser(selectedUser.id)} variant="destructive" className="w-full"><Trash2 className="w-4 h-4 mr-2" />Obriši</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Points Dialog */}
      <Dialog open={showAddPointsDialog} onOpenChange={setShowAddPointsDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Dodaj bodove: {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="number" value={pointsToAdd} onChange={(e) => setPointsToAdd(e.target.value)} placeholder="Broj bodova" className="bg-slate-900 border-slate-700 text-white" />
            <Button onClick={addPointsToUser} disabled={!pointsToAdd} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900">
              <Plus className="w-4 h-4 mr-2" />Dodaj
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
