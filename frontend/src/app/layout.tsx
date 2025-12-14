import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/common/ToastContext';

const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-family',
});

export const metadata: Metadata = {
  title: 'Admin Panel',
  description: 'Administration Panel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${rubik.variable} font-sans antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
