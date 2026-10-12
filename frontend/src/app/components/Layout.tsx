import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Home, BarChart3, Building2, ClipboardList, KeyRound, Settings, UserRound, Users } from "lucide-react";
import { getSession, logout } from "../lib/auth";
import { isUserFeedPath, patientRoutes } from "../lib/patientRoutes";
import feedbackLogo from "./image/feedback_logo.png";
import { HOSPITAL } from "../lib/hospital";
import {
  applyBrandingTheme,
  getBrandingSettings,
  loadBrandingSettings,
  onBrandingSettingsChange,
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <img
                src={appLogo}
                alt={`${HOSPITAL.shortName} feedback system`}
                className="h-10 w-auto max-h-11 max-w-[min(140px,36vw)] shrink-0 object-contain sm:h-11 lg:h-12 lg:max-w-[180px]"
              />
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-gray-900 sm:text-lg lg:text-xl">
                  <span className={showHeaderActions ? "2xl:hidden" : "sm:hidden"}>{HOSPITAL.shortName}</span>
                  <span className={showHeaderActions ? "hidden 2xl:inline" : "hidden sm:inline"}>
                    {HOSPITAL.name}
                  </span>
                </h1>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A6A10] sm:text-[11px]">
                  Patient Feedback System
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <NetworkStatusIndicator variant="inline" />
              {!isPatientKioskScreen && showHeaderActions && (
                <>
                {isAdminShell ? (
                  <nav
                    className="hidden md:inline-flex flex-wrap items-center gap-1 rounded-full border border-gray-200 bg-gray-100 p-1"
                    role="tablist"
                    aria-label="Admin sections"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={onInsightsArea}
                      onClick={() => navigate("/admin/management-overview/submissions")}
                      className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                        onInsightsArea
                          ? "shadow-sm"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      style={onInsightsArea ? activePrimaryBackgroundStyle : undefined}
                    >
                      Insights
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={path === "/admin" || path === "/admin/delete"}
                      onClick={() => navigate("/admin")}
                      className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                        path === "/admin" || path === "/admin/delete"
                          ? "shadow-sm"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      style={path === "/admin" || path === "/admin/delete" ? activePrimaryBackgroundStyle : undefined}
                    >
                      Overview
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={path === "/admin/departments"}
                      onClick={() => navigate("/admin/departments")}
                      className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                        path === "/admin/departments"
                          ? "shadow-sm"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      style={path === "/admin/departments" ? activePrimaryBackgroundStyle : undefined}
                    >
                      Departments
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={path === "/admin/services"}
                      onClick={() => navigate("/admin/services")}
                      className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                        path === "/admin/services"
                          ? "shadow-sm"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      style={path === "/admin/services" ? activePrimaryBackgroundStyle : undefined}
                    >
                      Services
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={path === "/admin/users"}
                      onClick={() => navigate("/admin/users")}
                      className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                        path === "/admin/users"
                          ? "shadow-sm"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      style={path === "/admin/users" ? activePrimaryBackgroundStyle : undefined}
                    >
                      Users
                    </button>
                    {canManageRoles ? (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={path === "/admin/roles"}
                        onClick={() => navigate("/admin/roles")}
                        className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                          path === "/admin/roles"
                            ? "shadow-sm"
                            : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                        }`}
                        style={path === "/admin/roles" ? activePrimaryBackgroundStyle : undefined}
                      >
                        Roles
                      </button>
                    ) : null}
                    {ticketingEnabled ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={path.startsWith("/admin/tickets")}
                      onClick={() => navigate("/admin/tickets")}
                      className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                        path.startsWith("/admin/tickets")
                          ? "shadow-sm"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      style={path.startsWith("/admin/tickets") ? activePrimaryBackgroundStyle : undefined}
                    >
                      Tickets
                    </button>
                    ) : null}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={path === "/admin/bot-conversation"}
                      onClick={() => navigate("/admin/bot-conversation")}
                      className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                        path === "/admin/bot-conversation"
                          ? "shadow-sm"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      style={path === "/admin/bot-conversation" ? activePrimaryBackgroundStyle : undefined}
                    >
                      Bot Q&amp;A
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={path === "/admin/settings"}
                      onClick={() => navigate("/admin/settings")}
                      className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                        path === "/admin/settings"
                          ? "shadow-sm"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
                      }`}
                      style={path === "/admin/settings" ? activePrimaryBackgroundStyle : undefined}
                    >
                      Settings
                    </button>
                  </nav>
                ) : isAdmin ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate("/admin/management-overview/submissions")}
                      className="px-4 py-2 text-white rounded-lg transition-all duration-200"
                      style={activePrimaryBackgroundStyle}
                    >
                      Insights
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/management/submissions")}
                      className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                        onInsightsArea
                          ? "border-primary text-primary bg-brand-50"
                          : "border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Operations
                    </button>
                  </>
                ) : isHod ? (
                  hodCanSeeOverview ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate("/hod/overview")}
                        className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                          path === "/hod/overview"
                            ? "border-primary text-primary bg-brand-50"
                            : "border-gray-300 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        Overview
                      </button>
                      {ticketingEnabled ? (
                      <button
                        type="button"
                        onClick={() => navigate("/dashboard")}
                        className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                          path === "/dashboard"
                            ? "border-primary text-primary bg-brand-50"
                            : "border-gray-300 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        My queue
                      </button>
                      ) : null}
                    </>
                  ) : null
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(patientRoutes.home)}
                      className="px-4 py-2 text-white rounded-lg transition-all duration-200"
                      style={activePrimaryBackgroundStyle}
                    >
                      Submit feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/management/submissions")}
                      className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                        onInsightsArea
                          ? "border-primary text-primary bg-brand-50"
                          : "border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Insights
                    </button>
                  </>
                )}
                {!isAdminShell && !isHod && (
                  <button
                    type="button"
                    onClick={() => navigate(patientRoutes.home)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  >
                    Patient View
                  </button>
                )}
                </>
              )}
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
          </div>
        </div>
      </header>

      {/* Main Content — wider canvas so dashboards use horizontal space */}
      <main
        className={`flex-1 w-full max-w-[min(100%,1600px)] mx-auto px-3 sm:px-5 py-6 ${
          showBottomNav ? "pb-24 md:pb-6" : ""
        }`}
      >
        {isPatientKioskScreen && <FeedbackOutboxStatus />}
        <Outlet />
      </main>

      {/* Bottom Navigation - Only for staff views */}
      {showBottomNav && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-6px_16px_-8px_rgb(74_13_31/0.15)] md:hidden">
          <div className="flex justify-around items-center h-16">
            {isAdmin ? (
              <div className="flex w-full justify-around overflow-x-auto">
                <button
                  type="button"
                  onClick={() => navigate("/admin/management-overview/submissions")}
                  className={`flex flex-col items-center gap-1 px-2 py-2 shrink-0 ${
                    onInsightsArea ? "" : "text-gray-500"
                  }`}
                  style={onInsightsArea ? activePrimaryStyle : undefined}
                >
                  <BarChart3 size={22} />
                  <span className="text-[10px] sm:text-xs">Insights</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/admin")}
                  className={`flex flex-col items-center gap-1 px-2 py-2 shrink-0 ${
                    path === "/admin" || path === "/admin/delete" ? "" : "text-gray-500"
                  }`}
                  style={path === "/admin" || path === "/admin/delete" ? activePrimaryStyle : undefined}
                >
                  <Home size={22} />
                  <span className="text-[10px] sm:text-xs">Overview</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/admin/departments")}
                  className={`flex flex-col items-center gap-1 px-2 py-2 shrink-0 ${
                    path === "/admin/departments" ? "" : "text-gray-500"
                  }`}
                  style={path === "/admin/departments" ? activePrimaryStyle : undefined}
                >
                  <Building2 size={22} />
                  <span className="text-[10px] sm:text-xs">Depts</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/admin/services")}
                  className={`flex flex-col items-center gap-1 px-2 py-2 shrink-0 ${
                    path === "/admin/services" ? "" : "text-gray-500"
                  }`}
                  style={path === "/admin/services" ? activePrimaryStyle : undefined}
                >
                  <Building2 size={22} />
                  <span className="text-[10px] sm:text-xs">Services</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/admin/users")}
                  className={`flex flex-col items-center gap-1 px-2 py-2 shrink-0 ${
                    path === "/admin/users" ? "" : "text-gray-500"
                  }`}
                  style={path === "/admin/users" ? activePrimaryStyle : undefined}
                >
                  <Users size={22} />
                  <span className="text-[10px] sm:text-xs">Users</span>
                </button>
                {ticketingEnabled ? (
                <button
                  type="button"
                  onClick={() => navigate("/admin/tickets")}
                  className={`flex flex-col items-center gap-1 px-2 py-2 shrink-0 ${
                    path.startsWith("/admin/tickets") ? "" : "text-gray-500"
                  }`}
                  style={path.startsWith("/admin/tickets") ? activePrimaryStyle : undefined}
                >
                  <ClipboardList size={22} />
                  <span className="text-[10px] sm:text-xs">Tickets</span>
                </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate("/admin/settings")}
                  className={`flex flex-col items-center gap-1 px-2 py-2 shrink-0 ${
                    path === "/admin/settings" ? "" : "text-gray-500"
                  }`}
                  style={path === "/admin/settings" ? activePrimaryStyle : undefined}
                >
                  <Settings size={22} />
                  <span className="text-[10px] sm:text-xs">Settings</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/management/submissions")}
                  className={`flex flex-col items-center gap-1 px-4 py-2 ${
                    onInsightsArea || path === "/staff" || path === "/dashboard"
                      ? ""
                      : "text-gray-500"
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
              </>
            )}
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

