import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../utils/response';
import * as chat from '../services/chat.service';

const sendSchema = z.object({
  kind: z.enum(['text', 'location']).optional(),
  body: z.string().max(2000).optional(),
  place: z.string().max(120).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
const groupSchema = z.object({ name: z.string().trim().min(2).max(100) });
const joinSchema = z.object({ code: z.string().trim().min(4).max(12) });
const respondSchema = z.object({ action: z.enum(['accept', 'decline']) });
const uuidSchema = z.string().uuid();

type H = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: H) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

export const listConversations = wrap(async (req, res) => sendSuccess(res, { conversations: await chat.listConversations(req.userId!) }));
export const unread = wrap(async (req, res) => sendSuccess(res, await chat.unreadCount(req.userId!, req.query.stopsOnly === 'true')));
export const contacts = wrap(async (req, res) => sendSuccess(res, { contacts: await chat.listContacts(req.userId!) }));
export const messages = wrap(async (req, res) =>
  sendSuccess(res, await chat.getMessages(String(req.query.key), req.userId!, req.query.since ? String(req.query.since) : undefined)));
export const send = wrap(async (req, res) =>
  sendSuccess(res, { message: await chat.sendMessage(String(req.query.key), req.userId!, sendSchema.parse(req.body)) }, 201));
export const confirmStop = wrap(async (req, res) =>
  sendSuccess(res, await chat.confirmStop(String(req.query.key), req.userId!, uuidSchema.parse(req.params.messageId))));
export const createGroup = wrap(async (req, res) =>
  sendSuccess(res, await chat.createGroup(req.userId!, groupSchema.parse(req.body).name), 201));
export const joinGroup = wrap(async (req, res) =>
  sendSuccess(res, await chat.requestToJoinGroup(req.userId!, joinSchema.parse(req.body).code)));
export const getGroup = wrap(async (req, res) =>
  sendSuccess(res, await chat.getGroup(req.userId!, uuidSchema.parse(req.params.id))));
export const respondGroup = wrap(async (req, res) =>
  sendSuccess(res, await chat.respondToGroupRequest(req.userId!, uuidSchema.parse(req.params.id),
    uuidSchema.parse(req.params.userId), respondSchema.parse(req.body).action)));
