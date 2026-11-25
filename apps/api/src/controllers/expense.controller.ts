import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  addExpense,
  updateExpense,
  getExpenses,
  deleteExpense,
  toggleSplitSettled,
  recordSettlement,
} from '../services/expense.service';

export async function addExpenseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, amount, category = 'other', paid_by, split_type = 'equal', split_among, custom_splits } = req.body;
    if (!title || !amount || !paid_by) {
      return sendError(res, 'title, amount, paid_by are required', 400, 'VALIDATION_ERROR');
    }
    if (split_type !== 'equal' && split_type !== 'custom') {
      return sendError(res, 'split_type must be equal or custom', 400, 'VALIDATION_ERROR');
    }
    const expense = await addExpense(req.params.id, req.userId!, {
      title, amount: parseFloat(amount), category, paid_by, split_type, split_among, custom_splits,
    });
    return sendSuccess(res, { expense }, 201);
  } catch (err) { next(err); }
}

export async function updateExpenseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, amount, category = 'other', paid_by, split_type = 'equal', split_among, custom_splits } = req.body;
    if (!title || !amount || !paid_by) {
      return sendError(res, 'title, amount, paid_by are required', 400, 'VALIDATION_ERROR');
    }
    if (split_type !== 'equal' && split_type !== 'custom') {
      return sendError(res, 'split_type must be equal or custom', 400, 'VALIDATION_ERROR');
    }
    const parsed = parseFloat(amount);
    if (!(parsed > 0)) return sendError(res, 'amount must be greater than 0', 400, 'VALIDATION_ERROR');
    const expense = await updateExpense(req.params.id, req.params.expenseId, req.userId!, {
      title, amount: parsed, category, paid_by, split_type, split_among, custom_splits,
    });
    return sendSuccess(res, { expense });
  } catch (err) { next(err); }
}

export async function getExpensesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const expenses = await getExpenses(req.params.id, req.userId!);
    return sendSuccess(res, { expenses });
  } catch (err) { next(err); }
}

export async function deleteExpenseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteExpense(req.params.expenseId, req.userId!);
    return sendSuccess(res, { message: 'Expense deleted' });
  } catch (err) { next(err); }
}

export async function toggleSplitSettledHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const split = await toggleSplitSettled(req.params.splitId, req.userId!);
    return sendSuccess(res, { split });
  } catch (err) { next(err); }
}

export async function recordSettlementHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { fromUserId, toUserId, amount, notes } = req.body;
    if (!fromUserId || !toUserId || !amount) {
      return sendError(res, 'fromUserId, toUserId, and amount are required', 400, 'VALIDATION_ERROR');
    }
    const expense = await recordSettlement(req.params.id, req.userId!, {
      fromUserId,
      toUserId,
      amount: parseFloat(amount),
      notes,
    });
    return sendSuccess(res, { expense }, 201);
  } catch (err) { next(err); }
}
