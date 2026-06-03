export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-mesh relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 start-1/4 w-72 h-72 rounded-full bg-brand-500/10 blur-[100px] animate-float" />
      <div className="absolute bottom-1/4 end-1/4 w-96 h-96 rounded-full bg-accent-500/10 blur-[100px] animate-float [animation-delay:2s]" />
      <div className="absolute top-1/2 start-1/2 w-64 h-64 rounded-full bg-brand-300/5 blur-[80px] animate-float [animation-delay:4s]" />

      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
