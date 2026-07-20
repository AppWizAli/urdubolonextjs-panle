'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, apiError, getCurrentUser } from '@/lib/api';

const schema = z.object({ email: z.string().email('Enter a valid email address'), password: z.string().min(12, 'Password must be at least 12 characters') });
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    // Never keep credentials in the address bar or browser history.
    if (window.location.search) window.history.replaceState({}, document.title, '/login');
  }, []);

  async function onSubmit(values: Values) {
    setError('');
    try {
      const { data } = await api.post('/auth/login', values);
      window.localStorage.setItem('urdubolo_access_token', data.accessToken);
      window.localStorage.setItem('urdubolo_refresh_token', data.refreshToken);
      const user = await getCurrentUser();
      window.localStorage.setItem('urdubolo_user', JSON.stringify(user));
      router.replace('/');
    } catch (cause) { setError(apiError(cause)); }
  }
  return <main className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_0.95fr]">
    <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between"><div><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center bg-brand text-lg font-black">UB</div><div><div className="font-bold">Urdu Bolo</div><div className="text-xs text-slate-400">Operations console</div></div></div><div className="mt-28 max-w-lg"><div className="eyebrow text-teal">Private administration</div><h1 className="mt-4 text-5xl font-bold leading-[1.08] tracking-tight">Run the library with confidence.</h1><p className="mt-6 max-w-md text-base leading-7 text-slate-300">Content, access, subscriptions, security, and releases in one calm workspace.</p></div></div><div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} className="text-teal" /> Secure NestJS API with role-based access</div></section>
    <section className="flex items-center justify-center p-6 md:p-12"><div className="w-full max-w-md"><div className="mb-10 lg:hidden"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center bg-brand text-sm font-black text-white">UB</div><div className="font-bold text-ink">Urdu Bolo</div></div></div><div className="eyebrow">Welcome back</div><h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">Sign in to continue</h2><p className="mt-3 text-sm leading-6 text-slate-500">Use your administrator account to access the control center.</p><form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Email address</span><input {...register('email')} className="input" placeholder="admin@example.com" autoComplete="email" />{errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}</label><label className="block"><span className="mb-2 block text-sm font-semibold">Password</span><div className="relative"><LockKeyhole className="absolute left-3 top-3 text-slate-400" size={16} /><input {...register('password')} className="input pl-9" type="password" placeholder="Your password" autoComplete="current-password" /></div>{errors.password && <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>}</label>{error && <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}<button disabled={isSubmitting} className="btn-primary h-11 w-full">{isSubmitting ? 'Signing in...' : 'Sign in'}<ArrowRight size={17} /></button></form></div></section>
  </main>;
}
