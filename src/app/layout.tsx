import type { Metadata } from "next";
import Providers from "@/components/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPI OAuth2 Demo",
  description: "OAuth2 authentication with Google and GitHub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
