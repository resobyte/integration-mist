'use client';

import { Button } from '@/components/common/Button';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-6xl font-bold text-red-600">Error</h1>
              <h2 className="text-2xl font-semibold text-gray-900">Bir şeyler ters gitti</h2>
              <p className="text-gray-600 max-w-md">
                Kritik bir hata oluştu. Lütfen tekrar deneyin.
              </p>
            </div>
            <Button onClick={reset}>Tekrar Dene</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
