import { authenticator } from "otplib";
import QRCode from "qrcode";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

export async function generateTotpQrCode(
  email: string,
  secret: string
): Promise<string> {
  const otpUrl = authenticator.keyuri(email, "Ecommerce Admin", secret);
  return QRCode.toDataURL(otpUrl);
}
