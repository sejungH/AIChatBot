import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Story Weaver",
  description: "Gemini 기반 캐릭터 롤플레잉",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}