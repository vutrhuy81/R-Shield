import React, { useState } from 'react';
import { User, Language } from '../types';
import { translations } from '../translations';
import { ShieldCheck, Lock, User as UserIcon, AlertCircle, Globe } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
  lang: Language;
  onToggleLang: () => void;
}

const TOKEN_STORAGE_KEY = 'rshield_token';
const USER_STORAGE_KEY = 'rshield_user';

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, lang, onToggleLang }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) return;

    setIsLoading(true);
    setError('');
    setRetryAfter(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const retryHeader = Number(res.headers.get('Retry-After'));
        const retryValue = Number(data.retryAfter || retryHeader || 0);

        if (res.status === 429) {
          setRetryAfter(retryValue || null);
          throw new Error(data.message || 'Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.');
        }

        if (res.status === 423) {
          setRetryAfter(retryValue || null);
          throw new Error(data.message || 'Tài khoản đang bị khóa tạm do đăng nhập sai nhiều lần.');
        }

        throw new Error(data.message || t.loginError);
      }

      if (!data.token) {
        throw new Error('API đăng nhập không trả về token xác thực.');
      }

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({ id: data.id, username: data.username, role: data.role, email: data.email }),
      );

      // Ép kiểu vì type User hiện tại có thể chưa khai báo token/id.
      onLogin({ id: data.id, username: data.username, role: data.role, email: data.email, token: data.token } as User);
    } catch (err: any) {
      setError(err.message || t.loginError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <button
          onClick={onToggleLang}
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
        >
          <Globe size={16} />
          {lang.toUpperCase()}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg">
            <ShieldCheck size={40} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">{t.loginTitle}</h2>
        <p className="mt-2 text-center text-sm text-gray-600">{t.loginSub}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                <span>
                  {error}
                  {retryAfter ? ` (${retryAfter}s)` : ''}
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">{t.username}</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  disabled={isLoading}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  placeholder={lang === 'vi' ? 'Nhập username' : 'Enter username'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t.password}</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                  placeholder="••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Đang kiểm tra...' : t.loginBtn}
            </button>
          </form>
          <div className="mt-6 pt-6 border-t border-gray-100 text-xs text-gray-400 text-center">
            {t.defaultPass}
          </div>
          <div className="mt-3 text-[11px] text-gray-400 text-center leading-relaxed">
            Lưu ý: giới hạn đăng nhập và khóa tạm tài khoản được xử lý ở API server, không chỉ trên giao diện.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
