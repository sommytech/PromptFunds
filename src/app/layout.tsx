import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Prompt Funds — Save, earn interest, borrow fairly", template: "%s · Prompt Funds" },
  description: "Free-to-join member savings and loans. Register online, deposit any amount, earn interest and apply for loans from your phone.",
  applicationName: "Prompt Funds",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0E7C66" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body>{children}</body>
    </html>
  );
}
