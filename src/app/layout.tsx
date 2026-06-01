import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Syne } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const syne = Syne({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Biomedic OMS - Order Management System',
  description: 'Biomedic Consulting Order Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${syne.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F3F3F3]">{children}</body>
    </html>
  );
}
