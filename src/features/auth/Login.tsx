import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Layers, Lock, Mail } from 'lucide-react';
import { auth, isFirebaseConfigured } from '@/services/firebase';

interface LoginProps {
  onLoginSuccess?: (email: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setError(null);

    if (!isFirebaseConfigured) {
      setError('إعدادات Firebase غير مكتملة. أضف بيانات المشروع في ملف .env ثم أعد تشغيل التطبيق.');
      return;
    }

    try {
      setLoading(true);
      await auth.signInWithEmailAndPassword(email.trim(), password);
      onLoginSuccess?.(email.trim());
    } catch (err: any) {
      const code = String(err?.code || '');
      let message = 'فشل تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.';

      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-email'
      ) {
        message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (code === 'auth/user-disabled') {
        message = 'هذا الحساب معطّل. راجع مدير النظام.';
      } else if (code === 'auth/too-many-requests') {
        message = 'تم إيقاف المحاولات مؤقتًا بسبب كثرة المحاولات. حاول لاحقًا.';
      } else if (code === 'auth/network-request-failed') {
        message = 'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.';
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="app-viewport app-safe-screen flex w-full items-center justify-center bg-slate-100/70 p-4 text-slate-900 transition-colors dark:bg-neutral-950 dark:text-slate-100 sm:p-6"
      dir="rtl"
    >
      <div className="relative z-10 my-auto w-full max-w-md animate-fade-in">
        <div className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/40 transition-all dark:border-white/[0.07] dark:bg-neutral-900 dark:shadow-none sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-slate-900 dark:bg-white/15" />

          <div className="mb-7 text-center">
            <div className="mb-3.5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-xs dark:border-white/[0.08] dark:bg-neutral-800">
              <Layers className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">إدارة مخزون</h1>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              سجل الدخول بحسابك للوصول إلى المخزون
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">البريد الإلكتروني</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 dark:text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-3.5 pr-10 text-xs font-medium text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:border-white/[0.08] dark:bg-neutral-800 dark:text-white sm:py-3 sm:text-sm"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">كلمة المرور</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 dark:text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-11 pr-10 text-xs font-medium text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:border-white/[0.08] dark:bg-neutral-800 dark:text-white sm:py-3 sm:text-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isFirebaseConfigured}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 sm:py-3.5 sm:text-sm"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
