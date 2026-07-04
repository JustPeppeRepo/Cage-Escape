import { z } from "zod";
import { ScheduleOverrideType } from "@/generated/prisma/client";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const roomFormSchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(slugRegex, "Slug non valido (solo minuscole, numeri e trattini)"),
  name: z.string().min(2).max(120),
  description: z.string().min(10).max(2000),
  prezzoTotale: z.coerce.number().positive(),
  prezzoCaparra: z.coerce.number().positive(),
  durationMinutes: z.coerce.number().int().min(30).max(240),
  minPlayers: z.coerce.number().int().min(1).max(20),
  maxPlayers: z.coerce.number().int().min(1).max(20),
  terrorLevel: z.coerce.number().int().min(1).max(5),
  isActive: z
    .union([z.literal("true"), z.literal("false"), z.literal("on")])
    .optional()
    .transform((value) => value === "true" || value === "on"),
});

export const pricingTierFormSchema = z.object({
  roomId: z.string().min(1),
  tierId: z.string().optional(),
  minParticipants: z.coerce.number().int().min(1).max(20),
  maxParticipants: z.coerce.number().int().min(1).max(20),
  totalPrice: z.coerce.number().positive(),
  depositPrice: z.coerce.number().positive(),
});

export const scheduleOverrideFormSchema = z
  .object({
    id: z.string().optional(),
    date: z.string().regex(dateRegex, "Formato data non valido (YYYY-MM-DD)"),
    roomId: z.string().optional().or(z.literal("")),
    type: z.enum([ScheduleOverrideType.CLOSED, ScheduleOverrideType.CUSTOM_HOURS]),
    openHour: z.coerce.number().int().min(0).max(23).optional(),
    closeHour: z.coerce.number().int().min(1).max(24).optional(),
    reason: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === ScheduleOverrideType.CUSTOM_HOURS) {
      if (data.openHour === undefined || data.closeHour === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["openHour"],
          message: "Orari obbligatori per orario personalizzato",
        });
      } else if (data.openHour >= data.closeHour) {
        ctx.addIssue({
          code: "custom",
          path: ["closeHour"],
          message: "L'orario di chiusura deve essere successivo all'apertura",
        });
      }
    }
  });

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
});

export const siteSettingsFormSchema = z.object({
  easterEggDiscountEnabled: z
    .union([z.literal("true"), z.literal("false"), z.literal("on")])
    .optional()
    .transform((value) => value === "true" || value === "on"),
  easterEggDiscountPercent: z.coerce.number().int().min(1).max(50),
});

export const contactFormSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.string().max(200).optional(),
  message: z.string().min(10).max(5000),
});

export const contactMessageIdSchema = z.object({
  messageId: z.string().min(1),
});

export const setContactMessageReadSchema = z.object({
  messageId: z.string().min(1),
  read: z.union([z.literal("true"), z.literal("false")]).transform((value) => value === "true"),
});

export const generateDiscountCodeSchema = z.object({
  puzzleAnswer: z.string().min(1).max(50),
});

export const reviewFormSchema = z.object({
  id: z.string().optional(),
  author: z.string().min(1).max(64),
  quote: z.string().min(5).max(500),
  rotation: z.coerce.number().int().min(-10).max(10),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isPublished: z
    .union([z.literal("true"), z.literal("false"), z.literal("on")])
    .optional()
    .transform((value) => value === "true" || value === "on"),
});

export const deleteReviewSchema = z.object({
  reviewId: z.string().min(1),
});

export type RoomFormInput = z.infer<typeof roomFormSchema>;
export type PricingTierFormInput = z.infer<typeof pricingTierFormSchema>;
export type ScheduleOverrideFormInput = z.infer<typeof scheduleOverrideFormSchema>;
export type SiteSettingsFormInput = z.infer<typeof siteSettingsFormSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type ContactMessageIdInput = z.infer<typeof contactMessageIdSchema>;
export type SetContactMessageReadInput = z.infer<typeof setContactMessageReadSchema>;
export type ReviewFormInput = z.infer<typeof reviewFormSchema>;
