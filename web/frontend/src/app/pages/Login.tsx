import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.fullName}!`);
      
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <Card className="w-full max-w-md p-8 backdrop-blur-sm bg-white/90 shadow-2xl relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-600 shadow-lg mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-2">
            Risk Radar
          </h1>
          <p className="text-gray-600">
            {language === 'en' ? 'See the risk. Avoid the danger. Stay ahead.' : 'ঝুঁকি দেখুন। বিপদ এড়িয়ে চলুন। এগিয়ে থাকুন।'}
          </p>
        </div>

        {/* Language Toggle */}
        <div className="flex justify-end mb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="text-xs"
          >
            {language === 'en' ? '🇧🇩 বাংলা' : '🇬🇧 English'}
          </Button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              {language === 'en' ? 'Email Address' : 'ইমেইল ঠিকানা'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={language === 'en' ? 'Enter your email' : 'আপনার ইমেইল লিখুন'}
                className="pl-10 h-12"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              {language === 'en' ? 'Password' : 'পাসওয়ার্ড'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === 'en' ? 'Enter your password' : 'আপনার পাসওয়ার্ড লিখুন'}
                className="pl-10 pr-10 h-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold"
          >
            {t('login')}
          </Button>
        </form>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            {language === 'en' ? '🎯 Demo Credentials:' : '🎯 ডেমো লগইন তথ্য:'}
          </p>
          <div className="text-xs text-blue-700 space-y-1">
            <p><strong>Admin:</strong> admin@riskradar.bd / admin123</p>
            <p><strong>User:</strong> user@riskradar.bd / user123</p>
            <p><strong>Police:</strong> police@riskradar.bd / police123</p>
          </div>
        </div>

        {/* Signup Link */}
        <p className="text-center mt-6 text-gray-600">
          {language === 'en' ? "Don't have an account? " : 'একাউন্ট নেই? '}
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="text-red-600 hover:text-red-700 font-semibold"
          >
            {t('signup')}
          </button>
        </p>
      </Card>
    </div>
  );
}