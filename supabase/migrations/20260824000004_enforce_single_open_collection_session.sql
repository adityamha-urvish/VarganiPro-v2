-- Step 8E-4: Enforce Single Open Collection Session Per Volunteer
-- Closes the check-then-insert concurrency race in session creation
-- by enforcing uniqueness on (volunteer_id) strictly when status = 'open'.

CREATE UNIQUE INDEX IF NOT EXISTS uq_open_collection_session_per_volunteer
ON public.collection_sessions (volunteer_id)
WHERE status = 'open';
