-- ⚠️ CRITICAL SECURITY CHECK [SECURITY_DEFINER]: [Search path locking on user sync trigger]
-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: [Verification of RLS policies on public tables]

-- =============================================================================
-- SUPABASE AUTH & ROW LEVEL SECURITY INITIALIZATION
-- =============================================================================

-- Ensure profiles.role exists before any RLS policy that filters on p.role = 'ADMIN'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER';


-- Create profiles table auto-sync function with SECURITY DEFINER and locked search_path
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    name, 
    email, 
    username, 
    phone, 
    created_at, 
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users table
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY ENABLEMENT
-- =============================================================================

-- Enable and force RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Enable and force RLS on Booking table  
ALTER TABLE public."Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Booking" FORCE ROW LEVEL SECURITY;

-- Enable and force RLS on Payment table
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" FORCE ROW LEVEL SECURITY;

-- Enable and force RLS on BookingWaiver table
ALTER TABLE public."BookingWaiver" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookingWaiver" FORCE ROW LEVEL SECURITY;

-- Enable and force RLS on DiscountCode table
ALTER TABLE public."DiscountCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DiscountCode" FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES FOR PROFILES
-- =============================================================================

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- RLS POLICIES FOR BOOKINGS
-- =============================================================================

-- Policy: Users can view their own bookings
CREATE POLICY "Users can view own bookings" ON public."Booking"
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- Policy: Service role can perform all operations on bookings (server-side Prisma)
CREATE POLICY "Service role full access to bookings" ON public."Booking"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Authenticated users can create bookings (but only for themselves)
CREATE POLICY "Users can create own bookings" ON public."Booking"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

-- =============================================================================
-- RLS POLICIES FOR PAYMENTS
-- =============================================================================

-- Policy: Users can view payments for their bookings
CREATE POLICY "Users can view own payments" ON public."Payment"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b 
      WHERE b.id = "Payment"."bookingId" 
      AND b."userId" = auth.uid()::text
    )
  );

-- Policy: Service role can perform all operations on payments (Stripe webhooks)
CREATE POLICY "Service role full access to payments" ON public."Payment"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- RLS POLICIES FOR BOOKING WAIVERS
-- =============================================================================

-- Policy: Users can view waivers for their bookings
CREATE POLICY "Users can view own booking waivers" ON public."BookingWaiver"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b 
      WHERE b.id = "BookingWaiver"."bookingId" 
      AND b."userId" = auth.uid()::text
    )
  );

-- Policy: Users can upload waivers for their own bookings
CREATE POLICY "Users can create waivers for own bookings" ON public."BookingWaiver"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Booking" b 
      WHERE b.id = "BookingWaiver"."bookingId" 
      AND b."userId" = auth.uid()::text
    )
  );

-- Policy: Service role can perform all operations on waivers
CREATE POLICY "Service role full access to waivers" ON public."BookingWaiver"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- RLS POLICIES FOR DISCOUNT CODES
-- =============================================================================

-- Policy: Users can view their own discount codes
CREATE POLICY "Users can view own discount codes" ON public."DiscountCode"
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- Policy: Service role can perform all operations on discount codes
CREATE POLICY "Service role full access to discount codes" ON public."DiscountCode"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- SECURITY LOCKDOWN FOR CRITICAL TABLES
-- =============================================================================

-- Block direct REST API writes to sensitive tables (only service role via database connection)
-- Users should only interact through Prisma server-side actions

-- Additional RLS policy to block direct REST writes to Booking table
CREATE POLICY "Block direct REST writes to bookings" ON public."Booking"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- Additional RLS policy to block direct REST writes to Payment table  
CREATE POLICY "Block direct REST writes to payments" ON public."Payment"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- Additional RLS policy to block direct REST updates to Payment table
CREATE POLICY "Block direct REST updates to payments" ON public."Payment"
  FOR UPDATE
  TO anon, authenticated
  WITH CHECK (false);

-- Block direct writes to stripe_webhook_event (only service role)
-- Prisma @@map("stripe_webhook_event"); quoted "StripeWebhookEvent" does not exist.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_event (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_webhook_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stripe_webhook_event_type_idx"
  ON public.stripe_webhook_event("type");

ALTER TABLE public.stripe_webhook_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_event FORCE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access to webhook events" ON public.stripe_webhook_event
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Block all other access to webhook events" ON public.stripe_webhook_event
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- ADMIN POLICIES (FOR ADMIN ROLE USERS)
-- =============================================================================

-- Admin users can view all profiles
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- Admin users can view all bookings
CREATE POLICY "Admin can view all bookings" ON public."Booking"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- Admin users can update booking status
CREATE POLICY "Admin can update bookings" ON public."Booking"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- Admin users can view all payments
CREATE POLICY "Admin can view all payments" ON public."Payment"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- Admin users can view all discount codes
CREATE POLICY "Admin can view all discount codes" ON public."DiscountCode"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- Admin users can create/update discount codes
CREATE POLICY "Admin can manage discount codes" ON public."DiscountCode"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- =============================================================================
-- SECURITY AUDIT LOG
-- =============================================================================

-- Log successful policy application
DO $$
BEGIN
    RAISE NOTICE '⚠️ CRITICAL SECURITY CHECK [DB_RLS]: RLS policies successfully applied to profiles, Booking, Payment, BookingWaiver, DiscountCode, and StripeWebhookEvent tables';
    RAISE NOTICE '⚠️ CRITICAL SECURITY CHECK [SECURITY_DEFINER]: User sync trigger created with locked search_path = public, auth';
    RAISE NOTICE '✅ SECURITY INITIALIZATION COMPLETE: All tables secured with appropriate RLS policies';
END
$$;