import { type ReactNode } from "react";

type PageKey =
  | "landing"
  | "login"
  | "forgotPassword"
  | "resetPassword"
  | "dashboard"
  | "households"
  | "cars"
  | "audit"
  | "reports"
  | "imports"
  | "review";

const pageTitles: Record<PageKey, string> = {
  landing: "A clearer workspace for CAR operations.",
  login: "Sign in to your account",
  forgotPassword: "Reset your password",
  resetPassword: "Update your password",
  dashboard: "Operations at a glance",
  households: "Households",
  cars: "Case Assessment Reports",
  audit: "Audit trail",
  reports: "Annex C report generator",
  imports: "Excel imports",
  review: "CAR review",
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse bg-[#e6e0d4] ${className}`} />;
}

function SkeletonCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={`border border-[#c9c3b6] bg-[#fbf9f4] p-4 ${className}`}>
      {children}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div
        aria-hidden="true"
        className="mt-6 flex flex-wrap items-center justify-between gap-2 border-y border-[#161512] bg-[#ece7dc] px-4 py-2.5"
      >
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-3 w-44" />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonCard key={index} className="min-h-32">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-4 h-8 w-16" />
          </SkeletonCard>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="grid gap-5">
          <SkeletonCard className="min-h-64">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="mt-6 h-40 w-full" />
          </SkeletonCard>
          <SkeletonCard className="min-h-44">
            <SkeletonBlock className="h-4 w-32" />
            <div className="mt-6 grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonBlock key={index} className="h-16" />
              ))}
            </div>
          </SkeletonCard>
        </div>
        <SkeletonCard className="min-h-[28rem]">
          <SkeletonBlock className="h-4 w-40" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="border-b border-[#e2ddd1] pb-4">
                <SkeletonBlock className="h-3 w-3/4" />
                <SkeletonBlock className="mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </>
  );
}

function HouseholdsSkeleton() {
  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index}>
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="mt-3 h-7 w-14" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="mt-5">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
          <SkeletonBlock className="h-11" />
          <SkeletonBlock className="h-11" />
          <SkeletonBlock className="h-11" />
        </div>
      </SkeletonCard>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.7fr)]">
        <SkeletonCard className="min-h-96">
          <SkeletonBlock className="h-4 w-32" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonBlock key={index} className="h-14 w-full" />
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard className="min-h-96">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="mt-5 h-24 w-full" />
          <SkeletonBlock className="mt-5 h-4 w-36" />
          <SkeletonBlock className="mt-3 h-40 w-full" />
        </SkeletonCard>
      </div>
    </>
  );
}

function CarsSkeleton() {
  return (
    <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(245px,0.72fr)_minmax(0,1.8fr)]">
      <SkeletonCard className="min-h-[34rem]">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="mt-5 h-10 w-full" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonBlock key={index} className="h-16 w-full" />
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard className="min-h-[46rem]">
        <SkeletonBlock className="h-7 w-60" />
        <SkeletonBlock className="mt-4 h-12 w-full" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index}>
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="mt-2 h-10 w-full" />
            </div>
          ))}
        </div>
        <SkeletonBlock className="mt-6 h-48 w-full" />
      </SkeletonCard>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <>
      <div className="mt-5 grid gap-3 border-y border-[#c9c3b6] py-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-2 h-11 w-full" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.5fr)]">
        <SkeletonCard className="min-h-[30rem]">
          <SkeletonBlock className="h-5 w-32" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonBlock key={index} className="h-16 w-full" />
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard className="min-h-64">
          <SkeletonBlock className="h-5 w-28" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="mt-2 h-4 w-36" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </>
  );
}

function ReportsSkeleton() {
  return (
    <>
      <div className="mt-5 flex flex-wrap items-end gap-4">
        <SkeletonBlock className="h-[3.75rem] min-w-[260px] flex-1" />
        <SkeletonBlock className="h-10 w-48" />
      </div>
      <SkeletonCard className="mt-6 min-h-[50rem]">
        <SkeletonBlock className="mx-auto h-7 w-3/4" />
        <SkeletonBlock className="mx-auto mt-3 h-4 w-1/2" />
        <div className="mt-10 space-y-5">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index}>
              <SkeletonBlock className="h-4 w-1/3" />
              <SkeletonBlock className="mt-2 h-12 w-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </>
  );
}

function NoticeSkeleton() {
  return (
    <SkeletonCard className="min-h-40 max-w-[680px] border-l-4 border-l-[#c9c3b6]">
      <SkeletonBlock className="h-3 w-32" />
      <SkeletonBlock className="mt-4 h-7 w-56" />
      <SkeletonBlock className="mt-4 h-4 w-full" />
      <SkeletonBlock className="mt-2 h-4 w-4/5" />
    </SkeletonCard>
  );
}

function LandingSkeleton() {
  return (
    <>
      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
        <div>
          <SkeletonBlock className="h-3 w-44" />
          <SkeletonBlock className="mt-6 h-24 w-full max-w-xl" />
          <SkeletonBlock className="mt-4 h-4 w-full max-w-lg" />
          <SkeletonBlock className="mt-2 h-4 w-4/5 max-w-lg" />
          <SkeletonBlock className="mt-8 h-12 w-56" />
        </div>
        <SkeletonCard className="min-h-80">
          <SkeletonBlock className="h-4 w-40" />
          <div className="mt-6 space-y-6">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="border-b border-[#e2ddd1] pb-4">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="mt-2 h-3 w-full" />
                <SkeletonBlock className="mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
      <SkeletonBlock className="h-32 w-full" />
    </>
  );
}

function AccountFormSkeleton({
  passwordOnly = false,
  emailOnly = false,
}: {
  passwordOnly?: boolean;
  emailOnly?: boolean;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <SkeletonCard className="w-full max-w-md p-6 sm:p-8">
        <SkeletonBlock className="h-7 w-48" />
        <SkeletonBlock className="mt-3 h-4 w-40" />
        {!passwordOnly && (
          <>
            <SkeletonBlock className="mt-8 h-3 w-28" />
            <SkeletonBlock className="mt-2 h-11 w-full" />
          </>
        )}
        {!emailOnly && (
          <>
            <SkeletonBlock className="mt-6 h-3 w-24" />
            <SkeletonBlock className="mt-2 h-11 w-full" />
          </>
        )}
        <SkeletonBlock className="mt-6 h-11 w-full" />
      </SkeletonCard>
    </div>
  );
}

function PageSkeletonContent({ page }: { page: PageKey }) {
  switch (page) {
    case "landing":
      return <LandingSkeleton />;
    case "login":
      return <AccountFormSkeleton />;
    case "forgotPassword":
      return <AccountFormSkeleton emailOnly />;
    case "resetPassword":
      return <AccountFormSkeleton passwordOnly />;
    case "dashboard":
      return <DashboardSkeleton />;
    case "households":
      return <HouseholdsSkeleton />;
    case "cars":
      return <CarsSkeleton />;
    case "audit":
      return <AuditSkeleton />;
    case "reports":
      return <ReportsSkeleton />;
    default:
      return <NoticeSkeleton />;
  }
}

export function PageDataSkeleton({
  page,
}: {
  page: "dashboard" | "households" | "cars" | "audit" | "reports";
}) {
  return (
    <div role="status" aria-label={`Loading ${pageTitles[page]}`} aria-busy="true">
      <PageSkeletonContent page={page} />
    </div>
  );
}

export function RouteLoadingSkeleton({ pathname }: { pathname: string }) {
  const page: PageKey = pathname === "/"
    ? "landing"
    : pathname.startsWith("/login")
      ? "login"
      : pathname.startsWith("/forgot-password")
        ? "forgotPassword"
        : pathname.startsWith("/reset-password")
          ? "resetPassword"
          : pathname.startsWith("/households")
            ? "households"
            : pathname.startsWith("/cars")
              ? "cars"
              : pathname.startsWith("/audit")
                ? "audit"
                : pathname.startsWith("/templates")
                  ? "reports"
                  : pathname.startsWith("/imports")
                    ? "imports"
                    : pathname.startsWith("/review")
                      ? "review"
                      : "dashboard";

  if (page === "landing") {
    return (
      <div
        role="status"
        aria-label={`Loading ${pageTitles[page]}`}
        aria-busy="true"
        className="min-h-screen bg-[#f4f1ea] text-[#161512]"
      >
        <header className="border-b border-[#161512]">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-5 sm:px-6">
            <span className="font-serif text-xl">Annex C</span>
            <SkeletonBlock className="h-9 w-28" />
          </div>
        </header>
        <PageSkeletonContent page={page} />
      </div>
    );
  }

  if (page === "login" || page === "forgotPassword" || page === "resetPassword") {
    return (
      <main
        role="status"
        aria-label={`Loading ${pageTitles[page]}`}
        aria-busy="true"
        className="min-h-screen bg-[#f4f1ea] text-[#161512]"
      >
        <PageSkeletonContent page={page} />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#161512]">
      <header className="border-b border-[#161512] py-4">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 sm:px-6">
          <span className="font-serif text-xl leading-none">Annex C</span>
          {/* Mirrors the account unit: identity cell + sign-out cell. */}
          <SkeletonBlock className="h-[46px] w-56" />
        </div>
      </header>
      <main
        role="status"
        aria-label={`Loading ${pageTitles[page]}`}
        aria-busy="true"
        className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10"
      >
        <div className="border-b border-[#161512] pb-5">
          <SkeletonBlock className="h-3 w-28" />
          <h1 className="mt-3 font-serif text-4xl leading-none tracking-tight sm:text-5xl">
            {pageTitles[page]}
          </h1>
          <SkeletonBlock className="mt-4 h-4 w-2/3" />
        </div>
        <PageSkeletonContent page={page} />
      </main>
    </div>
  );
}
