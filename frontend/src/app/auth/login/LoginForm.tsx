'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDefaultRouteByRole } from '@/config/routes';

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isPending) return;

    setError('');
    setIsPending(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Giriş başarısız');
        setIsPending(false);
        return;
      }

      if (result.user) {
        const redirectUrl = callbackUrl || getDefaultRouteByRole(result.user.role);
        await new Promise((resolve) => setTimeout(resolve, 100));
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">E-posta Adresi</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="block w-full pl-10 pr-3 py-2.5 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-muted/20 text-foreground disabled:opacity-50"
            placeholder="admin@example.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Şifre</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            className="block w-full pl-10 pr-3 py-2.5 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-muted/20 text-foreground disabled:opacity-50"
            placeholder="••••••••"
          />
        </div>
      </div>

     
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !email || !password}
        className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform active:scale-[0.98] shadow-md flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          'Giriş Yap'
        )}
      </button>
    </form>
  );
}
