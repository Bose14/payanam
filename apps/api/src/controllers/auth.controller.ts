import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  getUserById,
  exportUserData,
  deleteUserAccount,
  requestPasswordReset,
  resetPassword as resetPasswordService,
} from '../services/auth.service';
import {
  validateLoginInput,
  validateRegisterInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} from '../utils/validators';
import { sendSuccess } from '../utils/response';
import {
  requestPhoneCode,
  verifyPhoneCode,
  completeOnboarding,
} from '../services/phoneAuth.service';
import {
  validatePhoneRequestInput,
  validatePhoneVerifyInput,
  validateOnboardingInput,
} from '../utils/validators';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateRegisterInput(req.body);
    const authResponse = await registerUser(input.email, input.password, input.fullName);
    sendSuccess(res, authResponse, 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateLoginInput(req.body);
    const authResponse = await loginUser(input.email, input.password);
    sendSuccess(res, authResponse);
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) throw new Error('User ID not found in request');
    const user = await getUserById(req.userId);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateForgotPasswordInput(req.body);
    const result = await requestPasswordReset(input.email);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateResetPasswordInput(req.body);
    const result = await resetPasswordService(input.token, input.password);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function phoneRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validatePhoneRequestInput(req.body);
    sendSuccess(res, await requestPhoneCode(input.phone));
  } catch (error) {
    next(error);
  }
}

export async function phoneVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validatePhoneVerifyInput(req.body);
    sendSuccess(res, await verifyPhoneCode(input.phone, input.code));
  } catch (error) {
    next(error);
  }
}

export async function onboarding(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) throw new Error('User ID not found in request');
    const input = validateOnboardingInput(req.body);
    sendSuccess(res, await completeOnboarding(req.userId, input));
  } catch (error) {
    next(error);
  }
}

export async function exportMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) throw new Error('User ID not found in request');
    sendSuccess(res, await exportUserData(req.userId));
  } catch (error) {
    next(error);
  }
}

export async function deleteMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) throw new Error('User ID not found in request');
    sendSuccess(res, await deleteUserAccount(req.userId));
  } catch (error) {
    next(error);
  }
}
