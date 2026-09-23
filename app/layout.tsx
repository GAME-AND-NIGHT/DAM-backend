import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAM Streaming & Encrypted Backend",
  description: "Next.js backend for encrypted streaming media (paintings & 3D models) with segmented transfer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
        ></script>
      </head>
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
