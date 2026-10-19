import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://my-phms.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "PHMS — AI Plant Health Monitoring",
    template: "%s · PHMS",
  },
  description:
    "AI-powered plant health monitoring for maize & beans. An ESP32-S3-CAM captures photos and environmental telemetry; the PHMS AI scores plant health, diagnoses problems, and recommends actions on a live dashboard with trends and email alerts.",
  applicationName: "PHMS",
  keywords: [
    "plant health monitoring",
    "IoT agriculture",
    "smart farming",
    "ESP32-S3-CAM",
    "PHMS AI",
    "maize",
    "beans",
    "soil moisture",
    "crop health dashboard",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "PHMS",
    title: "PHMS — AI Plant Health Monitoring",
    description:
      "ESP32 camera + sensors, PHMS AI diagnosis, and a live dashboard with health scores, per-crop insights, trends, and email alerts for maize & beans.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PHMS — AI Plant Health Monitoring",
    description:
      "ESP32 camera + sensors, PHMS AI diagnosis, and a live dashboard with health scores, trends, and email alerts for maize & beans.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
