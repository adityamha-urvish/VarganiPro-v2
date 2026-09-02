import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchVolunteers,
  provisionVolunteer,
  resetVolunteerPin,
  setVolunteerStatus,
  type VolunteerRecord,
} from "../services/volunteer-admin.service";
import { VolunteerCredentialModal } from "./volunteer-credential-modal";

interface VolunteerManagementPanelProps {
  organizationId: string;
}

export function VolunteerManagementPanel({
  organizationId,
}: VolunteerManagementPanelProps) {
  const [volunteers, setVolunteers] = useState<VolunteerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Volunteer Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Credential Modal State
  const [credentialModal, setCredentialModal] = useState<{
    isOpen: boolean;
    name: string;
    mobile: string;
    isNewUser: boolean;
    temporaryPin: string | null;
    isReset?: boolean;
  }>({
    isOpen: false,
    name: "",
    mobile: "",
    isNewUser: true,
    temporaryPin: null,
    isReset: false,
  });

  const loadVolunteers = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVolunteers(organizationId);
      setVolunteers(data);
    } catch (err: unknown) {
      console.error("Error loading volunteers:", err);
      setError(err instanceof Error ? err.message : "Failed to load volunteers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVolunteers();
  }, [organizationId]);

  const handleAddVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (fullName.trim().length < 2) {
      setAddError("Volunteer name must be at least 2 characters");
      return;
    }

    if (!/^\d{10}$/.test(mobile.trim())) {
      setAddError("Enter a valid 10-digit mobile number");
      return;
    }

    setSubmitting(true);
    try {
      const result = await provisionVolunteer(
        organizationId,
        fullName.trim(),
        mobile.trim()
      );

      setShowAddModal(false);
      setFullName("");
      setMobile("");

      // Open one-time credential modal
      setCredentialModal({
        isOpen: true,
        name: fullName.trim(),
        mobile: mobile.trim(),
        isNewUser: result.isNewUser,
        temporaryPin: result.temporaryPin,
        isReset: false,
      });

      await loadVolunteers();
    } catch (err: unknown) {
      console.error("Provisioning error:", err);
      setAddError(err instanceof Error ? err.message : "Failed to add volunteer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPin = async (vol: VolunteerRecord) => {
    if (!confirm(`Reset PIN for volunteer "${vol.fullName}" (${vol.mobile})?`)) {
      return;
    }

    try {
      const res = await resetVolunteerPin(vol.volunteerId);
      setCredentialModal({
        isOpen: true,
        name: vol.fullName,
        mobile: vol.mobile,
        isNewUser: true,
        temporaryPin: res.temporaryPin,
        isReset: true,
      });
      await loadVolunteers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reset PIN");
    }
  };

  const handleToggleStatus = async (vol: VolunteerRecord) => {
    const nextStatus = vol.status === "active" ? "inactive" : "active";
    const action = nextStatus === "active" ? "Reactivate" : "Deactivate";

    if (!confirm(`${action} volunteer "${vol.fullName}"?`)) {
      return;
    }

    try {
      await setVolunteerStatus(vol.volunteerId, nextStatus);
      await loadVolunteers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : `Failed to ${action.toLowerCase()} volunteer`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span>👥</span> Volunteer Management
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage your Mandal&apos;s collection volunteers, issue PINs, and audit status.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="font-bold text-xs gap-1.5 cursor-pointer shadow-sm"
        >
          <span>+</span> Add Volunteer
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {/* Roster Card */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Registered Volunteers ({volunteers.length})
          </CardTitle>
          <button
            type="button"
            onClick={loadVolunteers}
            className="text-xs text-primary font-semibold hover:underline cursor-pointer"
          >
            ↻ Refresh
          </button>
        </CardHeader>

        <CardContent className="p-0 divide-y">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading volunteers...
            </div>
          ) : volunteers.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-3xl">👥</p>
              <p className="text-xs font-bold text-slate-700">No volunteers added yet</p>
              <p className="text-[11px] text-muted-foreground">
                Add your first volunteer to start delegating collection corridor duties.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="mt-2 font-bold text-xs cursor-pointer"
              >
                + Add First Volunteer
              </Button>
            </div>
          ) : (
            volunteers.map((vol) => {
              const isActive = vol.status === "active";
              return (
                <div
                  key={vol.volunteerId}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {vol.fullName}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {vol.status}
                      </span>
                      {vol.mustChangePin && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                          PIN Rotation Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">
                      📱 {vol.mobile}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPin(vol)}
                      className="text-xs font-semibold h-8 cursor-pointer"
                      title="Generate new temporary PIN"
                    >
                      🔄 Reset PIN
                    </Button>

                    <Button
                      type="button"
                      variant={isActive ? "ghost" : "outline"}
                      size="sm"
                      onClick={() => handleToggleStatus(vol)}
                      className={`text-xs font-semibold h-8 cursor-pointer ${
                        isActive
                          ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                          : "text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Add Volunteer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>➕</span> Add Collection Volunteer
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                The system will generate a secure random 4-digit temporary PIN.
              </p>
            </CardHeader>

            <CardContent>
              {addError && (
                <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                  ⚠️ {addError}
                </div>
              )}

              <form onSubmit={handleAddVolunteer} className="space-y-3.5">
                <div>
                  <Label htmlFor="volName" className="text-xs font-bold text-slate-700">
                    Volunteer Full Name *
                  </Label>
                  <Input
                    id="volName"
                    placeholder="e.g. Rahul Shinde"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="volMobile" className="text-xs font-bold text-slate-700">
                    Mobile Number (10 digits) *
                  </Label>
                  <Input
                    id="volMobile"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 font-bold text-xs cursor-pointer"
                  >
                    {submitting ? "Adding..." : "Add & Generate PIN ⚡"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddModal(false)}
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Credential Modal */}
      <VolunteerCredentialModal
        isOpen={credentialModal.isOpen}
        onClose={() => setCredentialModal((prev) => ({ ...prev, isOpen: false }))}
        volunteerName={credentialModal.name}
        mobile={credentialModal.mobile}
        isNewUser={credentialModal.isNewUser}
        temporaryPin={credentialModal.temporaryPin}
        isReset={credentialModal.isReset}
      />
    </div>
  );
}
