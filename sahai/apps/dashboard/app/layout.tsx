import type { Metadata } from "next";
import { DashboardShell } from "../components/DashboardShell";
import { AuthProvider } from "../context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  description: "Sahai web dashboard for operational visibility.",
  title: "Sahai Dashboard"
};

/**
 * Provides the root document shell for every dashboard route.
 *
 * @param props - Root layout properties supplied by the Next.js App Router.
 * @param props.children - Route content rendered inside the dashboard shell.
 * @returns The HTML document structure for the dashboard.
 */
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <DashboardShell>{children}</DashboardShell>
        </AuthProvider>
      </body>
    </html>
  );
}
