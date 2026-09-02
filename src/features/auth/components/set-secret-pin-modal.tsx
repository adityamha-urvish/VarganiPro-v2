import { useState } from "react";
import { supabase } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SetSecretPinModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export function SetSecretPinModal({
  isOpen,
  onSuccess,
}: SetSecretPinModalProps) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(oldPin.trim())) {
      setError("Temporary PIN must be 4 digits");
      return;
    }

    if (!/^\d{4}$/.test(newPin.trim())) {
      setError("New PIN must be 4 digits");
      return;
    }

    if (newPin !== confirmPin) {
      setError("New PIN and Confirm PIN do not match");
      return;
    }

    if (newPin === oldPin) {
      setError("New PIN must be different from your temporary PIN");
      return;
    }

    setLoading(true);
    try {
      const { error: rpcErr } = await supabase.rpc("change_self_pin", {
        p_old_pin: oldPin.trim(),
        p_new_pin: newPin.trim(),
      });

      if (rpcErr) {
        throw new Error(rpcErr.message || "Failed to set PIN");
      }

      // Update local storage user profile
      const storedUser = localStorage.getItem("vp_user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          parsed.must_change_pin = false;
          localStorage.setItem("vp_user", JSON.stringify(parsed));
        } catch {
          // ignore
        }
      }

      onSuccess();
    } catch (err: unknown) {
      console.error("PIN change error:", err);
      setError(err instanceof Error ? err.message : "Failed to change PIN");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-amber-500 bg-white">
        <CardHeader className="text-center pb-2">
          <div className="text-4xl mb-1">🔐</div>
          <CardTitle className="text-xl font-black text-slate-900">
            Set Your Secret PIN
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            This is your first login with a temporary PIN. Please choose a private 4-digit PIN for future logins.
          </p>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <Label htmlFor="oldPin" className="text-xs font-bold text-slate-700">
                Current Temporary PIN
              </Label>
              <Input
                id="oldPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                className="mt-1 font-mono tracking-widest text-center"
                required
              />
            </div>

            <div>
              <Label htmlFor="newPin" className="text-xs font-bold text-slate-700">
                New 4-Digit Secret PIN
              </Label>
              <Input
                id="newPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="mt-1 font-mono tracking-widest text-center"
                required
              />
            </div>

            <div>
              <Label htmlFor="confirmPin" className="text-xs font-bold text-slate-700">
                Confirm New PIN
              </Label>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="mt-1 font-mono tracking-widest text-center"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {loading ? "Updating PIN..." : "Save PIN & Continue ⚡"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
