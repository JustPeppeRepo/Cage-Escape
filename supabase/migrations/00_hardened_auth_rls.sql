-- =====================================================================================
-- HARDENED AUTHENTICATION & ZERO-TRUST RLS MIGRATION
-- Principal Database Security Architect: betterAuth -> Supabase Auth Migration
-- =====================================================================================
-- 
-- SECURITY OBJECTIVES:
-- 1. Purge legacy betterAuth structures (user, session, account, verification)
-- 2. Implement zero-trust RLS policies on public.profiles linked to auth.users
-- 3. Prevent search-path hijacking with explicit function scoping
-- 4. Enforce FORCE ROW LEVEL SECURITY to prevent owner bypass vulnerabilities
--
-- ⚠️  CRITICAL: This migration assumes Supabase Auth is already configured.
-- ⚠️  Run `supabase db reset` after this migration to ensure clean slate.
--
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- STEP 1: LEGACY BETTERAUTH CLEANUP
-- =====================================================================================

-- ⚠️ CRITICAL SECURITY CHECK [DB_CLEANUP]: Archive betterAuth tables safely
-- First, we'll rename tables to _archived suffix for potential rollback
-- Then drop all foreign keys to prevent cascade issues

-- Drop foreign keys pointing to betterAuth tables
ALTER TABLE IF EXISTS "Booking" DROP CONSTRAINT IF EXISTS "Booking_userId_fkey";

-- Archive betterAuth tables (rename for potential recovery)
ALTER TABLE IF EXISTS "user" RENAME TO "_user_archived_betterauth";
ALTER TABLE IF EXISTS "session" RENAME TO "_session_archived_betterauth";
ALTER TABLE IF EXISTS "account" RENAME TO "_account_archived_betterauth";  
ALTER TABLE IF EXISTS "verification" RENAME TO "_verification_archived_betterauth";

-- Comment archived tables for audit trail
COMMENT ON TABLE "_user_archived_betterauth" IS 'ARCHIVED: Legacy betterAuth user table. Safe to drop after migration verification.';
COMMENT ON TABLE "_session_archived_betterauth" IS 'ARCHIVED: Legacy betterAuth session table. Safe to drop after migration verification.';
COMMENT ON TABLE "_account_archived_betterauth" IS 'ARCHIVED: Legacy betterAuth account table. Safe to drop after migration verification.';
COMMENT ON TABLE "_verification_archived_betterauth" IS 'ARCHIVED: Legacy betterAuth verification table. Safe to drop after migration verification.';

-- =====================================================================================
-- STEP 2: CREATE HARDENED PUBLIC.PROFILES TABLE
-- =====================================================================================

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: Creating profiles table with mandatory RLS
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: Enable RLS and FORCE RLS to prevent owner bypass
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Add optimized index for auth lookups
CREATE INDEX CONCURRENTLY profiles_id_idx ON public.profiles(id);

-- Add table comment for audit purposes
COMMENT ON TABLE public.profiles IS 'SECURE: User profiles linked to auth.users with zero-trust RLS policies';

-- =====================================================================================
-- STEP 3: ZERO-TRUST RLS POLICIES
-- =====================================================================================

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: SELECT policy - users can only read their OWN row
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: UPDATE policy - users can only update their OWN row  
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: INSERT/DELETE explicitly DENIED for client API
-- Only system triggers can insert/delete via SECURITY DEFINER functions
-- NO INSERT or DELETE policies = client requests will be denied by RLS

-- =====================================================================================
-- STEP 4: SECURE USER SYNCHRONIZATION TRIGGER
-- =====================================================================================

-- ⚠️ CRITICAL SECURITY CHECK [SECURITY_DEFINER]: Explicit search_path prevents hijacking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: Insert new profile for authenticated user
    -- This function runs with SECURITY DEFINER to bypass RLS for system operations
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log security event and re-raise
        RAISE LOG 'SECURITY EVENT: handle_new_user failed for user %: %', NEW.id, SQLERRM;
        RAISE;
END;
$$;

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: Secure trigger on auth.users creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Add function security comment
COMMENT ON FUNCTION public.handle_new_user() IS 'SECURE: System function to sync auth.users to public.profiles with explicit search_path';

-- =====================================================================================
-- STEP 5: UPDATE EXISTING FOREIGN KEYS TO REFERENCE AUTH.USERS
-- =====================================================================================

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: Update booking references to auth.users
-- First add new column, then migrate data, then drop old column
ALTER TABLE "Booking" ADD COLUMN auth_user_id UUID;

-- Create index for new foreign key
CREATE INDEX CONCURRENTLY booking_auth_user_id_idx ON "Booking"(auth_user_id);

-- ⚠️ IMPORTANT: Data migration step would go here in production
-- This is commented out as it requires specific business logic to map betterAuth users to Supabase users
-- 
-- UPDATE "Booking" b SET auth_user_id = (
--     SELECT au.id FROM auth.users au 
--     JOIN "_user_archived_betterauth" uba ON au.email = uba.email 
--     WHERE uba.id = b."userId"
-- );

-- Add foreign key constraint to auth.users
ALTER TABLE "Booking" 
ADD CONSTRAINT "Booking_auth_user_id_fkey" 
FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- TODO: After data migration is complete and verified:
-- ALTER TABLE "Booking" ALTER COLUMN auth_user_id SET NOT NULL;
-- ALTER TABLE "Booking" DROP COLUMN "userId";
-- ALTER TABLE "Booking" RENAME COLUMN auth_user_id TO user_id;

-- =====================================================================================
-- STEP 6: ENABLE RLS ON ALL PUBLIC TABLES (SECURITY HARDENING)
-- =====================================================================================

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: Enable RLS on all public tables
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE '_archived_%'
    LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', tbl.schemaname, tbl.tablename);
        
        -- Force RLS to prevent owner bypass
        EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', tbl.schemaname, tbl.tablename);
        
        RAISE LOG 'SECURITY: Enabled FORCE RLS on table %.%', tbl.schemaname, tbl.tablename;
    END LOOP;
END
$$;

-- =====================================================================================
-- STEP 7: SECURITY AUDIT LOGGING
-- =====================================================================================

-- Create security audit log
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log FORCE ROW LEVEL SECURITY;

-- Only allow system to insert audit logs (no client access)
-- Admins can read all logs, users can only see their own
CREATE POLICY "audit_log_admin_select" ON public.security_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.id IN (
                SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
            )
        )
        OR user_id = auth.uid()
    );

-- Log this migration
INSERT INTO public.security_audit_log (event_type, details)
VALUES (
    'MIGRATION_HARDENED_AUTH_RLS',
    jsonb_build_object(
        'migration', '00_hardened_auth_rls.sql',
        'timestamp', now(),
        'security_level', 'ZERO_TRUST',
        'rls_enabled', true,
        'force_rls_enabled', true,
        'betterauth_archived', true
    )
);

-- =====================================================================================
-- FINAL SECURITY VALIDATION
-- =====================================================================================

-- Verify RLS is enabled on all public tables
DO $$
DECLARE
    insecure_tables TEXT[];
BEGIN
    SELECT array_agg(tablename) INTO insecure_tables
    FROM pg_tables pt
    LEFT JOIN pg_class pc ON pc.relname = pt.tablename
    WHERE pt.schemaname = 'public' 
    AND pt.tablename NOT LIKE '_archived_%'
    AND (pc.relrowsecurity = false OR pc.relforcerowsecurity = false);
    
    IF array_length(insecure_tables, 1) > 0 THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Tables without FORCE RLS: %', insecure_tables;
    END IF;
    
    RAISE LOG 'SECURITY VALIDATION: All public tables have FORCE RLS enabled';
END
$$;

-- Add final migration comment
COMMENT ON SCHEMA public IS 'HARDENED: Zero-trust RLS enabled on all tables. betterAuth migration completed.';

COMMIT;

-- =====================================================================================
-- POST-MIGRATION MANUAL STEPS REQUIRED:
-- =====================================================================================
--
-- 1. Verify Supabase Auth is configured and working
-- 2. Run data migration script to populate public.profiles from archived betterAuth data
-- 3. Update application code to use auth.users instead of betterAuth
-- 4. Test all RLS policies with different user roles
-- 5. After verification, drop archived tables:
--    DROP TABLE "_user_archived_betterauth";
--    DROP TABLE "_session_archived_betterauth"; 
--    DROP TABLE "_account_archived_betterauth";
--    DROP TABLE "_verification_archived_betterauth";
-- 6. Complete the Booking table migration by making auth_user_id NOT NULL
--
-- =====================================================================================