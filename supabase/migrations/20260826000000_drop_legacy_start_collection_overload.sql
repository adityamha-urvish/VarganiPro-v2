-- Step 8F-3: Drop legacy 6-argument start_collection_session overload
-- Eliminates PostgREST PGRST203 candidate ambiguity and removes unhardened legacy overload.

DROP FUNCTION IF EXISTS public.start_collection_session(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
);
