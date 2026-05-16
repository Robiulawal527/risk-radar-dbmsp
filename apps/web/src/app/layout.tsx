import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/providers';
import { Toaster } from 'sonner';
import { Shield } from 'lucide-react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'Risk Radar | See the risk, avoid danger. Build meaningful connections.',
  description:
    "Bangladesh's premier crime intelligence and community safety platform. Real-time heatmaps, analytics, SOS, and trusted social connections.",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-[#070b14] text-white`}>
        <Providers>
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            className="glass !bg-slate-900/90"
          />
        </Providers>
      </body>
    </html>
  );
}
