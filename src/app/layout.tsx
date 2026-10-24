import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Inter } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SoonerTogether — Learn Together. Grow Together. Belong Together.",
    template: "%s · SoonerTogether",
  },
  description:
    "A student-built peer tutoring and study-circle platform for OU students. We don't just match students with answers. We match them with people.",
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} ${caveat.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
