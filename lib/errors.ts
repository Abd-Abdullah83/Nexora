export const ErrorCodes = {
  AUTH_REQUIRED: {
    status: 401,
    message: "You must be logged in to perform this action.",
  },
  AUTH_INVALID_CREDENTIALS: {
    status: 401,
    message: "Your email or password is incorrect. Please try again.",
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    status: 403,
    message: "Please verify your email before logging in. Check your inbox.",
  },
  AUTH_ACCOUNT_LOCKED: {
    status: 423,
    message: "Account locked after 5 failed attempts. Try again in 15 minutes.",
  },
  AUTH_TOKEN_EXPIRED: {
    status: 401,
    message: "This link has expired. Please request a new one.",
  },
  AUTH_2FA_REQUIRED: {
    status: 403,
    message: "Please enter your authenticator code to continue.",
  },
  AUTH_2FA_INVALID: {
    status: 401,
    message: "That authenticator code is incorrect. Please try again.",
  },
  AUTH_EMAIL_EXISTS: {
    status: 409,
    message: "An account with this email already exists.",
  },
  AUTH_USERNAME_EXISTS: {
    status: 409,
    message: "This username is already taken. Please choose another.",
  },
  PRODUCT_NOT_FOUND: {
    status: 404,
    message: "This product does not exist or has been removed.",
  },
  PRODUCT_OUT_OF_STOCK: {
    status: 409,
    message: "Sorry, this product is currently out of stock.",
  },
  CART_ITEM_EXCEEDS_STOCK: {
    status: 409,
    message: "Only a limited quantity is available. Please reduce your quantity.",
  },
  CHECKOUT_PRICE_MISMATCH: {
    status: 409,
    message: "Prices were updated. Please review your cart before continuing.",
  },
  PAYMENT_FAILED: {
    status: 402,
    message: "Your payment did not go through. Please check your card details.",
  },
  COUPON_INVALID: {
    status: 404,
    message: "This coupon code is not valid or has expired.",
  },
  COUPON_LIMIT_REACHED: {
    status: 409,
    message: "This coupon has reached its usage limit.",
  },
  ADMIN_UNAUTHORISED: {
    status: 403,
    message: "You do not have permission to perform this action.",
  },
  UPLOAD_INVALID_TYPE: {
    status: 415,
    message: "Only JPEG, PNG, and WebP images are accepted.",
  },
  UPLOAD_TOO_LARGE: {
    status: 413,
    message: "Image must be smaller than 5 MB.",
  },
  VALIDATION_ERROR: {
    status: 422,
    message: "Please check the highlighted fields and try again.",
  },
  RATE_LIMIT_EXCEEDED: {
    status: 429,
    message: "Too many requests. Please wait a moment and try again.",
  },
  SERVER_ERROR: {
    status: 500,
    message: "Something went wrong on our end. We have been notified.",
  },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, details?: unknown) {
    const entry = ErrorCodes[code];
    super(entry.message);
    this.code = code;
    this.status = entry.status;
    this.details = details;
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status }
    );
  }

  // Never leak internal error details to the client.
  return Response.json(
    { error: { code: "SERVER_ERROR", message: ErrorCodes.SERVER_ERROR.message } },
    { status: 500 }
  );
}
