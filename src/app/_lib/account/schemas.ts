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
  email: z.string().email("Email non valida"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token mancante o non valido"),
  newPassword: z.string().min(8, "La password deve avere almeno 8 caratteri").max(72),
});

export const deleteAccountSchema = z.object({
  confirmEmail: z.string().email("Email non valida"),
  password: z.string().min(8).max(72),
});
