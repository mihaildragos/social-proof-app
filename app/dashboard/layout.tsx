import { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Dashboard | Social Proof",
  description: "Manage your social proof notifications and analytics",
};

// Placeholder components - will be implemented later
function DashboardSidebar() {
  return (
    <div className="flex h-full w-64 flex-col bg-white shadow-sm">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-semibold">Social Proof</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        <a
          href="/dashboard"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          Overview
        </a>
        <a
          href="/dashboard/sites"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Sites
        </a>
        <a
          href="/dashboard/notifications"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Notifications
        </a>
        <a
          href="/dashboard/analytics"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Analytics
        </a>
        <a
          href="/dashboard/team"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Team
        </a>
        <a
          href="/dashboard/billing"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Billing
        </a>
        <a
          href="/dashboard/integrations"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Integrations
        </a>
      </nav>
    </div>
  );
}

function DashboardHeader() {
  return (
    <header className="bg-white shadow-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
        <div className="flex items-center space-x-4">
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            New Notification
          </button>
        </div>
      </div>
    </header>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <DashboardSidebar />
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <DashboardHeader />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
