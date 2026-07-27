import { z } from "zod";
import { AVATAR_IDS } from "@/app/_lib/account/avatars";

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(32),
  phone: z.string().trim().min(10, "Telefono non valido").max(20),
  avatarId: z.enum(AVATAR_IDS, { message: "Avatar non valido" }),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(72),
  newPassword: z.string().min(8, "La nuova password deve avere almeno 8 caratteri").max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email non valida").max(255),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token mancante o non valido").max(512),
    newPassword: z
      .string()
      .min(8, "La password deve avere almeno 8 caratteri")
      .max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });

export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().email("Email non valida").max(255),
  password: z.string().min(8).max(72),
});
