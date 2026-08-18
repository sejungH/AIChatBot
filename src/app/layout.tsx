import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Story Weaver",
  description: "Gemini 기반 캐릭터 롤플레잉",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><head><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" referrerPolicy="no-referrer" /></head><body>{children}</body></html>;
}