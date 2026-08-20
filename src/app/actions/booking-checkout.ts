"use server";

// =====================================================================================
// SECURE BOOKING CHECKOUT SERVER ACTION - ANTI-PRICE TAMPERING
// Senior Full-Stack Security Auditor Implementation
// =====================================================================================

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { 
  BookingStatus, 
  PaymentType,
  Prisma,
  type RoomPricingTier 
} from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/app/_lib/stripe";
import { 
  decimalToStripeCents,
  stripeCentsToEuroFixed 
} from "@/app/_lib/bookings/money";
import { getBookingChargeAmount } from "@/app/_lib/bookings/charge-amount";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";
import { validateDiscountCodeForUser } from "@/app/_lib/bookings/discount-code";
import { isSlotAvailable } from "@/app/_lib/bookings/slots";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import { logError } from "@/lib/logger";

// ⚠️ CRITICAL SECURITY CHECK [PAYMENT_INTEGRITY]: [Server-side RoomPricingTier price calculation]
// Input validation schema - NO PRICES FROM CLIENT
// Only accepts business logic parameters, all monetary calculations done server-side
const bookingCheckoutSchema = z.object({
  roomId: z.string().cuid(),
  participantCount: z.number().int().min(1).max(20),
  paymentChoice: z.enum(['DEPOSIT', 'FULL']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  discountCode: z.string().optional(),
});

export type BookingCheckoutInput = z.infer<typeof bookingCheckoutSchema>;

export type BookingActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string; code: string };

export type CheckoutSessionPayload = {
  url: string;
  bookingId: string;
};

/**
 * Secure booking checkout with server-side price calculation
 * 
 * SECURITY FEATURES:
 * - Anti-price tampering: All prices calculated server-side from RoomPricingTier
 * - IDOR prevention: User authentication and ownership validation
 * - Rate limiting: Prevents abuse of checkout endpoint
 * - Slot validation: Prevents double-booking race conditions
 * - Discount validation: Server-side discount code verification
 * 
 * @param input - Booking parameters (NO PRICES)
 * @returns Stripe checkout session URL or error
 */
export async function createBookingCheckout(
  input: BookingCheckoutInput
): Promise<BookingActionResult<CheckoutSessionPayload>> {
  
  // ⚠️ CRITICAL SECURITY CHECK [RATE_LIMITING]: Prevent checkout abuse
  const rateLimit = await checkRateLimit("booking-checkout", 5);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      code: "RATE_LIMITED",
    };
  }

  // ⚠️ CRITICAL SECURITY CHECK [IDOR_PREVENTION]: [User session matching before booking creation]
  // Validate user authentication via getUser() - NEVER accept user ID from client
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: "Authentication required to create booking",
      code: "UNAUTHORIZED",
    };
  }

  // Validate input parameters
  const parsed = bookingCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input parameters",
      code: "VALIDATION_ERROR",
    };
  }

  const { roomId, participantCount, paymentChoice, startTime, endTime, discountCode } = parsed.data;

  try {
    // ⚠️ CRITICAL SECURITY CHECK [PAYMENT_INTEGRITY]: [Server-side RoomPricingTier price calculation]
    // Fetch room and pricing tiers - NEVER trust client-provided prices
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { pricingTiers: true },
    });

    if (!room || !room.isActive) {
      return {
        success: false,
        error: "Room not found or not available",
        code: "ROOM_NOT_FOUND",
      };
    }

    // ⚠️ CRITICAL SECURITY CHECK [PAYMENT_INTEGRITY]: Server-side pricing tier resolution
    // Determine correct pricing tier based on participant count - NO CLIENT INPUT
    const pricingTier = resolvePricingTier(room.pricingTiers, participantCount);
    if (!pricingTier) {
      return {
        success: false,
        error: `No pricing available for ${participantCount} participants`,
        code: "INVALID_PARTICIPANT_COUNT",
      };
    }

    // Validate time slot parameters
    const slotStart = new Date(startTime);
    const slotEnd = new Date(endTime);
    
    if (slotStart >= slotEnd) {
      return {
        success: false,
        error: "Invalid time range",
        code: "INVALID_TIME_RANGE",
      };
    }

    // Hold expiration (10 minutes from now)
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // ⚠️ CRITICAL SECURITY CHECK [CONCURRENCY_PROTECTION]: ATOMIC TRANSACTION REQUIRED
    // ALL availability checks and booking creation MUST happen within a single transaction
    // to prevent double-booking race conditions between concurrent requests
    const booking = await prisma.$transaction(
      async (tx) => {
        // Step 1: Check slot availability within transaction
        const available = await isSlotAvailable(roomId, slotStart, slotEnd, tx);
        if (!available) {
          throw new Error("SLOT_UNAVAILABLE");
        }

        // Step 2: Validate discount code if provided (using tx for queries)
        let discountCodeRecord = null;
        if (discountCode) {
          // Manual discount validation within transaction context
          const normalizedCode = discountCode.trim().toUpperCase();
          
          const discount = await tx.discountCode.findUnique({
            where: { code: normalizedCode },
          });

          if (!discount) {
            throw new Error("DISCOUNT_INVALID: Discount code not found");
          }

          if (discount.used) {
            throw new Error("DISCOUNT_INVALID: Discount code already used");
          }

          if (discount.expiresAt < new Date()) {
            throw new Error("DISCOUNT_INVALID: Discount code expired");
          }

          if (discount.userId !== user.id) {
            throw new Error("DISCOUNT_INVALID: Discount code not valid for this user");
          }

          discountCodeRecord = discount;
        }

        // Step 3: Calculate pricing within transaction context
        // ⚠️ CRITICAL SECURITY CHECK [PAYMENT_INTEGRITY]: Server-side amount calculation
        const totalAmount = paymentChoice === PaymentType.DEPOSIT 
          ? pricingTier.depositPrice 
          : pricingTier.totalPrice;

        // Apply discount if valid
        let finalAmount = totalAmount;
        if (discountCodeRecord) {
          const discountMultiplier = (100 - discountCodeRecord.discountPercent) / 100;
          finalAmount = totalAmount.mul(discountMultiplier);
        }

        // Step 4: Create booking atomically
        const createdBooking = await tx.booking.create({
          data: {
            userId: user.id,
            roomId: roomId,
            startTime: slotStart,
            endTime: slotEnd,
            totalAmount: finalAmount,
            status: BookingStatus.PENDING,
            holdExpiresAt: holdExpiresAt,
            paymentChoice: paymentChoice as PaymentType,
            participantCount: participantCount,
            discountCodeId: discountCodeRecord?.id ?? null,
          },
        });

        return { booking: createdBooking, finalAmount };
      },
      { 
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000, // 10 second timeout for transaction
      }
    );

    const { booking: createdBooking, finalAmount } = booking;

    // ⚠️ CRITICAL SECURITY CHECK [PAYMENT_INTEGRITY]: Server-side Stripe price_data
    // Create Stripe checkout session with server-calculated pricing
    const unitAmount = decimalToStripeCents(finalAmount);

    if (unitAmount <= 0) {
      await prisma.booking.delete({ where: { id: createdBooking.id } });
      return {
        success: false,
        error: "Invalid payment amount calculated",
        code: "INVALID_AMOUNT",
      };
    }

    // Stripe session expires in 30 minutes (minimum allowed)
    const stripeExpiresAt = Math.floor((Date.now() + 30 * 60 * 1000) / 1000);

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${room.name} - ${participantCount} participants`,
              description: `Booking from ${slotStart.toLocaleString()} to ${slotEnd.toLocaleString()}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/rooms/${room.slug}`,
      // ⚠️ CRITICAL SECURITY CHECK [PAYMENT_INTEGRITY]: Secure metadata for webhook validation
      metadata: {
        bookingId: createdBooking.id,
        userId: user.id,
        paymentType: paymentChoice,
      },
      expires_at: stripeExpiresAt,
      client_reference_id: createdBooking.id,
    });

    if (!checkoutSession.url) {
      await prisma.booking.delete({ where: { id: createdBooking.id } });
      logError("createBookingCheckout", "Stripe session created without URL", {
        sessionId: checkoutSession.id,
        bookingId: createdBooking.id,
      });
      return {
        success: false,
        error: "Failed to create payment session",
        code: "STRIPE_ERROR",
      };
    }

    // Update booking with Stripe session ID
    await prisma.booking.update({
      where: { id: createdBooking.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    // Revalidate relevant pages
    revalidatePath('/account');
    revalidatePath(`/rooms/${room.slug}`);

    return {
      success: true,
      data: {
        url: checkoutSession.url,
        bookingId: createdBooking.id,
      },
    };

  } catch (error) {
    // Handle specific transaction errors
    if (error instanceof Error) {
      if (error.message === "SLOT_UNAVAILABLE") {
        return {
          success: false,
          error: "Selected time slot is no longer available",
          code: "SLOT_UNAVAILABLE",
        };
      }
      
      if (error.message.startsWith("DISCOUNT_INVALID:")) {
        const discountError = error.message.replace("DISCOUNT_INVALID: ", "");
        return {
          success: false,
          error: `Discount code invalid: ${discountError}`,
          code: "DISCOUNT_INVALID",
        };
      }
    }

    logError("createBookingCheckout", "Unexpected error", {
      roomId,
      participantCount,
      paymentChoice,
      userId: user.id,
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: "Failed to create booking checkout",
      code: "INTERNAL_ERROR",
    };
  }
}