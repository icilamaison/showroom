import type { Response } from "express";

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors?: Record<string, string>;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data };
}

export function errorResponse(
  message: string,
  errors?: Record<string, string>,
): ApiErrorResponse {
  const body: ApiErrorResponse = { success: false, message };

  if (errors && Object.keys(errors).length > 0) {
    body.errors = errors;
  }

  return body;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
): Response<ApiSuccessResponse<T>> {
  return res.status(statusCode).json(successResponse(data));
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string>,
): Response<ApiErrorResponse> {
  return res.status(statusCode).json(errorResponse(message, errors));
}
