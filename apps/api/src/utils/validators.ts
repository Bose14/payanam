import { z } from 'zod';
import { validateEmail as validateEmailUtil, validatePassword as validatePasswordUtil } from '@payanam/utils';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .refine((email) => validateEmailUtil(email), 'Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((password) => {
      const validation = validatePasswordUtil(password);
      return validation.isValid;
    }, 'Password does not meet requirements'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must be less than 255 characters'),
});

export function validateLoginInput(data: unknown) {
  return loginSchema.parse(data);
}

export function validateRegisterInput(data: unknown) {
  return registerSchema.parse(data);
}
