import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="py-12 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-white/10 rounded-lg p-1.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-white"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  fill="currentColor"
                  opacity="0.9"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-bold text-xl">
              In<span className="text-accent">Flow</span>
            </span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <a
              href="#features"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#workflow"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Workflow
            </a>
            <a
              href="#pricing"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Pricing
            </a>
            <a
              href="#contact"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Contact
            </a>
          </nav>

          <div className="text-sm text-primary-foreground/60">
            © {new Date().getFullYear()} InFlow. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
