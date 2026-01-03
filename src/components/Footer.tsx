import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="py-8 border-t border-border bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} InFlow. Built for instructional designers.
          </p>
        </div>
      </div>
    </footer>
  );
}
