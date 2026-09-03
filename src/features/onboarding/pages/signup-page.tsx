import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerMandalAndAdmin } from "../services/onboarding.service";

export function SignupPage() {
  const [mandalName, setMandalName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mandalName.trim().length < 3) {
      setError("Mandal / Trust name must be at least 3 characters");
      return;
    }

    if (adminName.trim().length < 2) {
      setError("Secretary / Admin name must be at least 2 characters");
      return;
    }

    if (!/^\d{10}$/.test(mobile.trim())) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }

    if (!/^\d{4}$/.test(pin.trim())) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    setLoading(true);
    try {
      await registerMandalAndAdmin({
        mandalName,
        adminName,
        mobile,
        pin,
      });

      // Redirect to dashboard
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-festival-glow text-white overflow-hidden p-4 sm:p-6 select-none">
      {/* Background Decorative Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg
          className="absolute -top-20 -left-20 w-96 h-96 text-orange-500/10"
          fill="none"
          viewBox="0 0 400 400"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" />
          <circle cx="200" cy="200" r="130" stroke="currentColor" strokeWidth="1" />
        </svg>

        <svg
          className="absolute -bottom-24 -right-24 w-96 h-96 text-amber-500/10"
          fill="none"
          viewBox="0 0 400 400"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="200" cy="200" r="160" stroke="currentColor" strokeWidth="1" />
          <circle cx="200" cy="200" r="100" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
      </div>

      {/* Top Bar */}
      <header className="relative z-10 mx-auto w-full max-w-lg pt-4 text-center">
        <Link to="/" className="inline-flex items-baseline justify-center gap-1.5 hover:opacity-90 transition-opacity">
          <span className="font-brand-marathi text-3xl sm:text-4xl font-black tracking-tight text-white">
            वर्गणी
          </span>
          <span className="font-brand-pro text-2xl sm:text-3xl font-black text-amber-400 tracking-wider uppercase">
            PRO
          </span>
        </Link>
      </header>

      {/* Main Center Content: Signup Card */}
      <main className="relative z-10 mx-auto w-full max-w-lg my-auto py-6">
        <div className="bg-white/95 text-slate-900 rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 backdrop-blur-md">
          <div className="mb-5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Register Your Mandal
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              नवीन मंडळ नोंदणी करा आणि ३० सेकंदात डिजिटल पावती सुरू करा
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold flex items-center gap-2 animate-in fade-in">
              <span className="text-sm">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="mandalName" className="text-xs font-bold text-slate-700">
                Mandal / Sanstha Name * <span className="text-slate-400 font-normal">· मंडळाचे नाव</span>
              </Label>
              <Input
                id="mandalName"
                placeholder="उदा. श्री शिव समर्थ गणेशोत्सव मंडळ"
                value={mandalName}
                onChange={(e) => setMandalName(e.target.value)}
                className="mt-1 h-11 text-sm text-slate-900 font-medium rounded-xl border-slate-300 focus-visible:ring-amber-500"
                required
              />
            </div>

            <div>
              <Label htmlFor="adminName" className="text-xs font-bold text-slate-700">
                Secretary / Admin Full Name * <span className="text-slate-400 font-normal">· सेक्रेटरीचे पूर्ण नाव</span>
              </Label>
              <Input
                id="adminName"
                placeholder="उदा. राहुल प्रकाश कदम"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="mt-1 h-11 text-sm text-slate-900 font-medium rounded-xl border-slate-300 focus-visible:ring-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mobile" className="text-xs font-bold text-slate-700">
                  Mobile Number * <span className="text-slate-400 font-normal">· मोबाईल नंबर</span>
                </Label>
                <Input
                  id="mobile"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="mt-1 h-11 text-sm text-slate-900 font-medium rounded-xl border-slate-300 focus-visible:ring-amber-500"
                  required
                />
              </div>

              <div>
                <Label htmlFor="pin" className="text-xs font-bold text-slate-700">
                  4-Digit Admin PIN * <span className="text-slate-400 font-normal">· ४ अंकी पिन</span>
                </Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="mt-1 h-11 text-lg font-mono tracking-widest text-center text-slate-900 rounded-xl border-slate-300 focus-visible:ring-amber-500"
                  required
                />
              </div>
            </div>

            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
              <p className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>📋</span>
                <span>नोंदणीनंतर काय होईल (What happens after signup):</span>
              </p>
              <p className="text-[11px] text-amber-900/90 pl-5">✓ तुमचे मंडळ आणि सेक्रेटरी खाते तयार होईल</p>
              <p className="text-[11px] text-amber-900/90 pl-5">✓ पहिला उत्सव <strong>Ganesh Utsav 2026</strong> आपोआप सक्रिय होईल</p>
              <p className="text-[11px] text-amber-900/90 pl-5">✓ तुम्ही लगेच स्वयंसेवक जोडून वर्गणी सुरू करू शकता</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
            >
              {loading ? "मंडळ तयार होत आहे..." : "Create Mandal & Get Started 🚀"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200/80 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link to="/" className="text-orange-600 font-bold hover:underline inline-block ml-1">
                Sign in with PIN →
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-lg pb-2 text-center">
        <p className="text-[11px] text-slate-400/80">
          VarganiPro · For Mandals. By Volunteers. For Our Festivals.
        </p>
      </footer>
    </div>
  );
}
