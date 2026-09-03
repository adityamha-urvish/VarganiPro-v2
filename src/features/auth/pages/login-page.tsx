import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useLogin } from '../hooks/use-login';
import { login } from '../services/auth.service';
import { BrandMonogram } from '@/components/brand/brand-monogram';
import { BrandWordmark } from '@/components/brand/brand-wordmark';
import { FestivalBackground, type FestivalType } from '@/components/brand/festival-background';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const rawFestival = searchParams.get('festival');
  const festival: FestivalType =
    rawFestival === 'ganpati' || rawFestival === 'navratri' ? rawFestival : 'other';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useLogin();

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const onSubmit = async (data: {
    mobile: string;
    pin: string;
  }) => {
    setLoginError(null);
    setLoading(true);
    try {
      const user = await login(data);

      localStorage.setItem(
        'vp_user',
        JSON.stringify(user)
      );

      window.location.href = '/dashboard';
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? err.message
          : 'Login failed. Please check your mobile and PIN.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-fest-teal-foundation text-slate-100 overflow-x-hidden select-none p-4 sm:p-6 lg:p-12">
      {/* Dynamic Festival Background (Siddhivinayak Ganpati / Navratri Devi / Neutral) */}
      <FestivalBackground festival={festival} />

      {/* Top Desktop Navigation Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto hidden lg:flex items-center justify-between shrink-0 pb-4">
        <div className="flex items-center gap-3">
          <BrandMonogram variant="golden-arch" size="md" />
          <BrandWordmark size="md" />
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {rawFestival === 'ganpati' && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-xs font-mono font-bold text-amber-300">
              <span>🛕 Ganesh Utsav</span>
            </div>
          )}
          {rawFestival === 'navratri' && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-xs font-mono font-bold text-amber-300">
              <span>🌸 Navratri Utsav</span>
            </div>
          )}
          {rawFestival === 'other' && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-xs font-mono font-bold text-amber-300">
              <span>🏮 Community Mandal</span>
            </div>
          )}
          <span className="text-xs font-bold text-slate-400">English • मराठी</span>
        </div>
      </header>

      {/* Main Content Area: Responsive Asymmetrical Split on Desktop, Intentional Stack on Mobile */}
      <main className="relative z-10 w-full max-w-7xl mx-auto my-auto py-2 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
        {/* Left Editorial Narrative Section */}
        <div className="lg:col-span-7 space-y-3 sm:space-y-5 text-center lg:text-left">
          {/* Top Feature Pill: Distinct non-duplicated value proposition */}
          <div className="inline-flex items-center gap-2 px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-[11px] sm:text-xs font-bold text-amber-300">
            <span>✨</span>
            <span>Next-Gen Mandal Collection &amp; Digital Pavti</span>
          </div>

          {/* Hero Brand Identity */}
          <div className="space-y-1 sm:space-y-2">
            <div className="flex justify-center lg:justify-start">
              <BrandWordmark size="hero" />
            </div>

            <h2 className="text-lg sm:text-2xl font-black text-slate-100 tracking-tight pt-0.5 sm:pt-1">
              For Mandals. By Volunteers. For Our Festivals.
            </h2>
            <p className="font-marathi-bold text-xs sm:text-base text-amber-300/90 font-semibold">
              मंडळांसाठी. स्वयंसेवकांसाठी. आपल्या उत्सवांसाठी.
            </p>
          </div>

          {/* Value Narrative (Desktop Only for Height Optimization on Mobile) */}
          <p className="hidden lg:block text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
            A modern digital platform purpose-built for Ganesh &amp; Navratri Mandals. Fast door-to-door receipt generation in 3 seconds, instant WhatsApp Pāvtī image sharing, and reliable offline volunteer sync.
          </p>

          {/* Concise Value Blocks */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 max-w-md sm:max-w-xl mx-auto lg:mx-0 pt-1 sm:pt-2 text-left">
            <div className="bg-slate-900/80 border border-white/15 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 backdrop-blur-sm flex items-center sm:items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm sm:text-lg shrink-0 font-black">
                ⚡
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-black text-white block">Fast Collect</span>
                <span className="text-[9px] sm:text-[11px] font-marathi-bold text-amber-300/90 font-semibold block">
                  ३ सेकंदात पावती
                </span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-white/15 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 backdrop-blur-sm flex items-center sm:items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-sm sm:text-lg shrink-0 font-black">
                📶
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-black text-white block">Offline Sync</span>
                <span className="text-[9px] sm:text-[11px] font-marathi-bold text-teal-300/90 font-semibold block">
                  स्थानिक साठवण
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Floating Login Panel */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
          <div className="w-full max-w-md frosted-glass-teal rounded-2xl sm:rounded-[32px] p-5 sm:p-8 space-y-4 sm:space-y-5 text-slate-100">
            {/* Panel Header */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                  Sign In • लॉगिन करा
                </h3>
                <span className="text-[10px] sm:text-xs font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 sm:px-2.5 py-0.5 rounded-full">
                  Volunteer &amp; Admin
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium">
                Enter your registered mobile number and 4-digit PIN
              </p>
            </div>

            {/* Error Banner */}
            {loginError && (
              <div
                role="alert"
                className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in"
              >
                <span className="text-base shrink-0">⚠️</span>
                <span>{loginError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 sm:space-y-4">
              <div>
                <Label htmlFor="mobile" className="text-xs font-bold text-slate-300 flex items-center justify-between mb-1 sm:mb-1.5">
                  <span>Mobile Number</span>
                  <span className="text-slate-400 font-medium font-marathi-bold">मोबाईल नंबर</span>
                </Label>

                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 sm:top-3 text-slate-400 text-sm font-bold">+91</span>
                  <Input
                    id="mobile"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    className="w-full bg-slate-950/70 border-white/20 focus-visible:border-amber-400 focus-visible:ring-amber-400/30 rounded-xl sm:rounded-2xl pl-12 pr-4 h-10 sm:h-11 text-sm font-bold text-white shadow-inner"
                    {...register('mobile')}
                  />
                </div>

                {errors.mobile && (
                  <p className="mt-1 text-xs text-red-400 font-medium">
                    {errors.mobile.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="pin" className="text-xs font-bold text-slate-300 flex items-center justify-between mb-1 sm:mb-1.5">
                  <span>4-Digit Secret PIN</span>
                  <span className="text-slate-400 font-medium font-marathi-bold">४ अंकी पिन</span>
                </Label>

                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  className="w-full bg-slate-950/70 border-white/20 focus-visible:border-amber-400 focus-visible:ring-amber-400/30 rounded-xl sm:rounded-2xl px-4 h-10 sm:h-11 text-base font-bold text-center tracking-widest text-white shadow-inner font-mono"
                  {...register('pin')}
                />

                {errors.pin && (
                  <p className="mt-1 text-xs text-red-400 font-medium">
                    {errors.pin.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-fest-gold text-white font-black h-11 sm:h-12 rounded-xl sm:rounded-2xl text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
              >
                {loading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In • लॉगिन करा</span>
                    <span className="text-base leading-none">⚡</span>
                  </>
                )}
              </Button>
            </form>

            {/* New Mandal Registration Link */}
            <div className="pt-2.5 sm:pt-3 border-t border-white/10 text-center space-y-1.5 sm:space-y-2">
              <p className="text-xs text-slate-300">
                <span>New Mandal or Trust? </span>
                <a
                  href="/signup"
                  className="font-bold text-amber-400 hover:text-amber-300 hover:underline inline-block transition-colors"
                >
                  Register Your Mandal Free →
                </a>
              </p>
              <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                <span>🔒 256-bit Encrypted</span>
                <span>•</span>
                <span>Built for Maharashtra Trusts</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 w-full text-center text-[11px] sm:text-xs text-slate-400 font-medium shrink-0 pt-2 sm:pt-4">
        <p>Secure • Trusted • Built for Ganpati &amp; Navratri Mandals across Maharashtra</p>
      </footer>
    </div>
  );
}
