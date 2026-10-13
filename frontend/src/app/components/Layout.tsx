import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { BarChart3, ClipboardList, KeyRound, UserRound } from "lucide-react";
import { getSession, logout } from "../lib/auth";
import { isUserFeedPath, patientRoutes } from "../lib/patientRoutes";
import feedbackLogo from "./image/hospital_logo.png";
import { HOSPITAL } from "../lib/hospital";
import {
  applyBrandingTheme,
  getBrandingSettings,
  loadBrandingSettings,
  onBrandingSettingsChange,
  useModuleEnabled,
  useTicketingEnabled,
} from "../lib/branding";
import { FeedbackOutboxStatus } from "./FeedbackOutboxStatus";
import { HodChangePasswordDialog } from "./HodChangePasswordDialog";
import { MOBILE_NETWORK_BAR_OFFSET_CLASS, NetworkStatusIndicator } from "./NetworkStatusIndicator";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [branding, setBranding] = useState(() => getBrandingSettings());
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { enabled: ticketingEnabled } = useTicketingEnabled();
  const { enabled: departmentsEnabled } = useModuleEnabled("departmentsEnabled");
  const { enabled: servicesEnabled } = useModuleEnabled("servicesEnabled");

  const session = getSession();
  const capabilities = session?.capabilities ?? [];
  const canManageRoles = capabilities.includes("roles.manage");
  // Any role that can reach the admin console — no longer just the literal "admin".
  const isAdmin =
    capabilities.includes("users.manage") ||
    capabilities.includes("roles.manage") ||
    capabilities.includes("departments.manage") ||
    capabilities.includes("services.manage") ||
    capabilities.includes("settings.manage") ||
    capabilities.includes("branding.manage");
  const isHod = session?.role === "hod";
  const hodCanSeeOverview = isHod && capabilities.includes("insights.overview");
  const path = location.pathname;
  const isPatientKioskScreen = isUserFeedPath(path);
  const isStaffRoute =
    !isPatientKioskScreen &&
    (path.includes("staff") ||
    path.includes("dashboard") ||
    path.includes("management") ||
    path.includes("analytics") ||
    path.includes("ticket") ||
    path.includes("admin") ||
    path.startsWith("/hod/"));
  const showHeaderActions = Boolean(session) && isStaffRoute;
  const onInsightsArea =
    path.startsWith("/management") ||
    path === "/analytics" ||
    path === "/insights" ||
    path.startsWith("/admin/management-overview") ||
    path === "/admin/insights" ||
    path === "/admin/analytics";

  const showBottomNav =
    Boolean(session) &&
    !isHod &&
    !isAdmin &&
    (onInsightsArea ||
      [
        "/dashboard",
        "/staff",
        "/admin",
        "/admin/departments",
        "/admin/services",
        "/admin/users",
        "/admin/roles",
        "/admin/tickets",
        "/admin/settings",
        "/admin/bot-conversation",
      ].includes(path));

  const isAdminShell = isAdmin && path.startsWith("/admin");

  useEffect(() => {
    applyBrandingTheme(branding);
  }, [branding]);

  useEffect(() => {
    void loadBrandingSettings();
    return onBrandingSettingsChange(() => {
      setBranding(getBrandingSettings());
    });
  }, []);

  const activePrimaryStyle = { color: branding.primaryColor };
  const activePrimaryBackgroundStyle = {
    backgroundColor: branding.primaryColor,
    color: "#ffffff",
  };
  const appLogo = branding.logoDataUrl || feedbackLogo;

  const adminTabs = [
    { label: "Insights", to: "/admin/management-overview/submissions", active: onInsightsArea },
    { label: "Overview", to: "/admin", active: path === "/admin" || path === "/admin/delete" },
    departmentsEnabled && {
      label: "Departments",
      to: "/admin/departments",
      active: path === "/admin/departments",
    },
    servicesEnabled && { label: "Services", to: "/admin/services", active: path === "/admin/services" },
    { label: "Users", to: "/admin/users", active: path === "/admin/users" },
    canManageRoles && { label: "Roles", to: "/admin/roles", active: path === "/admin/roles" },
    ticketingEnabled && {
      label: "Tickets",
      to: "/admin/tickets",
      active: path.startsWith("/admin/tickets"),
    },
    { label: "Bot Q&A", to: "/admin/bot-conversation", active: path === "/admin/bot-conversation" },
    { label: "Settings", to: "/admin/settings", active: path === "/admin/settings" },
  ].filter((tab): tab is { label: string; to: string; active: boolean } => Boolean(tab));

  const outlineButton = (active: boolean) =>
    `shrink-0 whitespace-nowrap px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
      active ? "border-primary text-primary bg-brand-50" : "border-gray-300 text-gray-700 hover:bg-gray-100"
    }`;
  const solidButton =
    "shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200";

  const showSectionNav = !isPatientKioskScreen && showHeaderActions;
  // Plain staff already get these links in the mobile bottom bar.
  const sectionNavMobileHidden = !isAdmin && !isHod;

  let sectionNav: React.ReactNode = null;
  if (isAdminShell) {
    sectionNav = (
      <nav
        className="inline-flex flex-nowrap items-center gap-1 rounded-full border border-gray-200 bg-gray-100 p-1"
        role="tablist"
        aria-label="Admin sections"
      >
        {adminTabs.map((tab) => (
          <button
            key={tab.to}
            type="button"
            role="tab"
            aria-selected={tab.active}
            onClick={() => navigate(tab.to)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
              tab.active ? "shadow-sm" : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
            }`}
            style={tab.active ? activePrimaryBackgroundStyle : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    );
  } else if (isAdmin) {
    sectionNav = (
      <div className="flex flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/admin/management-overview/submissions")}
          className={solidButton}
          style={activePrimaryBackgroundStyle}
        >
          Insights
        </button>
        <button
          type="button"
          onClick={() => navigate("/management/submissions")}
          className={outlineButton(onInsightsArea)}
        >
          Operations
        </button>
        <button type="button" onClick={() => navigate(patientRoutes.home)} className={outlineButton(false)}>
          Patient View
        </button>
      </div>
    );
  } else if (isHod) {
    sectionNav = hodCanSeeOverview ? (
      <div className="flex flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/hod/overview")}
          className={outlineButton(path === "/hod/overview")}
        >
          Overview
        </button>
        {ticketingEnabled ? (
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className={outlineButton(path === "/dashboard")}
          >
            My queue
          </button>
        ) : null}
      </div>
    ) : null;
  } else {
    sectionNav = (
      <div className="flex flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(patientRoutes.home)}
          className={solidButton}
          style={activePrimaryBackgroundStyle}
        >
          Submit feedback
        </button>
        <button
          type="button"
          onClick={() => navigate("/management/submissions")}
          className={outlineButton(onInsightsArea)}
        >
          Insights
        </button>
        <button type="button" onClick={() => navigate(patientRoutes.home)} className={outlineButton(false)}>
          Patient View
        </button>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col ${MOBILE_NETWORK_BAR_OFFSET_CLASS}`}
      style={{ backgroundColor: branding.pageBackgroundColor }}
    >
      <NetworkStatusIndicator variant="mobile-fixed" />
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div
          aria-hidden="true"
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, ${branding.primaryColor} 0%, ${branding.primaryColor} 55%, ${branding.accentColor} 100%)`,
          }}
        />
        <div className="w-full max-w-[min(100%,1600px)] mx-auto px-3 sm:px-5 py-3 lg:py-4">
          {/*
            Brand, section nav and account actions share one wrapping row. Below 1536px (2xl) the
            section nav drops to its own full-width row and scrolls sideways if it still
            does not fit, so the header never pushes the page wider than the screen.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <div className="order-1 flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <img
                src={appLogo}
                alt={`${HOSPITAL.shortName} feedback system`}
                className="h-10 w-auto max-h-11 max-w-[min(140px,36vw)] shrink-0 object-contain sm:h-11 lg:h-12 lg:max-w-[180px]"
              />
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-gray-900 sm:text-lg lg:text-xl">
                  <span className={showSectionNav ? "sm:hidden 2xl:inline" : "sm:hidden"}>
                    {HOSPITAL.shortName}
                  </span>
                  <span
                    className={showSectionNav ? "hidden sm:inline 2xl:hidden" : "hidden sm:inline"}
                  >
                    {HOSPITAL.name}
                  </span>
                </h1>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A6A10] sm:text-[11px]">
                  Patient Feedback System
                </p>
              </div>
            </div>
            <div className="order-2 flex shrink-0 items-center gap-2 2xl:order-3">
              <NetworkStatusIndicator variant="inline" />
              {isHod && session ? (
                <button
                  type="button"
                  onClick={() => setChangePasswordOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-200 text-sm font-medium"
                >
                  <KeyRound className="h-4 w-4" />
                  <span className="hidden sm:inline">Change password</span>
                  <span className="sm:hidden">Password</span>
                </button>
              ) : null}
              {session ? (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-200 text-sm font-medium"
                >
                  Logout
                </button>
              ) : null}
            </div>
            {showSectionNav && sectionNav ? (
              <div
                className={`order-3 w-full min-w-0 2xl:order-2 2xl:w-auto ${
                  sectionNavMobileHidden ? "hidden md:block" : ""
                }`}
              >
                <div className="overflow-x-auto [scrollbar-width:thin]">{sectionNav}</div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Content — wider canvas so dashboards use horizontal space */}
      <main
        className={`flex-1 w-full max-w-[min(100%,1600px)] mx-auto overflow-x-clip px-3 sm:px-5 py-6 ${
          showBottomNav ? "pb-24 md:pb-6" : ""
        }`}
      >
        {isPatientKioskScreen && <FeedbackOutboxStatus />}
        <Outlet />
      </main>

      {/* Bottom navigation — plain staff on phones. Admins and HODs use the header section nav. */}
      {showBottomNav && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-6px_16px_-8px_rgb(74_13_31/0.15)] md:hidden">
          <div className="flex justify-around items-center h-16">
            <button
              type="button"
              onClick={() => navigate("/management/submissions")}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                onInsightsArea || path === "/staff" || path === "/dashboard" ? "" : "text-gray-500"
              }`}
              style={
                onInsightsArea || path === "/staff" || path === "/dashboard"
                  ? activePrimaryStyle
                  : undefined
              }
            >
              <BarChart3 size={24} />
              <span className="text-xs">Insights</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(patientRoutes.home)}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                isPatientKioskScreen ? "" : "text-gray-500"
              }`}
              style={isPatientKioskScreen ? activePrimaryStyle : undefined}
            >
              <ClipboardList size={24} />
              <span className="text-xs">Feedback</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(patientRoutes.home)}
              className="flex flex-col items-center gap-1 px-4 py-2 text-gray-500"
            >
              <UserRound size={24} />
              <span className="text-xs">Patient</span>
            </button>
          </div>
        </nav>
      )}
      {isHod && session ? (
        <HodChangePasswordDialog
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
          userId={session._id}
        />
      ) : null}
    </div>
  );
}

