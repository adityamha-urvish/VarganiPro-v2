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
    <div className="relative min-h-screen flex flex-col justify-between bg-fest-teal-foundation text-slate-100 overflow-x-hidden select-none p-4 sm:p-6 lg:p-10">
      {/* Canonical Visual World Artwork Background (Master landscape on desktop, Mobile crop on mobile) */}
      <FestivalBackground festival={festival} />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto flex items-center justify-between shrink-0 pb-2 sm:pb-3">
        {/* Upper-Left Brand Signature (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center gap-2.5">
          <BrandMonogram variant="golden-arch" size="sm" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-marathi-bold font-black text-white text-lg leading-none tracking-tight">
              वर्गणी
            </span>
            <span className="font-pro-luxe font-black text-amber-400 text-xs leading-none tracking-wider uppercase">
              PRO
            </span>
          </div>
        </div>
        <div className="sm:hidden" />

        {/* Upper-Right Controls (Festival Context Badge + Understated Language Indicator) */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {rawFestival === 'ganpati' && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-[11px] sm:text-xs font-mono font-bold text-amber-300">
              <span>🛕 Ganesh Utsav</span>
            </div>
          )}
          {rawFestival === 'navratri' && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-[11px] sm:text-xs font-mono font-bold text-amber-300">
              <span>🌸 Navratri Utsav</span>
            </div>
          )}
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-300/80 bg-black/30 border border-white/10 px-2 sm:px-2.5 py-0.5 rounded-full backdrop-blur-sm">
            English • मराठी
          </span>
        </div>
      </header>

      {/* Main Content Area: Responsive Asymmetrical Split on Desktop, Intentional Stack on Mobile */}
      <main className="relative z-10 w-full max-w-7xl mx-auto my-auto py-1 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10 items-center">
        {/* Left Hero Narrative Section */}
        <div className="lg:col-span-7 space-y-2.5 sm:space-y-4 text-center lg:text-left">
          {/* Top Feature Pill */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-400/10 border border-amber-400/25 text-[10px] sm:text-xs font-bold text-amber-300">
            <span>✨</span>
            <span>Next-Gen Mandal Collection &amp; Digital Pavti</span>
          </div>

          {/* Hero Brand Identity */}
          <div className="space-y-0.5 sm:space-y-1.5">
            <div className="flex justify-center lg:justify-start">
              <BrandWordmark size="hero" />
            </div>

            <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-100 tracking-tight pt-0.5 sm:pt-1">
              For Mandals. By Volunteers. For Our Festivals.
            </h2>
            <p className="font-marathi-bold text-xs sm:text-base text-amber-300/90 font-bold">
              मंडळांसाठी. स्वयंसेवकांसाठी. आपल्या उत्सवांसाठी.
            </p>
          </div>

          {/* Supporting Feature Chips: Exactly TWO quiet supporting chips (Desktop only to keep mobile breathable) */}
          <div className="hidden lg:flex flex-wrap items-center justify-start gap-2.5 pt-1 sm:pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#091820]/75 border border-white/10 backdrop-blur-md">
              <span className="text-amber-400 text-xs font-black">⚡</span>
              <span className="text-xs font-bold text-slate-200">Fast Collection</span>
              <span className="text-[11px] font-marathi-bold text-amber-300/80">· जलद collection</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#091820]/75 border border-white/10 backdrop-blur-md">
              <span className="text-teal-400 text-xs font-black">📶</span>
              <span className="text-xs font-bold text-slate-200">Offline First</span>
              <span className="text-[11px] font-marathi-bold text-teal-300/80">· इंटरनेटशिवाय काम</span>
            </div>
          </div>
        </div>

        {/* Right Floating Compact Frosted Dark Login Panel */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
          <div className="w-full max-w-[395px] frosted-glass-teal rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-3.5 sm:space-y-4 text-slate-100">
            {/* Panel Header */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Sign In • लॉगिन करा
                </h3>
                <span className="text-[10px] sm:text-xs font-bold text-amber-300/90 bg-amber-400/10 border border-amber-400/25 px-2.5 py-0.5 rounded-full">
                  Volunteer &amp; Admin
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 font-medium">
                Enter registered mobile number &amp; 4-digit PIN
              </p>
            </div>

            {/* Error Banner */}
            {loginError && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in"
              >
                <span className="text-base shrink-0">⚠️</span>
                <span>{loginError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-3.5">
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
                    className="w-full bg-[#040c10]/80 border-white/15 focus-visible:border-amber-400/80 focus-visible:ring-amber-400/20 rounded-xl pl-12 pr-4 h-10 sm:h-11 text-sm font-bold text-white shadow-inner"
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
                  className="w-full bg-[#040c10]/80 border-white/15 focus-visible:border-amber-400/80 focus-visible:ring-amber-400/20 rounded-xl px-4 h-10 sm:h-11 text-base font-bold text-center tracking-widest text-white shadow-inner font-mono"
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
                className="w-full btn-fest-gold text-white font-black h-11 sm:h-11 rounded-xl text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
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
            <div className="pt-2 border-t border-white/10 text-center space-y-1.5">
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
      <footer className="relative z-20 w-full text-center text-[11px] sm:text-xs text-slate-400 font-medium shrink-0 pt-2 pb-1">
        <p>Secure • Trusted • Built for Ganpati &amp; Navratri Mandals across Maharashtra</p>
      </footer>
    </div>
  );
}
