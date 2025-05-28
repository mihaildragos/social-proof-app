"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, Download, ExternalLink, Code, Settings, Zap, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InstallationConfig {
  apiKey: string;
  siteId: string;
  position: string;
  theme: string;
  maxNotifications: number;
  displayDuration: number;
  enableSound: boolean;
  showCloseButton: boolean;
  template: string;
}

export default function InstallationPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<InstallationConfig>({
    apiKey: "your-api-key-here",
    siteId: "your-site-id-here",
    position: "bottom-right",
    theme: "light",
    maxNotifications: 3,
    displayDuration: 5000,
    enableSound: false,
    showCloseButton: true,
    template: "standard",
  });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  // Generate installation code
  const generateInstallationCode = () => {
    return `<!-- Social Proof Widget Installation -->
<script>
  window.socialProofConfig = {
    apiKey: '${config.apiKey}',
    siteId: '${config.siteId}',
    position: '${config.position}',
    theme: '${config.theme}',
    maxNotifications: ${config.maxNotifications},
    displayDuration: ${config.displayDuration},
    enableSound: ${config.enableSound},
    showCloseButton: ${config.showCloseButton},
    template: '${config.template}',
    debug: false
  };
</script>
<script src="https://cdn.socialproof.app/widget/social-proof-widget.js" async></script>`;
  };

  // Generate advanced configuration
  const generateAdvancedCode = () => {
    return `<!-- Advanced Social Proof Widget Configuration -->
<script>
  // Initialize widget with custom configuration
  const widget = new SocialProofWidget({
    apiKey: '${config.apiKey}',
    siteId: '${config.siteId}',
    position: '${config.position}',
    theme: '${config.theme}',
    maxNotifications: ${config.maxNotifications},
    displayDuration: ${config.displayDuration},
    enableSound: ${config.enableSound},
    showCloseButton: ${config.showCloseButton},
    
    // Advanced options
    customStyles: {
      fontSize: '14px',
      borderRadius: '12px'
    },
    
    filters: {
      types: ['purchase', 'signup', 'review'],
      minAmount: 10
    },
    
    targeting: {
      countries: ['US', 'CA', 'GB'],
      devices: ['desktop', 'mobile']
    },
    
    customEvents: {
      onShow: (notification) => {
        console.log('Notification shown:', notification);
      },
      onClick: (notification) => {
        console.log('Notification clicked:', notification);
      }
    }
  });
  
  // Widget API methods
  // widget.updateConfig({ theme: 'dark' });
  // widget.setVisible(false);
  // widget.getStatus();
  // widget.destroy();
</script>
<script src="https://cdn.socialproof.app/widget/social-proof-widget.js"></script>`;
  };

  // Generate React integration code
  const generateReactCode = () => {
    return `import { useEffect } from 'react';

const SocialProofWidget = () => {
  useEffect(() => {
    // Load widget script
    const script = document.createElement('script');
    script.src = 'https://cdn.socialproof.app/widget/social-proof-widget.js';
    script.async = true;
    
    // Configure widget
    window.socialProofConfig = {
      apiKey: '${config.apiKey}',
      siteId: '${config.siteId}',
      position: '${config.position}',
      theme: '${config.theme}',
      maxNotifications: ${config.maxNotifications},
      displayDuration: ${config.displayDuration},
      enableSound: ${config.enableSound},
      showCloseButton: ${config.showCloseButton}
    };
    
    document.head.appendChild(script);
    
    // Cleanup
    return () => {
      if (window.SocialProofWidget) {
        window.SocialProofWidget.destroy();
      }
      document.head.removeChild(script);
    };
  }, []);

  return null;
};

export default SocialProofWidget;`;
  };

  // Generate WordPress integration code
  const generateWordPressCode = () => {
    return `<?php
// Add to your theme's functions.php file

function add_social_proof_widget() {
    $config = array(
        'apiKey' => '${config.apiKey}',
        'siteId' => '${config.siteId}',
        'position' => '${config.position}',
        'theme' => '${config.theme}',
        'maxNotifications' => ${config.maxNotifications},
        'displayDuration' => ${config.displayDuration},
        'enableSound' => ${config.enableSound ? "true" : "false"},
        'showCloseButton' => ${config.showCloseButton ? "true" : "false"}
    );
    
    echo '<script>';
    echo 'window.socialProofConfig = ' . json_encode($config) . ';';
    echo '</script>';
    echo '<script src="https://cdn.socialproof.app/widget/social-proof-widget.js" async></script>';
}

add_action('wp_footer', 'add_social_proof_widget');
?>`;
  };

  // Copy code to clipboard
  const copyToClipboard = async (code: string, type: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(type);
      toast({
        title: "Code copied!",
        description: "Installation code has been copied to your clipboard.",
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the code manually.",
        variant: "destructive",
      });
    }
  };

  // Download configuration file
  const downloadConfig = () => {
    const configData = {
      ...config,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `social-proof-config-${config.siteId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Code className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Widget Installation</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Install the Social Proof Widget on your website in minutes. Follow our step-by-step guide
          or use our configuration tool to generate custom installation code.
        </p>
      </div>

      {/* Installation Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Installation Steps
          </CardTitle>
          <CardDescription>Get your widget up and running in 3 simple steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div
              className={`rounded-lg border-2 p-4 transition-colors ${
                activeStep >= 1 ? "border-blue-500 bg-blue-50" : "border-gray-200"
              }`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    activeStep >= 1 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  1
                </div>
                <h3 className="font-semibold">Configure Widget</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Customize your widget settings using the configuration panel below.
              </p>
            </div>

            <div
              className={`rounded-lg border-2 p-4 transition-colors ${
                activeStep >= 2 ? "border-blue-500 bg-blue-50" : "border-gray-200"
              }`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    activeStep >= 2 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  2
                </div>
                <h3 className="font-semibold">Copy Code</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Copy the generated installation code for your platform.
              </p>
            </div>

            <div
              className={`rounded-lg border-2 p-4 transition-colors ${
                activeStep >= 3 ? "border-blue-500 bg-blue-50" : "border-gray-200"
              }`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    activeStep >= 3 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  3
                </div>
                <h3 className="font-semibold">Add to Website</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Paste the code into your website's HTML before the closing &lt;/body&gt; tag.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Widget Configuration
            </CardTitle>
            <CardDescription>Customize your widget settings and appearance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Configuration */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                API Configuration
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder="Enter your API key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteId">Site ID</Label>
                  <Input
                    id="siteId"
                    value={config.siteId}
                    onChange={(e) => setConfig({ ...config, siteId: e.target.value })}
                    placeholder="Enter your site ID"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Appearance Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Appearance
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Select
                    value={config.position}
                    onValueChange={(value) => setConfig({ ...config, position: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={config.theme}
                    onValueChange={(value) => setConfig({ ...config, theme: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="glass">Glass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select
                  value={config.template}
                  onValueChange={(value) => setConfig({ ...config, template: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="saas">SaaS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Behavior Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Behavior
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxNotifications">Max Notifications</Label>
                  <Input
                    id="maxNotifications"
                    type="number"
                    min="1"
                    max="10"
                    value={config.maxNotifications}
                    onChange={(e) =>
                      setConfig({ ...config, maxNotifications: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayDuration">Display Duration (ms)</Label>
                  <Input
                    id="displayDuration"
                    type="number"
                    min="1000"
                    max="30000"
                    step="1000"
                    value={config.displayDuration}
                    onChange={(e) =>
                      setConfig({ ...config, displayDuration: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableSound">Enable Sound</Label>
                  <Switch
                    id="enableSound"
                    checked={config.enableSound}
                    onCheckedChange={(checked) => setConfig({ ...config, enableSound: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="showCloseButton">Show Close Button</Label>
                  <Switch
                    id="showCloseButton"
                    checked={config.showCloseButton}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, showCloseButton: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setActiveStep(2)}
                className="flex-1"
              >
                Generate Code
              </Button>
              <Button
                variant="outline"
                onClick={downloadConfig}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Config
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Installation Code */}
        <Card>
          <CardHeader>
            <CardTitle>Installation Code</CardTitle>
            <CardDescription>Copy and paste this code into your website</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="basic"
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="react">React</TabsTrigger>
                <TabsTrigger value="wordpress">WordPress</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent
                value="basic"
                className="space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>HTML Installation Code</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generateInstallationCode(), "basic")}
                    >
                      {copiedCode === "basic" ?
                        <Check className="h-4 w-4" />
                      : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Textarea
                    value={generateInstallationCode()}
                    readOnly
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Add this code before the closing &lt;/body&gt; tag on every page where you want
                    notifications to appear.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent
                value="react"
                className="space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>React Component</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generateReactCode(), "react")}
                    >
                      {copiedCode === "react" ?
                        <Check className="h-4 w-4" />
                      : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Textarea
                    value={generateReactCode()}
                    readOnly
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent
                value="wordpress"
                className="space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>WordPress Integration</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generateWordPressCode(), "wordpress")}
                    >
                      {copiedCode === "wordpress" ?
                        <Check className="h-4 w-4" />
                      : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Textarea
                    value={generateWordPressCode()}
                    readOnly
                    className="min-h-[250px] font-mono text-sm"
                  />
                </div>
                <Alert>
                  <AlertDescription>
                    Add this code to your theme's functions.php file or use a custom plugin.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent
                value="advanced"
                className="space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Advanced Configuration</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generateAdvancedCode(), "advanced")}
                    >
                      {copiedCode === "advanced" ?
                        <Check className="h-4 w-4" />
                      : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Textarea
                    value={generateAdvancedCode()}
                    readOnly
                    className="min-h-[400px] font-mono text-sm"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Testing & Verification */}
      <Card>
        <CardHeader>
          <CardTitle>Testing & Verification</CardTitle>
          <CardDescription>Verify your installation is working correctly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-semibold">1. Check Console</h4>
              <p className="text-sm text-muted-foreground">
                Open browser developer tools and check for any JavaScript errors in the console.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-semibold">2. Network Tab</h4>
              <p className="text-sm text-muted-foreground">
                Verify that the widget script loads successfully in the Network tab.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-semibold">3. Test Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Use the dashboard to send test notifications and verify they appear on your site.
              </p>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Need help? Check our{" "}
              <Button
                variant="link"
                className="h-auto p-0"
              >
                troubleshooting guide
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>{" "}
              or contact support.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Additional Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
          <CardDescription>Helpful links and documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto justify-start p-4"
            >
              <div className="text-left">
                <div className="font-semibold">API Documentation</div>
                <div className="text-sm text-muted-foreground">Complete API reference</div>
              </div>
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start p-4"
            >
              <div className="text-left">
                <div className="font-semibold">Widget Customization</div>
                <div className="text-sm text-muted-foreground">Styling and themes guide</div>
              </div>
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start p-4"
            >
              <div className="text-left">
                <div className="font-semibold">Integration Examples</div>
                <div className="text-sm text-muted-foreground">Platform-specific guides</div>
              </div>
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start p-4"
            >
              <div className="text-left">
                <div className="font-semibold">Support Center</div>
                <div className="text-sm text-muted-foreground">Get help and support</div>
              </div>
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
