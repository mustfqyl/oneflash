import { Outfit, DM_Sans } from "next/font/google";
import CloudPreviewServiceWorker from "@/components/cloud/CloudPreviewServiceWorker";
import ThemeScript from "@/components/theme/ThemeScript";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata = {
  title: "oneflash — Your unified cloud flash drive",
  description: "Manage Google Drive and OneDrive from a single beautiful interface.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${outfit.variable} ${dmSans.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-blue-500/30">
        <ThemeScript />
        <CloudPreviewServiceWorker />
        {children}
      </body>
    </html>
  );
}
