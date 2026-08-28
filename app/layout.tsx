import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    title: "ClearSignal | Endotoxin Testing, Resolved",
    description: "A clear, connected path from sample preparation to defensible endotoxin test results.",
    openGraph: { title: "ClearSignal | From unknown sample to clear result", description: "Endotoxin testing, resolved.", type: "website", images: [{ url: socialImage, width: 1728, height: 909, alt: "ClearSignal sample-to-answer assay visualization" }] },
    twitter: { card: "summary_large_image", title: "ClearSignal", description: "From unknown sample to clear result.", images: [socialImage] },
  };
}

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
