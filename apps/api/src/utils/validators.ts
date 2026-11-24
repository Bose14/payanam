import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must be less than 255 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
});

export function validateLoginInput(data: unknown) {
  return loginSchema.parse(data);
}

export function validateRegisterInput(data: unknown) {
  return registerSchema.parse(data);
}

export function validateForgotPasswordInput(data: unknown) {
  return forgotPasswordSchema.parse(data);
}

export function validateResetPasswordInput(data: unknown) {
  return resetPasswordSchema.parse(data);
}

export const phoneRequestSchema = z.object({
  phone: z.string().min(10, 'Enter your mobile number').max(20),
});

export const phoneVerifySchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().regex(/^\d{4}$/, 'Enter the 4-digit code'),
});

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(255),
  city: z.string().trim().min(2, 'Choose your city').max(100),
  bike: z.string().trim().max(150).optional(),
  termsAccepted: z.boolean(),
  locationConsent: z.boolean(),
  recognitionOptIn: z.boolean().default(false),
});

export function validatePhoneRequestInput(data: unknown) {
  return phoneRequestSchema.parse(data);
}

export function validatePhoneVerifyInput(data: unknown) {
  return phoneVerifySchema.parse(data);
}

export function validateOnboardingInput(data: unknown) {
  return onboardingSchema.parse(data);
}
