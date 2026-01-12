import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ComponentProps, useEffect, useState } from "react";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by rendering children immediately
  // but only applying theme after mount
  return (
    <NextThemesProvider {...props} disableTransitionOnChange>
      {mounted ? children : <div style={{ visibility: "hidden" }}>{children}</div>}
    </NextThemesProvider>
  );
}
