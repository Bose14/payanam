import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { addExpense, getExpenses, deleteExpense } from '../services/expense.service';

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
