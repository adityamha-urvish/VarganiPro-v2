import { useEffect, useRef, useState } from "react";

import { supabase } from "@/supabase/client";
import {
  initializeCollectionSession,
  loadCurrentCollectionSession,
  type CollectionSessionContext,
} from "@/features/collection/services/collection-session.service";
import { mergeOfflineBookState } from "@/lib/offline/offline-db";

export interface UseDashboardBootstrapOptions {
  onSessionLoaded?: (
    session: CollectionSessionContext
  ) => Promise<void> | void;
}

export interface UseDashboardBootstrapReturn {
  session: CollectionSessionContext | null;
  setSession: React.Dispatch<
    React.SetStateAction<CollectionSessionContext | null>
  >;
  loading: boolean;
  isAdmin: boolean;
  organizationId: string | null;
  setOrganizationId: React.Dispatch<React.SetStateAction<string | null>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  ensureOfflineBookState: (
    activeSession: CollectionSessionContext
  ) => Promise<void>;
}

export async function ensureOfflineBookState(
  activeSession: CollectionSessionContext
): Promise<void> {
  await mergeOfflineBookState({
    receiptBookId: activeSession.receiptBookId,
    organizationId: activeSession.organizationId,
    eventId: activeSession.eventId,
    collectionSessionId: activeSession.sessionId,
    volunteerId: activeSession.volunteerId,
    bookNumber: activeSession.bookNumber,
    prefix: activeSession.prefix,
    startNumber: activeSession.startNumber,
    endNumber: activeSession.endNumber,
    nextLocalNumber: activeSession.currentNumber,
    updatedAt: new Date().toISOString(),
  });
}

export function useDashboardBootstrap(
  options: UseDashboardBootstrapOptions = {}
): UseDashboardBootstrapReturn {
  const { onSessionLoaded } = options;

  const onSessionLoadedRef = useRef(onSessionLoaded);
  onSessionLoadedRef.current = onSessionLoaded;

  const [session, setSession] =
    useState<CollectionSessionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [organizationId, setOrganizationId] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        const { data: roleData, error: roleError } =
          await supabase.rpc("current_user_role");

        if (roleError) {
          console.warn("CURRENT USER ROLE ERROR:", roleError);
        }

        const admin =
          String(roleData ?? "").toLowerCase() === "admin";

        setIsAdmin(admin);

        const { data: authData } = await supabase.auth.getUser();
        const authUserId = authData.user?.id;

        if (authUserId) {
          const { data: membership } = await supabase
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", authUserId)
            .limit(1)
            .maybeSingle();

          if (membership?.organization_id) {
            setOrganizationId(membership.organization_id);
          }
        }

        try {
          console.log("Initializing collection session...");

          const result =
            await initializeCollectionSession();

          console.log("COLLECTION SESSION:", result);

          setSession(result);
          setOrganizationId(result.organizationId);

          /*
           * Receipt creation is offline-first. Every active
           * session must have its checked-out receipt book
           * persisted in IndexedDB, including sessions that
           * were created before the latest frontend build.
           */
          await ensureOfflineBookState(result);

          if (onSessionLoadedRef.current) {
            await onSessionLoadedRef.current(result);
          }
        } catch (sessionError) {
          console.error("COLLECTION SESSION ERROR:", sessionError);

          // The service performs additional validation (including receipt-book
          // ownership). For the dashboard, retry the current user's open
          // session directly so an existing open session is never hidden.
          const directSession = await loadCurrentCollectionSession();

          if (directSession) {
            console.log(
              "DIRECT COLLECTION SESSION:",
              directSession
            );
            setSession(directSession);
            setOrganizationId(directSession.organizationId);

            /*
             * Recover the offline book state for an already-open
             * server session as well.
             */
            await ensureOfflineBookState(directSession);

            if (onSessionLoadedRef.current) {
              await onSessionLoadedRef.current(directSession);
            }
          } else if (!admin) {
            throw sessionError;
          } else {
            setSession(null);
            console.log(
              "No current open collection session. Showing admin dashboard and Start Collection."
            );
          }
        }
      } catch (err) {
        console.error("DASHBOARD INITIALIZATION ERROR:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to initialize dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, []);

  return {
    session,
    setSession,
    loading,
    isAdmin,
    organizationId,
    setOrganizationId,
    error,
    setError,
    ensureOfflineBookState,
  };
}
