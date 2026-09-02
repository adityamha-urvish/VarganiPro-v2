import { useEffect, useState } from "react";

import { supabase } from "@/supabase/client";

import type { AdminHandover } from "../components/admin-handover-panel";

export interface UseAdminHandoversOptions {
  isAdmin: boolean;
  organizationId: string | null;
}

export function useAdminHandovers({
  isAdmin,
  organizationId,
}: UseAdminHandoversOptions) {
  const [adminHandovers, setAdminHandovers] = useState<AdminHandover[]>([]);
  const [adminHandoverLoading, setAdminHandoverLoading] = useState(false);
  const [adminHandoverError, setAdminHandoverError] = useState<string | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState<string | null>(null);

  async function loadAdminHandovers() {
    if (!isAdmin || !organizationId) {
      return;
    }

    setAdminHandoverLoading(true);
    setAdminHandoverError(null);

    try {
      const { data, error: handoverError } = await supabase
        .from("collection_handovers")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (handoverError) {
        throw new Error(handoverError.message);
      }

      const handoverRows = (data ?? []) as AdminHandover[];
      const volunteerIds = Array.from(
        new Set(handoverRows.map((row) => row.volunteer_id))
      );

      let volunteerNames = new Map<string, string>();

      if (volunteerIds.length > 0) {
        const { data: volunteers, error: volunteersError } =
          await supabase
            .from("volunteers")
            .select("id, name")
            .in("id", volunteerIds);

        if (volunteersError) {
          throw new Error(volunteersError.message);
        }

        volunteerNames = new Map(
          (volunteers ?? []).map((volunteer) => [
            volunteer.id,
            volunteer.name,
          ])
        );
      }

      setAdminHandovers(
        handoverRows.map((row) => ({
          ...row,
          volunteerName:
            volunteerNames.get(row.volunteer_id) ?? "Volunteer",
        }))
      );
    } catch (err) {
      console.error("ADMIN HANDOVER LOAD ERROR:", err);
      setAdminHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to load collection handovers."
      );
    } finally {
      setAdminHandoverLoading(false);
    }
  }

  /*
   * Verify a submitted collection handover.
   */
  async function handleVerifyHandover(handoverId: string) {
    if (!window.confirm("Verify this collection handover?")) {
      return;
    }

    setAdminActionLoading(handoverId);
    setAdminHandoverError(null);

    try {
      const { data, error: verifyError } = await supabase.rpc(
        "verify_collection_handover",
        { p_handover_id: handoverId }
      );

      if (verifyError) {
        throw new Error(verifyError.message);
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while verifying collection handover."
        );
      }

      await loadAdminHandovers();
    } catch (err) {
      console.error("VERIFY HANDOVER ERROR:", err);
      setAdminHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to verify collection handover."
      );
    } finally {
      setAdminActionLoading(null);
    }
  }

  /*
   * Reject a submitted collection handover.
   */
  async function handleRejectHandover(
    handoverId: string,
    customReason?: string
  ) {
    let reason = customReason?.trim();

    if (!reason) {
      const input = window.prompt(
        "Enter the reason for rejecting this handover:"
      );
      if (input === null) return;
      reason = input.trim();
    }

    if (!reason) {
      setAdminHandoverError("A rejection reason is required.");
      return;
    }

    setAdminActionLoading(handoverId);
    setAdminHandoverError(null);

    try {
      const { data, error: rejectError } = await supabase.rpc(
        "reject_collection_handover",
        {
          p_handover_id: handoverId,
          p_rejection_reason: reason,
        }
      );

      if (rejectError) {
        throw new Error(rejectError.message);
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while rejecting collection handover."
        );
      }

      await loadAdminHandovers();
    } catch (err) {
      console.error("REJECT HANDOVER ERROR:", err);
      setAdminHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to reject collection handover."
      );
    } finally {
      setAdminActionLoading(null);
    }
  }

  useEffect(() => {
    if (isAdmin && organizationId) {
      void loadAdminHandovers();
    }
  }, [isAdmin, organizationId]);

  return {
    adminHandovers,
    adminHandoverLoading,
    adminHandoverError,
    adminActionLoading,
    loadAdminHandovers,
    handleVerifyHandover,
    handleRejectHandover,
  };
}
