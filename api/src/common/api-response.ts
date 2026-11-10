import type { Response } from "express";
import type { Paginated, PaginationMeta } from "./pagination";

export type { Paginated, PaginationMeta } from "./pagination";

// Every API response uses one of these two shapes; `success` discriminates them.
export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiError {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

type SuccessOptions = {
  status?: number;
  message?: string;
  meta?: Record<string, unknown>;
};

export function sendSuccess<T>(res: Response, data: T, { status = 200, message, meta }: SuccessOptions = {}) {
  const body: ApiSuccess<T> = { success: true, message, data, meta };
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string) {
  sendSuccess(res, data, { status: 201, message });
}

export function sendPaginated<T>(res: Response, { data, page, limit, total }: Paginated<T>, message?: string) {
  const meta: PaginationMeta = { page, limit, total, totalPages: Math.ceil(total / limit) };
  sendSuccess(res, data, { message, meta: { ...meta } });
}

export function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  const body: ApiError = { success: false, error: { code, message, details } };
  res.status(status).json(body);
}
