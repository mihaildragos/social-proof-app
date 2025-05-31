import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationPopup } from "./NotificationPopup";

// Define the props interface for the settings component
interface NotificationSettingsProps {
  settings: {
    position: string;
    animation: string;
    displayTime: number;
    autoClose: boolean;
    template?: string;
  };
  onSettingsChange: (settings: any) => void;
  onSave: () => void;
  siteId: string;
  availableTemplates?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

export function NotificationSettings({
  settings,
  onSettingsChange,
  onSave,
  siteId,
  availableTemplates = [],
}: NotificationSettingsProps) {
  // State for the preview notification
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewData, setPreviewData] = React.useState({
    title: "Order Notification",
    message: "Someone just purchased a product",
    image: "https://via.placeholder.com/150",
  });

  // Toggle preview notification
  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);

    // Auto-hide preview after the configured display time
    if (!showPreview) {
      setTimeout(() => {
        setShowPreview(false);
      }, settings.displayTime);
    }
  };

  // Handle settings change
  const handleSettingChange = (name: string, value: any) => {
    onSettingsChange({
      ...settings,
      [name]: value,
    });
  };

  // Position options
  const positionOptions = [
    { value: "top-left", label: "Top Left" },
    { value: "top-right", label: "Top Right" },
    { value: "top-center", label: "Top Center" },
    { value: "bottom-left", label: "Bottom Left" },
    { value: "bottom-right", label: "Bottom Right" },
    { value: "bottom-center", label: "Bottom Center" },
  ];

  // Animation options
  const animationOptions = [
    { value: "fade", label: "Fade" },
    { value: "slide", label: "Slide" },
    { value: "bounce", label: "Bounce" },
  ];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Configure how notifications are displayed on your site</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="appearance">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="timing">Timing</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <TabsContent
              value="appearance"
              className="space-y-4 pt-4"
            >
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Select
                    value={settings.position}
                    onValueChange={(value) => handleSettingChange("position", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positionOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="animation">Animation</Label>
                  <Select
                    value={settings.animation}
                    onValueChange={(value) => handleSettingChange("animation", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select animation" />
                    </SelectTrigger>
                    <SelectContent>
                      {animationOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="timing"
              className="space-y-4 pt-4"
            >
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayTime">Display Time (ms)</Label>
                  <Input
                    id="displayTime"
                    type="number"
                    min={1000}
                    max={60000}
                    step={1000}
                    value={settings.displayTime}
                    onChange={(e) => handleSettingChange("displayTime", parseInt(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">
                    {(settings.displayTime / 1000).toFixed(1)} seconds
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="autoClose"
                    checked={settings.autoClose}
                    onCheckedChange={(checked) => handleSettingChange("autoClose", checked)}
                  />
                  <Label htmlFor="autoClose">Auto Close</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="templates"
              className="space-y-4 pt-4"
            >
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template">Template</Label>
                  <Select
                    value={settings.template}
                    onValueChange={(value) => handleSettingChange("template", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((template) => (
                        <SelectItem
                          key={template.id}
                          value={template.id}
                        >
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={handlePreviewToggle}>Preview</Button>
          <Button onClick={onSave}>Save Settings</Button>
        </CardFooter>
      </Card>

      {/* Preview notification */}
      <NotificationPopup
        variant="order"
        position={settings.position as any}
        animation={settings.animation as any}
        isVisible={showPreview}
        title={previewData.title}
        message={previewData.message}
        image={previewData.image}
        onClose={() => setShowPreview(false)}
        autoClose={settings.autoClose}
        autoCloseDelay={settings.displayTime}
      />

      {/* Installation details */}
      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>Add this code to your website to enable notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md bg-gray-50 p-4">
              <pre className="overflow-auto text-sm text-gray-800">
                {`<script src="${window.location.origin}/api/embed/${siteId}.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    if (window.SocialProof) {
      window.SocialProof.init({
        position: "${settings.position}",
        animation: "${settings.animation}",
        displayTime: ${settings.displayTime}
      });
    }
  });
</script>`}
              </pre>
            </div>
            <p className="text-sm text-gray-500">
              Add this code just before the closing &lt;/body&gt; tag of your website.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
