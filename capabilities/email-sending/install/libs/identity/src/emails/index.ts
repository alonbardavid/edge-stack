import type { EmailTemplate } from "@lib/email-ds";
import VerifyEmail, {
  subject as verifyEmailSubject,
  type VerifyEmailProps,
} from "./verify-email";
import ResetPassword, {
  subject as resetPasswordSubject,
  type ResetPasswordProps,
} from "./reset-password";

export const verifyEmail: EmailTemplate<VerifyEmailProps> = {
  subject: () => verifyEmailSubject,
  Body: VerifyEmail,
};

export const resetPassword: EmailTemplate<ResetPasswordProps> = {
  subject: () => resetPasswordSubject,
  Body: ResetPassword,
};
