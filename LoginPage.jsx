import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, useLanguage, API } from "../App";
import axios from "axios";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import LanguageSelector from "../components/LanguageSelector";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, settings } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, form);
      login(res.data.token, res.data.user);
      toast.success(t('success'));
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const loginBgUrl = settings.login_bg_url || "https://images.unsplash.com/photo-1607030698714-2dc69ead9bf7?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center justify-between mb-12">
            <Link to="/" className="flex items-center gap-3">
              <img src={settings.logo_url} alt="SIGMAT SMS Logo" className="h-12 w-12 object-contain" />
              <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>SIGMAT</span>
            </Link>
            <LanguageSelector />
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('welcomeBack')}
          </h1>
          <p className="text-slate-600 mb-8">{t('login')}</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">{t('email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input id="email" type="email" placeholder={t('email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="pl-10 h-12 rounded-xl" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">{t('password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input id="password" type={showPassword ? "text" : "password"} placeholder={t('password')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pl-10 pr-10 h-12 rounded-xl" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 bg-[#0056D2] hover:bg-[#0044A6] text-white rounded-xl font-semibold text-lg">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('loginBtn')}
            </Button>
          </form>

          <p className="text-center mt-8 text-slate-600">
            {t('noAccount')} <Link to="/register" className="text-[#0056D2] font-semibold hover:underline">{t('register')}</Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block flex-1 relative">
        <img src={loginBgUrl} alt="Couple" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
      </div>
    </div>
  );
};

export default LoginPage;
