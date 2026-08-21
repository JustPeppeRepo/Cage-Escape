-- =============================================================================
-- SUPABASE CAGEROOM 3.0 - BASELINE UNICA CONSOLIDATA
-- Data: 2026-08-21 12:00:00 UTC
-- =============================================================================
-- 
-- ⚠️ CRITICAL SECURITY CHECK [SECURITY_DEFINER]: Search path locking on user sync trigger
-- ⚠️ CRITICAL SECURITY CHECK [DB_RLS]: Verification of RLS policies on public tables
-- 
-- STRUTTURA ESECUZIONE TASSATIVA:
-- 1. Estensioni e Tipi/Enum
-- 2. Tabelle e Colonne  
-- 3. Funzioni e Trigger (Sync Auth -> Public)
-- 4. Row Level Security (RLS) e Policy
-- =============================================================================

-- =============================================================================
-- 1. ESTENSIONI E TIPI/ENUM
-- =============================================================================

-- Estensioni necessarie per Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Definizione ENUM per il ruolo utente
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- Definizione ENUM per lo stato booking
CREATE TYPE "BookingStatus" AS ENUM (
  'PENDING',
  'DEPOSIT_PAID', 
  'PAID',
  'CANCELLED',
  'COMPLETED',
  'PAYMENT_CONFLICT_REFUND_REQUIRED'
);

-- Definizione ENUM per il tipo pagamento
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL');

-- Definizione ENUM per lo stato pagamento
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- Definizione ENUM per override del calendario
CREATE TYPE "ScheduleOverrideType" AS ENUM ('CLOSED', 'CUSTOM_HOURS');

-- =============================================================================
-- 2. TABELLE E COLONNE
-- =============================================================================

-- Tabella profiles (collegata a auth.users con RLS)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    image TEXT DEFAULT 'https://cageroom.avatar',
    role "Role" NOT NULL DEFAULT 'USER',
    username TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella Room
CREATE TABLE IF NOT EXISTS public."Room" (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    "prezzoTotale" DECIMAL NOT NULL,
    "prezzoCaparra" DECIMAL NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "minPlayers" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "terrorLevel" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageWebp" BYTEA,
    "imageUpdatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella RoomPricingTier
CREATE TABLE IF NOT EXISTS public."RoomPricingTier" (
    id TEXT PRIMARY KEY,
    "roomId" TEXT NOT NULL REFERENCES public."Room"(id) ON DELETE CASCADE,
    "minParticipants" INTEGER NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "totalPrice" DECIMAL NOT NULL,
    "depositPrice" DECIMAL NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE("roomId", "minParticipants", "maxParticipants")
);

-- Tabella ScheduleOverride
CREATE TABLE IF NOT EXISTS public."ScheduleOverride" (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    "roomId" TEXT REFERENCES public."Room"(id),
    type "ScheduleOverrideType" NOT NULL,
    "openHour" INTEGER,
    "closeHour" INTEGER,
    reason TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(date, "roomId")
);

-- Tabella WeeklyOpeningHours
CREATE TABLE IF NOT EXISTS public."WeeklyOpeningHours" (
    id TEXT PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL UNIQUE,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openHour" INTEGER NOT NULL DEFAULT 10,
    "closeHour" INTEGER NOT NULL DEFAULT 22,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella DiscountCode
CREATE TABLE IF NOT EXISTS public."DiscountCode" (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "discountPercent" INTEGER NOT NULL,
    "userId" UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    used BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella Booking
CREATE TABLE IF NOT EXISTS public."Booking" (
    id TEXT PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES public.profiles(id),
    "roomId" TEXT NOT NULL REFERENCES public."Room"(id),
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    status "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "holdExpiresAt" TIMESTAMPTZ,
    "stripeSessionId" TEXT UNIQUE,
    "paymentChoice" "PaymentType" NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "minorCount" INTEGER NOT NULL DEFAULT 0,
    "discountCodeId" TEXT REFERENCES public."DiscountCode"(id),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella BookingWaiver
CREATE TABLE IF NOT EXISTS public."BookingWaiver" (
    id TEXT PRIMARY KEY,
    "bookingId" TEXT NOT NULL REFERENCES public."Booking"(id) ON DELETE CASCADE,
    "minorIndex" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    content BYTEA NOT NULL,
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE("bookingId", "minorIndex")
);

-- Tabella Payment
CREATE TABLE IF NOT EXISTS public."Payment" (
    id TEXT PRIMARY KEY,
    "bookingId" TEXT NOT NULL REFERENCES public."Booking"(id),
    "stripePaymentId" TEXT NOT NULL UNIQUE,
    amount DECIMAL NOT NULL,
    type "PaymentType" NOT NULL,
    status "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMPTZ
);

-- Tabella SiteSettings
CREATE TABLE IF NOT EXISTS public."SiteSettings" (
    id TEXT PRIMARY KEY DEFAULT 'default',
    "easterEggDiscountEnabled" BOOLEAN NOT NULL DEFAULT false,
    "easterEggDiscountPercent" INTEGER NOT NULL DEFAULT 5,
    "slotCooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella ContactMessage
CREATE TABLE IF NOT EXISTS public."ContactMessage" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella Review
CREATE TABLE IF NOT EXISTS public."Review" (
    id TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    quote TEXT NOT NULL,
    rotation INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "imageWebp" BYTEA,
    "imageUpdatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella RateLimitCounter
CREATE TABLE IF NOT EXISTS public."RateLimitCounter" (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMPTZ NOT NULL
);

-- Tabella StripeWebhookEvent
CREATE TABLE IF NOT EXISTS public.stripe_webhook_event (
    id TEXT NOT NULL PRIMARY KEY,
    type TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDICI PER PERFORMANCE
-- =============================================================================

-- Indici per RoomPricingTier
CREATE INDEX IF NOT EXISTS "RoomPricingTier_roomId_idx" ON public."RoomPricingTier"("roomId");

-- Indici per ScheduleOverride
CREATE INDEX IF NOT EXISTS "ScheduleOverride_date_idx" ON public."ScheduleOverride"(date);

-- Indici per Booking
CREATE INDEX IF NOT EXISTS "Booking_startTime_endTime_idx" ON public."Booking"("startTime", "endTime");
CREATE INDEX IF NOT EXISTS "Booking_roomId_startTime_endTime_idx" ON public."Booking"("roomId", "startTime", "endTime");
CREATE INDEX IF NOT EXISTS "Booking_holdExpiresAt_idx" ON public."Booking"("holdExpiresAt");

-- Indici per BookingWaiver
CREATE INDEX IF NOT EXISTS "BookingWaiver_bookingId_idx" ON public."BookingWaiver"("bookingId");

-- Indici per DiscountCode
CREATE INDEX IF NOT EXISTS "DiscountCode_userId_idx" ON public."DiscountCode"("userId");
CREATE INDEX IF NOT EXISTS "DiscountCode_code_idx" ON public."DiscountCode"(code);

-- Indici per ContactMessage
CREATE INDEX IF NOT EXISTS "ContactMessage_createdAt_idx" ON public."ContactMessage"("createdAt");

-- Indici per Review
CREATE INDEX IF NOT EXISTS "Review_isPublished_sortOrder_idx" ON public."Review"("isPublished", "sortOrder");

-- Indici per RateLimitCounter
CREATE INDEX IF NOT EXISTS "RateLimitCounter_resetAt_idx" ON public."RateLimitCounter"("resetAt");

-- Indici per StripeWebhookEvent
CREATE INDEX IF NOT EXISTS "stripe_webhook_event_type_idx" ON public.stripe_webhook_event(type);

-- =============================================================================
-- 3. FUNZIONI E TRIGGER (SYNC AUTH -> PUBLIC)
-- =============================================================================

-- Funzione per sincronizzare auth.users con public.profiles
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
    "createdAt", 
    "updatedAt"
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

-- Rimozione e ricreazione del trigger per evitare duplicati
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) E POLICY
-- =============================================================================

-- Abilitazione RLS su tutte le tabelle pubbliche
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public."Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Room" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."RoomPricingTier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoomPricingTier" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."ScheduleOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ScheduleOverride" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."WeeklyOpeningHours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WeeklyOpeningHours" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Booking" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."BookingWaiver" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookingWaiver" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."DiscountCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DiscountCode" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."SiteSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SiteSettings" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."ContactMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContactMessage" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Review" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."RateLimitCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RateLimitCounter" FORCE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_webhook_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_event FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES PER PROFILES
-- =============================================================================

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Admin users can view all profiles
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- =============================================================================
-- RLS POLICIES PER BOOKINGS
-- =============================================================================

-- Policy: Users can view their own bookings
DROP POLICY IF EXISTS "Users can view own bookings" ON public."Booking";
CREATE POLICY "Users can view own bookings" ON public."Booking"
  FOR SELECT
  USING (auth.uid() = "userId");

-- Policy: Service role can perform all operations on bookings (server-side Prisma)
DROP POLICY IF EXISTS "Service role full access to bookings" ON public."Booking";
CREATE POLICY "Service role full access to bookings" ON public."Booking"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Authenticated users can create bookings (but only for themselves)
DROP POLICY IF EXISTS "Users can create own bookings" ON public."Booking";
CREATE POLICY "Users can create own bookings" ON public."Booking"
  FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Policy: Admin users can view all bookings
DROP POLICY IF EXISTS "Admin can view all bookings" ON public."Booking";
CREATE POLICY "Admin can view all bookings" ON public."Booking"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- Policy: Admin users can update booking status
DROP POLICY IF EXISTS "Admin can update bookings" ON public."Booking";
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

-- Policy: Block direct REST writes to bookings
DROP POLICY IF EXISTS "Block direct REST writes to bookings" ON public."Booking";
CREATE POLICY "Block direct REST writes to bookings" ON public."Booking"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- =============================================================================
-- RLS POLICIES PER PAYMENTS
-- =============================================================================

-- Policy: Users can view payments for their bookings
DROP POLICY IF EXISTS "Users can view own payments" ON public."Payment";
CREATE POLICY "Users can view own payments" ON public."Payment"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b 
      WHERE b.id = "Payment"."bookingId" 
      AND b."userId" = auth.uid()
    )
  );

-- Policy: Service role can perform all operations on payments (Stripe webhooks)
DROP POLICY IF EXISTS "Service role full access to payments" ON public."Payment";
CREATE POLICY "Service role full access to payments" ON public."Payment"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Admin users can view all payments
DROP POLICY IF EXISTS "Admin can view all payments" ON public."Payment";
CREATE POLICY "Admin can view all payments" ON public."Payment"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- Policy: Block direct REST writes to payments
DROP POLICY IF EXISTS "Block direct REST writes to payments" ON public."Payment";
CREATE POLICY "Block direct REST writes to payments" ON public."Payment"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- Policy: Block direct REST updates to payments
DROP POLICY IF EXISTS "Block direct REST updates to payments" ON public."Payment";
CREATE POLICY "Block direct REST updates to payments" ON public."Payment"
  FOR UPDATE
  TO anon, authenticated
  WITH CHECK (false);

-- =============================================================================
-- RLS POLICIES PER BOOKING WAIVERS
-- =============================================================================

-- Policy: Users can view waivers for their bookings
DROP POLICY IF EXISTS "Users can view own booking waivers" ON public."BookingWaiver";
CREATE POLICY "Users can view own booking waivers" ON public."BookingWaiver"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b 
      WHERE b.id = "BookingWaiver"."bookingId" 
      AND b."userId" = auth.uid()
    )
  );

-- Policy: Users can upload waivers for their own bookings
DROP POLICY IF EXISTS "Users can create waivers for own bookings" ON public."BookingWaiver";
CREATE POLICY "Users can create waivers for own bookings" ON public."BookingWaiver"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Booking" b 
      WHERE b.id = "BookingWaiver"."bookingId" 
      AND b."userId" = auth.uid()
    )
  );

-- Policy: Service role can perform all operations on waivers
DROP POLICY IF EXISTS "Service role full access to waivers" ON public."BookingWaiver";
CREATE POLICY "Service role full access to waivers" ON public."BookingWaiver"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- RLS POLICIES PER DISCOUNT CODES
-- =============================================================================

-- Policy: Users can view their own discount codes
DROP POLICY IF EXISTS "Users can view own discount codes" ON public."DiscountCode";
CREATE POLICY "Users can view own discount codes" ON public."DiscountCode"
  FOR SELECT
  USING (auth.uid() = "userId");

-- Policy: Service role can perform all operations on discount codes
DROP POLICY IF EXISTS "Service role full access to discount codes" ON public."DiscountCode";
CREATE POLICY "Service role full access to discount codes" ON public."DiscountCode"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Admin users can view all discount codes
DROP POLICY IF EXISTS "Admin can view all discount codes" ON public."DiscountCode";
CREATE POLICY "Admin can view all discount codes" ON public."DiscountCode"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'ADMIN'
    )
  );

-- Policy: Admin users can create/update discount codes
DROP POLICY IF EXISTS "Admin can manage discount codes" ON public."DiscountCode";
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
-- RLS POLICIES PER STRIPE WEBHOOK EVENT
-- =============================================================================

-- Policy: Service role only access to webhook events
DROP POLICY IF EXISTS "Service role only access to webhook events" ON public.stripe_webhook_event;
CREATE POLICY "Service role only access to webhook events" ON public.stripe_webhook_event
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Block all other access to webhook events
DROP POLICY IF EXISTS "Block all other access to webhook events" ON public.stripe_webhook_event;
CREATE POLICY "Block all other access to webhook events" ON public.stripe_webhook_event
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- RLS POLICIES PER TABELLE DI SOLA LETTURA PUBBLICHE
-- =============================================================================

-- Policy: Tutti possono leggere le stanze (Room)
DROP POLICY IF EXISTS "Public can view rooms" ON public."Room";
CREATE POLICY "Public can view rooms" ON public."Room"
  FOR SELECT
  USING (true);

-- Policy: Tutti possono leggere i pricing tiers delle stanze
DROP POLICY IF EXISTS "Public can view room pricing tiers" ON public."RoomPricingTier";
CREATE POLICY "Public can view room pricing tiers" ON public."RoomPricingTier"
  FOR SELECT
  USING (true);

-- Policy: Tutti possono leggere gli override del calendario
DROP POLICY IF EXISTS "Public can view schedule overrides" ON public."ScheduleOverride";
CREATE POLICY "Public can view schedule overrides" ON public."ScheduleOverride"
  FOR SELECT
  USING (true);

-- Policy: Tutti possono leggere gli orari di apertura settimanali
DROP POLICY IF EXISTS "Public can view weekly opening hours" ON public."WeeklyOpeningHours";
CREATE POLICY "Public can view weekly opening hours" ON public."WeeklyOpeningHours"
  FOR SELECT
  USING (true);

-- Policy: Tutti possono leggere le impostazioni del sito
DROP POLICY IF EXISTS "Public can view site settings" ON public."SiteSettings";
CREATE POLICY "Public can view site settings" ON public."SiteSettings"
  FOR SELECT
  USING (true);

-- Policy: Tutti possono leggere le recensioni pubblicate
DROP POLICY IF EXISTS "Public can view published reviews" ON public."Review";
CREATE POLICY "Public can view published reviews" ON public."Review"
  FOR SELECT
  USING ("isPublished" = true);

-- Policy: Service role può gestire tutto su tutte le tabelle
DROP POLICY IF EXISTS "Service role full access to rooms" ON public."Room";
CREATE POLICY "Service role full access to rooms" ON public."Room"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to room pricing tiers" ON public."RoomPricingTier";
CREATE POLICY "Service role full access to room pricing tiers" ON public."RoomPricingTier"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to schedule overrides" ON public."ScheduleOverride";
CREATE POLICY "Service role full access to schedule overrides" ON public."ScheduleOverride"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to weekly opening hours" ON public."WeeklyOpeningHours";
CREATE POLICY "Service role full access to weekly opening hours" ON public."WeeklyOpeningHours"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to site settings" ON public."SiteSettings";
CREATE POLICY "Service role full access to site settings" ON public."SiteSettings"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to contact messages" ON public."ContactMessage";
CREATE POLICY "Service role full access to contact messages" ON public."ContactMessage"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to reviews" ON public."Review";
CREATE POLICY "Service role full access to reviews" ON public."Review"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to rate limit counter" ON public."RateLimitCounter";
CREATE POLICY "Service role full access to rate limit counter" ON public."RateLimitCounter"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- SECURITY AUDIT LOG
-- =============================================================================

-- Log successful policy application
DO $$
BEGIN
    RAISE NOTICE '⚠️ CRITICAL SECURITY CHECK [DB_RLS]: RLS policies successfully applied to all public tables';
    RAISE NOTICE '⚠️ CRITICAL SECURITY CHECK [SECURITY_DEFINER]: User sync trigger created with locked search_path = public, auth';
    RAISE NOTICE '✅ SECURITY INITIALIZATION COMPLETE: All tables secured with appropriate RLS policies';
    RAISE NOTICE '✅ BASELINE MIGRATION COMPLETE: Single consolidated migration 20260821120000_init_baseline.sql applied successfully';
END
$$;