"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, UserPlus, Star, Users, Palette, Eye } from "lucide-react";
import { NotificationTemplate } from "@/types/notifications";

interface TemplateSelectorProps {
  value?: NotificationTemplate;
  onChange: (template: NotificationTemplate) => void;
}

const PREDEFINED_TEMPLATES: NotificationTemplate[] = [
  {
    id: "purchase-recent",
    name: "Recent Purchase",
    type: "purchase",
    category: "social_proof",
    preview: 'Someone from New York just purchased "Premium Plan"',
    content: {
      title: "Recent Purchase",
      message: 'Someone from {location} just purchased "{product}"',
      cta: {
        text: "Get Yours Now",
        url: "/checkout",
      },
    },
    styling: {
      position: "bottom-left",
      theme: "light",
      colors: {
        background: "#ffffff",
        text: "#1f2937",
        accent: "#3b82f6",
      },
      animation: "slide",
      duration: 5000,
    },
    isCustom: false,
  },
  {
    id: "signup-recent",
    name: "New Signup",
    type: "signup",
    category: "social_proof",
    preview: "John D. just signed up for our newsletter",
    content: {
      title: "New Member",
      message: "{name} just signed up for our newsletter",
      cta: {
        text: "Join Now",
        url: "/signup",
      },
    },
    styling: {
      position: "top-right",
      theme: "light",
      colors: {
        background: "#f8fafc",
        text: "#374151",
        accent: "#10b981",
      },
      animation: "fade",
      duration: 4000,
    },
    isCustom: false,
  },
  {
    id: "review-positive",
    name: "Positive Review",
    type: "review",
    category: "trust",
    preview: '⭐⭐⭐⭐⭐ "Amazing product!" - Sarah M.',
    content: {
      title: "Customer Review",
      message: '⭐⭐⭐⭐⭐ "{review}" - {customer}',
      cta: {
        text: "Read More Reviews",
        url: "/reviews",
      },
    },
    styling: {
      position: "bottom-right",
      theme: "light",
      colors: {
        background: "#fef3c7",
        text: "#92400e",
        accent: "#f59e0b",
      },
      animation: "bounce",
      duration: 6000,
    },
    isCustom: false,
  },
  {
    id: "visitor-count",
    name: "Live Visitor Count",
    type: "visitor_count",
    category: "urgency",
    preview: "23 people are viewing this page right now",
    content: {
      title: "Live Activity",
      message: "{count} people are viewing this page right now",
    },
    styling: {
      position: "top-left",
      theme: "dark",
      colors: {
        background: "#1f2937",
        text: "#f9fafb",
        accent: "#ef4444",
      },
      animation: "slide",
      duration: 3000,
    },
    isCustom: false,
  },
];

const TEMPLATE_ICONS = {
  purchase: ShoppingCart,
  signup: UserPlus,
  review: Star,
  visitor_count: Users,
  custom: Palette,
};

const CATEGORY_COLORS = {
  social_proof: "bg-blue-100 text-blue-800",
  urgency: "bg-red-100 text-red-800",
  trust: "bg-green-100 text-green-800",
  engagement: "bg-purple-100 text-purple-800",
};

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  const [selectedTab, setSelectedTab] = useState<"predefined" | "custom">("predefined");
  const [selectedTemplate, setSelectedTemplate] = useState<string>(value?.id || "");
  const [customTemplate, setCustomTemplate] = useState<Partial<NotificationTemplate>>({
    name: "",
    type: "custom",
    category: "social_proof",
    content: {
      title: "",
      message: "",
      cta: {
        text: "",
        url: "",
      },
    },
    styling: {
      position: "bottom-right",
      theme: "light",
      colors: {
        background: "#ffffff",
        text: "#1f2937",
        accent: "#3b82f6",
      },
      animation: "slide",
      duration: 5000,
    },
  });

  const handlePredefinedSelect = (templateId: string) => {
    const template = PREDEFINED_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      onChange(template);
    }
  };

  const handleCustomTemplateChange = (updates: Partial<NotificationTemplate>) => {
    const updated = { ...customTemplate, ...updates };
    setCustomTemplate(updated);

    if (updated.name && updated.content?.title && updated.content?.message) {
      const fullTemplate: NotificationTemplate = {
        id: `custom-${Date.now()}`,
        name: updated.name,
        type: updated.type || "custom",
        category: updated.category || "social_proof",
        preview: updated.content?.message || "",
        content: updated.content as NotificationTemplate["content"],
        styling: updated.styling as NotificationTemplate["styling"],
        isCustom: true,
      };
      onChange(fullTemplate);
    }
  };

  const renderTemplatePreview = (template: NotificationTemplate) => {
    const Icon = TEMPLATE_ICONS[template.type];

    return (
      <div
        className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
          selectedTemplate === template.id ?
            "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
        } `}
        onClick={() => handlePredefinedSelect(template.id)}
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">{template.name}</h3>
          </div>
          <Badge className={CATEGORY_COLORS[template.category]}>
            {template.category.replace("_", " ")}
          </Badge>
        </div>

        <div
          className="rounded border p-3 text-sm"
          style={{
            backgroundColor: template.styling.colors.background,
            color: template.styling.colors.text,
            borderColor: template.styling.colors.accent,
          }}
        >
          <div className="mb-1 font-medium">{template.content.title}</div>
          <div className="text-sm opacity-90">{template.preview}</div>
          {template.content.cta && (
            <Button
              size="sm"
              className="mt-2"
              style={{ backgroundColor: template.styling.colors.accent }}
            >
              {template.content.cta.text}
            </Button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Position: {template.styling.position}</span>
          <span>Animation: {template.styling.animation}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold">Choose Your Template</h2>
        <p className="text-muted-foreground">
          Select a pre-built template or create your own custom notification design.
        </p>
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={(value) => setSelectedTab(value as "predefined" | "custom")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="predefined">Predefined Templates</TabsTrigger>
          <TabsTrigger value="custom">Custom Template</TabsTrigger>
        </TabsList>

        <TabsContent
          value="predefined"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {PREDEFINED_TEMPLATES.map((template) => (
              <div key={template.id}>{renderTemplatePreview(template)}</div>
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="custom"
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Create Custom Template</CardTitle>
              <CardDescription>
                Design your own notification template with custom content and styling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="My Custom Template"
                    value={customTemplate.name || ""}
                    onChange={(e) => handleCustomTemplateChange({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Select
                    value={customTemplate.category}
                    onValueChange={(value) =>
                      handleCustomTemplateChange({
                        category: value as NotificationTemplate["category"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="social_proof">Social Proof</SelectItem>
                      <SelectItem value="urgency">Urgency</SelectItem>
                      <SelectItem value="trust">Trust</SelectItem>
                      <SelectItem value="engagement">Engagement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Content */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Content</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="content-title">Title</Label>
                    <Input
                      id="content-title"
                      placeholder="Notification Title"
                      value={customTemplate.content?.title || ""}
                      onChange={(e) =>
                        handleCustomTemplateChange({
                          content: {
                            ...customTemplate.content,
                            title: e.target.value,
                            message: customTemplate.content?.message || "",
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content-message">Message</Label>
                    <Textarea
                      id="content-message"
                      placeholder="Your notification message..."
                      value={customTemplate.content?.message || ""}
                      onChange={(e) =>
                        handleCustomTemplateChange({
                          content: {
                            ...customTemplate.content,
                            title: customTemplate.content?.title || "",
                            message: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cta-text">Call-to-Action Text (Optional)</Label>
                    <Input
                      id="cta-text"
                      placeholder="Learn More"
                      value={customTemplate.content?.cta?.text || ""}
                      onChange={(e) =>
                        handleCustomTemplateChange({
                          content: {
                            ...customTemplate.content,
                            title: customTemplate.content?.title || "",
                            message: customTemplate.content?.message || "",
                            cta: {
                              ...customTemplate.content?.cta,
                              text: e.target.value,
                              url: customTemplate.content?.cta?.url || "",
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cta-url">Call-to-Action URL (Optional)</Label>
                    <Input
                      id="cta-url"
                      placeholder="https://example.com"
                      value={customTemplate.content?.cta?.url || ""}
                      onChange={(e) =>
                        handleCustomTemplateChange({
                          content: {
                            ...customTemplate.content,
                            title: customTemplate.content?.title || "",
                            message: customTemplate.content?.message || "",
                            cta: {
                              ...customTemplate.content?.cta,
                              text: customTemplate.content?.cta?.text || "",
                              url: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Styling */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Styling</h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <RadioGroup
                      value={customTemplate.styling?.position}
                      onValueChange={(value) =>
                        handleCustomTemplateChange({
                          styling: {
                            ...customTemplate.styling,
                            position: value as NotificationTemplate["styling"]["position"],
                            theme: customTemplate.styling?.theme || "light",
                            colors: customTemplate.styling?.colors || {
                              background: "#ffffff",
                              text: "#1f2937",
                              accent: "#3b82f6",
                            },
                            animation: customTemplate.styling?.animation || "slide",
                            duration: customTemplate.styling?.duration || 5000,
                          },
                        })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="top-left"
                          id="top-left"
                        />
                        <Label htmlFor="top-left">Top Left</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="top-right"
                          id="top-right"
                        />
                        <Label htmlFor="top-right">Top Right</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="bottom-left"
                          id="bottom-left"
                        />
                        <Label htmlFor="bottom-left">Bottom Left</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="bottom-right"
                          id="bottom-right"
                        />
                        <Label htmlFor="bottom-right">Bottom Right</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="animation">Animation</Label>
                    <Select
                      value={customTemplate.styling?.animation}
                      onValueChange={(value) =>
                        handleCustomTemplateChange({
                          styling: {
                            ...customTemplate.styling,
                            position: customTemplate.styling?.position || "bottom-right",
                            theme: customTemplate.styling?.theme || "light",
                            colors: customTemplate.styling?.colors || {
                              background: "#ffffff",
                              text: "#1f2937",
                              accent: "#3b82f6",
                            },
                            animation: value as NotificationTemplate["styling"]["animation"],
                            duration: customTemplate.styling?.duration || 5000,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slide">Slide</SelectItem>
                        <SelectItem value="fade">Fade</SelectItem>
                        <SelectItem value="bounce">Bounce</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (ms)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1000"
                      max="10000"
                      step="500"
                      value={customTemplate.styling?.duration || 5000}
                      onChange={(e) =>
                        handleCustomTemplateChange({
                          styling: {
                            ...customTemplate.styling,
                            position: customTemplate.styling?.position || "bottom-right",
                            theme: customTemplate.styling?.theme || "light",
                            colors: customTemplate.styling?.colors || {
                              background: "#ffffff",
                              text: "#1f2937",
                              accent: "#3b82f6",
                            },
                            animation: customTemplate.styling?.animation || "slide",
                            duration: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="bg-color">Background Color</Label>
                    <Input
                      id="bg-color"
                      type="color"
                      value={customTemplate.styling?.colors?.background || "#ffffff"}
                      onChange={(e) =>
                        handleCustomTemplateChange({
                          styling: {
                            ...customTemplate.styling,
                            position: customTemplate.styling?.position || "bottom-right",
                            theme: customTemplate.styling?.theme || "light",
                            colors: {
                              background: e.target.value,
                              text: customTemplate.styling?.colors?.text || "#1f2937",
                              accent: customTemplate.styling?.colors?.accent || "#3b82f6",
                            },
                            animation: customTemplate.styling?.animation || "slide",
                            duration: customTemplate.styling?.duration || 5000,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text-color">Text Color</Label>
                    <Input
                      id="text-color"
                      type="color"
                      value={customTemplate.styling?.colors?.text || "#1f2937"}
                      onChange={(e) =>
                        handleCustomTemplateChange({
                          styling: {
                            ...customTemplate.styling,
                            position: customTemplate.styling?.position || "bottom-right",
                            theme: customTemplate.styling?.theme || "light",
                            colors: {
                              background: customTemplate.styling?.colors?.background || "#ffffff",
                              text: e.target.value,
                              accent: customTemplate.styling?.colors?.accent || "#3b82f6",
                            },
                            animation: customTemplate.styling?.animation || "slide",
                            duration: customTemplate.styling?.duration || 5000,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accent-color">Accent Color</Label>
                    <Input
                      id="accent-color"
                      type="color"
                      value={customTemplate.styling?.colors?.accent || "#3b82f6"}
                      onChange={(e) =>
                        handleCustomTemplateChange({
                          styling: {
                            ...customTemplate.styling,
                            position: customTemplate.styling?.position || "bottom-right",
                            theme: customTemplate.styling?.theme || "light",
                            colors: {
                              background: customTemplate.styling?.colors?.background || "#ffffff",
                              text: customTemplate.styling?.colors?.text || "#1f2937",
                              accent: e.target.value,
                            },
                            animation: customTemplate.styling?.animation || "slide",
                            duration: customTemplate.styling?.duration || 5000,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {customTemplate.name &&
                customTemplate.content?.title &&
                customTemplate.content?.message && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Eye className="h-4 w-4" />
                        <Label>Preview</Label>
                      </div>
                      <div
                        className="max-w-sm rounded border p-4"
                        style={{
                          backgroundColor: customTemplate.styling?.colors?.background,
                          color: customTemplate.styling?.colors?.text,
                          borderColor: customTemplate.styling?.colors?.accent,
                        }}
                      >
                        <div className="mb-1 font-medium">{customTemplate.content.title}</div>
                        <div className="text-sm opacity-90">{customTemplate.content.message}</div>
                        {customTemplate.content.cta?.text && (
                          <Button
                            size="sm"
                            className="mt-2"
                            style={{ backgroundColor: customTemplate.styling?.colors?.accent }}
                          >
                            {customTemplate.content.cta.text}
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
