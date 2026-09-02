import { useState, useEffect, type FormEvent } from "react";
import type { PavtiTemplateConfig, FestivalType } from "../types/pavti.types";
import { loadPavtiConfig, savePavtiConfig } from "../services/pavti-config.service";
import { DigitalPavtiCard } from "./digital-pavti-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PavtiCustomizationPanelProps {
  organizationId?: string | null;
  defaultMandalName?: string | null;
  defaultEventName?: string | null;
  onConfigSaved?: (config: PavtiTemplateConfig) => void;
}

export function PavtiCustomizationPanel({
  organizationId,
  defaultMandalName,
  defaultEventName,
  onConfigSaved,
}: PavtiCustomizationPanelProps) {
  const [config, setConfig] = useState<PavtiTemplateConfig>(() =>
    loadPavtiConfig(organizationId, defaultMandalName, defaultEventName)
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const loaded = loadPavtiConfig(organizationId, defaultMandalName, defaultEventName);
    setConfig(loaded);
  }, [organizationId, defaultMandalName, defaultEventName]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    savePavtiConfig(config, organizationId);
    setSavedSuccess(true);
    onConfigSaved?.(config);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Sample mock receipt for live visual preview
  const sampleReceipt = {
    receiptNumber: 1042,
    receiptPrefix: "VP-",
    donorName: "श्री. राहुल शिंदे",
    amount: 501,
    paymentMode: "cash",
    paymentReference: null,
    createdAt: new Date().toISOString(),
    buildingName: "गोकुळ धाम",
    buildingWing: "A",
    unitNumber: "402",
    propertyType: "residential" as const,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 pb-4 border-b">
          <span className="text-3xl">🪔</span>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              पावती डिझाइन सेटअप (Receipt Design Setup)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize festival identity, Mandal title, and secretary signature for all digital Pāvtīs
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold flex items-center gap-2">
            <span>✓</span>
            <span>पावती सेटिंग्ज यशस्वीरित्या जतन केल्या आहेत (Pavti settings saved successfully).</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
          {/* -------------------------------------------------------------
              LEFT: SETUP FORM
          -------------------------------------------------------------- */}
          <form onSubmit={handleSave} className="lg:col-span-5 space-y-4">
            {/* 1. Festival Type Selector */}
            <div>
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                1. Festival Type / उत्सव प्रकार *
              </Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { id: "ganpati", label: "Ganpati", sub: "श्री गणेशाय नमः", icon: "🛕" },
                  { id: "navratri", label: "Navratri", sub: "जय माता दी", icon: "🌺" },
                  { id: "other", label: "Other", sub: "Neutral Theme", icon: "🏵️" },
                ].map((item) => {
                  const isSelected = config.festivalType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          festivalType: item.id as FestivalType,
                        }))
                      }
                      className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                          : "border-slate-200 bg-background text-muted-foreground hover:border-slate-300"
                      }`}
                    >
                      <div className="text-lg">{item.icon}</div>
                      <div className="text-xs font-bold mt-1">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {item.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Mandal Name */}
            <div>
              <Label htmlFor="mandalName" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                2. Mandal Name / मंडळाचे नाव *
              </Label>
              <Input
                id="mandalName"
                value={config.mandalName}
                onChange={(e) => setConfig((prev) => ({ ...prev, mandalName: e.target.value }))}
                placeholder="e.g. श्री गणेश मित्र मंडळ"
                className="mt-1 font-semibold"
                required
              />
            </div>

            {/* 3. Festival / Event Name */}
            <div>
              <Label htmlFor="eventName" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                3. Festival / Event Name / उत्सवाचे नाव
              </Label>
              <Input
                id="eventName"
                value={config.eventName}
                onChange={(e) => setConfig((prev) => ({ ...prev, eventName: e.target.value }))}
                placeholder="e.g. सार्वजनिक गणेशोत्सव २०२६"
                className="mt-1"
              />
            </div>

            {/* 4. Year / Anniversary (Optional) */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="yearText" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  4. Year / Anniversary / वर्ष (Optional)
                </Label>
                <span className="text-[11px] text-muted-foreground">उदा. 12 वा वर्ष</span>
              </div>
              <Input
                id="yearText"
                value={config.yearText || ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, yearText: e.target.value || null }))}
                placeholder="e.g. 12 वा वर्ष (Leave blank to hide)"
                className="mt-1"
              />
            </div>

            {/* 5. Secretary Name */}
            <div>
              <Label htmlFor="secretaryName" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                5. Secretary Name / अध्यक्ष किंवा खजिनदाराचे नाव
              </Label>
              <Input
                id="secretaryName"
                value={config.secretaryName || ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, secretaryName: e.target.value || null }))}
                placeholder="e.g. अक्षय जोशी"
                className="mt-1"
              />
            </div>

            <Button type="submit" className="w-full h-11 text-xs font-bold rounded-xl shadow-xs cursor-pointer">
              💾 Save Pavti Settings (सेटिंग्ज जतन करा)
            </Button>
          </form>

          {/* -------------------------------------------------------------
              RIGHT: LIVE DIGITAL PAVTI PREVIEW
          -------------------------------------------------------------- */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                🔴 Live Preview (थेट पूर्वावलोकन)
              </span>
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                {config.festivalType.toUpperCase()} THEME
              </span>
            </div>

            <div className="p-2 sm:p-4 rounded-2xl bg-slate-100/80 border border-slate-200 flex items-center justify-center">
              <DigitalPavtiCard config={config} receipt={sampleReceipt} />
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              ℹ️ All future donor receipts will automatically render with this personalized branding.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
