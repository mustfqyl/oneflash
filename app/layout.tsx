import { Outfit, DM_Sans } from "next/font/google";
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
  description: "Manage Google Drive, OneDrive, and iCloud from a single beautiful interface.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable} dark`}>
      <body className="font-sans bg-black text-white antialiased selection:bg-blue-500/30 min-h-screen">
        {children}
      </body>
    </html>
  );
}
