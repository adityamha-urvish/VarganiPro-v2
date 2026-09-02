import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VolunteerCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  volunteerName: string;
  mobile: string;
  isNewUser: boolean;
  temporaryPin: string | null;
  isReset?: boolean;
}

export function VolunteerCredentialModal({
  isOpen,
  onClose,
  volunteerName,
  mobile,
  isNewUser,
  temporaryPin,
  isReset = false,
}: VolunteerCredentialModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareText = temporaryPin
    ? `🛕 *VarganiPro Login Credentials*\n\nNamaskar ${volunteerName},\nYou have been registered as a collection volunteer.\n\n📱 *Mobile:* ${mobile}\n🔐 *Temporary PIN:* ${temporaryPin}\n\n👉 Login at: ${window.location.origin}\n*(You will be asked to set your own private PIN on first login)*`
    : `🛕 *VarganiPro Collection Access*\n\nNamaskar ${volunteerName},\nYou have been added as a collection volunteer.\n\n📱 *Mobile:* ${mobile}\n🔐 Use your existing 4-digit VarganiPro PIN to log in.\n\n👉 Login at: ${window.location.origin}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://wa.me/91${mobile}?text=${encoded}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-emerald-500 bg-white">
        <CardHeader className="text-center pb-2">
          <div className="text-4xl mb-1">{temporaryPin ? "🎉" : "🤝"}</div>
          <CardTitle className="text-xl font-black text-slate-900">
            {isReset
              ? "Volunteer PIN Reset"
              : isNewUser
              ? "Volunteer Provisioned!"
              : "Existing Volunteer Linked!"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isReset
              ? "A new temporary PIN has been generated"
              : isNewUser
              ? "One-time credential setup for new volunteer"
              : "Volunteer profile linked to your Mandal"}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-semibold">Volunteer:</span>
              <span className="font-bold text-slate-900">{volunteerName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-semibold">Mobile:</span>
              <span className="font-bold font-mono text-slate-900">{mobile}</span>
            </div>

            {temporaryPin ? (
              <div className="pt-2 border-t flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                    Temporary 4-Digit PIN:
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-700 tracking-widest">
                    {temporaryPin}
                  </span>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold">
                  One-Time View
                </span>
              </div>
            ) : (
              <div className="pt-2 border-t">
                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-2.5 rounded-lg text-xs font-medium">
                  ℹ️ <strong>Already Registered:</strong> This mobile number is already active in VarganiPro. The volunteer can sign in directly using their existing secret PIN.
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              onClick={handleWhatsApp}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>💬</span> Send Details on WhatsApp
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="w-full py-2 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📋</span> {copied ? "Copied to Clipboard! ✓" : "Copy Login Instructions"}
            </Button>
          </div>

          <div className="pt-2 border-t text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Done / Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
