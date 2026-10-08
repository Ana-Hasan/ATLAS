import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STAGE_CONFLICT"
  | "ILLEGAL_TRANSITION"
  | "DUPLICATE_PROPERTY"
  | "PRECONDITION_FAILED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "INTERNAL";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorPayload(code: ErrorCode, message: string, requestId: string, details: Record<string, unknown> = {}) {
  return { error: { code, message, details, request_id: requestId } };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(errorPayload("NOT_FOUND", "Route not found", req.requestId));
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    if (res.headersSent) return;

    const candidate = error as { status?: number; statusCode?: number; type?: string; message?: string };
    let status = 500;
    let code: ErrorCode = "INTERNAL";
    let message = "Internal server error";
    let details: Record<string, unknown> = {};

    if (error instanceof ApiError) {
      status = error.status;
      code = error.code;
      message = error.message;
      details = error.details;
    } else if (candidate.type === "entity.too.large" || candidate.status === 413 || candidate.statusCode === 413) {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "Request body exceeds the allowed size";
    } else if (candidate.type === "entity.parse.failed" || error instanceof SyntaxError) {
      status = 400;
      code = "VALIDATION_FAILED";
      message = "Malformed JSON request body";
    }

    if (status >= 500) {
      logger.error({ request_id: req.requestId, err: error }, "Request failed");
    }

    res.status(status).json(errorPayload(code, message, req.requestId, details));
  };
}
