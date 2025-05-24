"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings, TestTube, Monitor, Activity } from "lucide-react";
import PurchaseEventSimulator from "@/components/test-control-panel/purchase-event-simulator";
import LiveMonitor from "@/components/test-control-panel/live-monitor";
import { TestSite } from "@/lib/test-helpers";

export default function TestControlPanel() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [testSite, setTestSite] = useState<TestSite | null>(null);
  const [testSiteLoading, setTestSiteLoading] = useState(false);
  const [testSiteError, setTestSiteError] = useState<string | null>(null);
  const [eventMessages, setEventMessages] = useState<
    Array<{
      type: "success" | "error";
      message: string;
      timestamp: number;
    }>
  >([]);

  // Initialize test site when user is signed in
  useEffect(() => {
    const initializeTestSite = async () => {
      if (!isSignedIn) return;

      setTestSiteLoading(true);
      setTestSiteError(null);

      try {
        const response = await fetch("/api/test-control-panel/test-site");
        const result = await response.json();

        if (result.success && result.site) {
          setTestSite(result.site);
          setConnectionStatus("connected");
        } else {
          setTestSiteError(result.error || "Failed to initialize test site");
          setConnectionStatus("disconnected");
        }
      } catch (error: any) {
        setTestSiteError("Network error occurred");
        setConnectionStatus("disconnected");
      } finally {
        setTestSiteLoading(false);
      }
    };

    initializeTestSite();
  }, [isSignedIn]);

  const handleEventSent = (success: boolean, message: string) => {
    const newMessage = {
      type: success ? ("success" as const) : ("error" as const),
      message,
      timestamp: Date.now(),
    };

    setEventMessages((prev) => [newMessage, ...prev.slice(0, 9)]); // Keep last 10 messages
  };

  const refreshTestSite = async () => {
    if (!isSignedIn) return;

    setTestSiteLoading(true);
    setTestSiteError(null);

    try {
      const response = await fetch("/api/test-control-panel/test-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: `${user?.firstName} ${user?.lastName}`.trim(),
          cleanupOld: false,
        }),
      });

      const result = await response.json();

      if (result.success && result.site) {
        setTestSite(result.site);
        setConnectionStatus("connected");
        handleEventSent(true, "Test site refreshed successfully");
      } else {
        setTestSiteError(result.error || "Failed to refresh test site");
        handleEventSent(false, result.error || "Failed to refresh test site");
      }
    } catch (error: any) {
      setTestSiteError("Network error occurred");
      handleEventSent(false, "Network error occurred");
    } finally {
      setTestSiteLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to access the test control panel.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <TestTube className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Test Control Panel
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  End-to-end notification flow testing
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Badge
                variant={connectionStatus === "connected" ? "default" : "destructive"}
                className="flex items-center space-x-1"
              >
                <Activity className="h-3 w-3" />
                <span>{connectionStatus === "connected" ? "Connected" : "Disconnected"}</span>
              </Badge>

              <div className="text-sm text-gray-600 dark:text-gray-300">
                {user?.firstName} {user?.lastName}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Status Alert */}
        {connectionStatus === "disconnected" && (
          <Alert
            className="mb-6"
            variant="destructive"
          >
            <AlertTitle>Service Connection Error</AlertTitle>
            <AlertDescription>
              Unable to connect to backend services. Please ensure all microservices are running.
            </AlertDescription>
          </Alert>
        )}

        <Tabs
          defaultValue="simulator"
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger
              value="simulator"
              className="flex items-center space-x-2"
            >
              <TestTube className="h-4 w-4" />
              <span>Event Simulator</span>
            </TabsTrigger>
            <TabsTrigger
              value="monitor"
              className="flex items-center space-x-2"
            >
              <Monitor className="h-4 w-4" />
              <span>Live Monitor</span>
            </TabsTrigger>
            <TabsTrigger
              value="test-page"
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>Test Page</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="simulator"
            className="space-y-6"
          >
            <PurchaseEventSimulator
              testSite={
                testSite ?
                  {
                    id: testSite.id,
                    name: testSite.name,
                    shop_domain: testSite.shop_domain,
                  }
                : undefined
              }
              onEventSent={handleEventSent}
            />
          </TabsContent>

          <TabsContent
            value="monitor"
            className="space-y-6"
          >
            <LiveMonitor
              testSite={
                testSite ?
                  {
                    id: testSite.id,
                    name: testSite.name,
                    shop_domain: testSite.shop_domain,
                  }
                : undefined
              }
            />
          </TabsContent>

          <TabsContent
            value="test-page"
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Client Test Page</CardTitle>
                <CardDescription>
                  Configure and access the client-side test page for viewing notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <h4 className="text-sm font-medium">Test Page Access</h4>
                      <p className="text-xs text-gray-500">
                        Open the client test page to view social proof notifications
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const url =
                            testSite ?
                              `/test-client.html?siteId=${testSite.id}`
                            : "/test-client.html";
                          window.open(url, "_blank");
                        }}
                        disabled={!testSite}
                      >
                        <Monitor className="mr-1 h-3 w-3" />
                        Open Test Page
                      </Button>
                    </div>
                  </div>

                  {testSite && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <h4 className="mb-2 text-sm font-medium text-blue-900">Instructions:</h4>
                      <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800">
                        <li>Click "Open Test Page" to open the client test page in a new tab</li>
                        <li>The page will automatically load your social proof script</li>
                        <li>Switch to the "Event Simulator" tab to send test events</li>
                        <li>Watch the test page for notifications to appear</li>
                      </ol>
                      <div className="mt-3 text-xs text-blue-700">
                        <strong>URL:</strong>{" "}
                        {`${window.location.origin}/test-client.html?siteId=${testSite.id}`}
                      </div>
                    </div>
                  )}

                  {!testSite && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                      <h4 className="mb-2 text-sm font-medium text-yellow-900">Setup Required:</h4>
                      <p className="text-sm text-yellow-800">
                        Please initialize your test site in the Settings tab before accessing the
                        test page.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="settings"
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Test Environment Settings</CardTitle>
                <CardDescription>
                  Configure test site settings and notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Test Site Status</h4>
                      <p className="text-xs text-gray-500">Current test site configuration</p>
                    </div>
                    <Badge variant={testSite ? "default" : "secondary"}>
                      {testSiteLoading ?
                        "Loading..."
                      : testSite ?
                        "Active"
                      : "Not Configured"}
                    </Badge>
                  </div>

                  {testSite && (
                    <div className="space-y-2 rounded-lg bg-gray-50 p-4">
                      <div className="text-sm">
                        <span className="font-medium">Site ID:</span> {testSite.id}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Name:</span> {testSite.name}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Domain:</span> {testSite.domain}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Shop Domain:</span> {testSite.shop_domain}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Status:</span> {testSite.status}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Created:</span>{" "}
                        {new Date(testSite.created_at).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {testSiteError && (
                    <Alert variant="destructive">
                      <AlertDescription>{testSiteError}</AlertDescription>
                    </Alert>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Test Site Management</h4>
                      <p className="text-xs text-gray-500">Refresh or recreate test site</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={refreshTestSite}
                      disabled={testSiteLoading}
                    >
                      <RefreshCw
                        className={`mr-1 h-3 w-3 ${testSiteLoading ? "animate-spin" : ""}`}
                      />
                      {testSiteLoading ? "Refreshing..." : "Refresh Site"}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recent Events</h4>
                    {eventMessages.length === 0 ?
                      <p className="text-xs text-gray-500">No recent events</p>
                    : <div className="max-h-40 space-y-1 overflow-y-auto">
                        {eventMessages.map((msg, index) => (
                          <div
                            key={msg.timestamp}
                            className={`rounded p-2 text-xs ${
                              msg.type === "success" ?
                                "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                            }`}
                          >
                            <span className="font-medium">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                            : {msg.message}
                          </div>
                        ))}
                      </div>
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
