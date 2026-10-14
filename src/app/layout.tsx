import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Gradely Diagnostics",
  title: { default: "Gradely Diagnostics", template: "%s | Gradely Diagnostics" },
  description: "Tutor-led diagnostic assessments, learning reports, and personalised learning plans from Gradely.",
  keywords: ["Gradely", "learning diagnostics", "student assessment", "learning plans", "education"],
  authors: [{ name: "Gradely" }],
  creator: "Gradely",
  publisher: "Gradely",
  robots: { index: false, follow: false },
  icons: { icon: "/gradely-logo.png", apple: "/gradely-logo.png" },
  openGraph: { title: "Gradely Diagnostics", description: "Tutor-led diagnostic assessments and personalised learning plans.", siteName: "Gradely Diagnostics", type: "website", images: [{ url: "/gradely-logo.png", alt: "Gradely logo" }] },
  twitter: { card: "summary", title: "Gradely Diagnostics", description: "Tutor-led diagnostic assessments and personalised learning plans.", images: ["/gradely-logo.png"] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
