/**
 * URL map for the marketing shell vs the product shell.
 * Keep paths stable: deep links and the browser back stack depend on them.
 */
export const PATHS = {
  landing: "/",
  overview: "/app",
  newPayment: "/app/pay",
  activity: "/app/activity",
  help: "/app/help",
  profile: "/app/profile",
} as const;

export type AppPage = keyof typeof PATHS;

export function pageFromPath(pathname: string): AppPage {
  if (pathname === PATHS.profile || pathname.startsWith(`${PATHS.profile}/`)) {
    return "profile";
  }
  if (pathname === PATHS.newPayment || pathname.startsWith(`${PATHS.newPayment}/`)) {
    return "newPayment";
  }
  if (pathname === PATHS.activity || pathname.startsWith(`${PATHS.activity}/`)) {
    return "activity";
  }
  if (pathname === PATHS.help || pathname.startsWith(`${PATHS.help}/`)) {
    return "help";
  }
  if (pathname === PATHS.overview || pathname.startsWith(`${PATHS.overview}/`)) {
    return "overview";
  }
  return "landing";
}

export function pathForPage(page: AppPage): string {
  return PATHS[page];
}

export function isKnownPath(pathname: string): boolean {
  return (Object.values(PATHS) as string[]).includes(pathname);
}
