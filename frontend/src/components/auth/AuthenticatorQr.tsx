import { QRCodeSVG } from 'qrcode.react';

/** The authenticator set-up as a QR code to scan. Drawn in the browser, so the secret never goes to another service. */
export function AuthenticatorQr({ uri }: { uri: string }) {
  return (
    <div className="inline-flex rounded-xl bg-white p-3 ring-1 ring-navy-100" data-authenticator-qr>
      <QRCodeSVG value={uri} size={168} level="M" marginSize={0} title="QR code for your authenticator app" />
    </div>
  );
}
