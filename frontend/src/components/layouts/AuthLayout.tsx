interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">Admin Panel</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
