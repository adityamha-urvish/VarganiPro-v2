import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

      // Redirect to dashboard with setup guide
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center pb-3">
          <div className="text-5xl mb-1">🛕</div>
          <CardTitle className="text-2xl font-black text-slate-900">
            Register Your Mandal
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Setup your Mandal in 30 seconds & start fast Vargani collection
          </p>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="mandalName" className="text-xs font-bold text-slate-700">
                Mandal / Sanstha Name *
              </Label>
              <Input
                id="mandalName"
                placeholder="e.g. Shivam Ganesh Utsav Mandal"
                value={mandalName}
                onChange={(e) => setMandalName(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="adminName" className="text-xs font-bold text-slate-700">
                Secretary / Admin Full Name *
              </Label>
              <Input
                id="adminName"
                placeholder="e.g. Sunil Patil"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mobile" className="text-xs font-bold text-slate-700">
                  Mobile Number *
                </Label>
                <Input
                  id="mobile"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="pin" className="text-xs font-bold text-slate-700">
                  4-Digit Admin PIN *
                </Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="mt-1 font-mono tracking-widest text-center"
                  required
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">📋 What happens after signup:</p>
              <p>✓ Your Mandal &amp; Admin account are created atomically</p>
              <p>✓ First festival event <strong>Ganesh Utsav 2026</strong> is ready</p>
              <p>✓ You can immediately add volunteers and start collection</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-bold shadow-md cursor-pointer"
            >
              {loading ? "Creating Mandal..." : "Create Mandal & Get Started 🚀"}
            </Button>
          </form>

          <div className="mt-4 pt-3 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/" className="text-primary font-bold hover:underline">
                Sign in with PIN
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
