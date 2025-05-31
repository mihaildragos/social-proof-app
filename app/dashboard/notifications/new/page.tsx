"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { TemplateSelector } from "@/components/notifications/template-selector";
import { TargetingRules } from "@/components/notifications/targeting-rules";
import { ABTestConfig } from "@/components/notifications/ab-test-config";
import { NotificationPreview } from "@/components/notifications/preview";
import { CampaignScheduler } from "@/components/notifications/scheduler";
import { useNotificationBuilder } from "@/hooks/use-notification-builder";
import { toast } from "@/hooks/use-toast";

const STEPS = [
  {
    id: "template",
    title: "Choose Template",
    description: "Select a notification template or create a custom one",
  },
  {
    id: "targeting",
    title: "Targeting Rules",
    description: "Define who will see your notifications",
  },
  {
    id: "ab-test",
    title: "A/B Testing",
    description: "Configure variants and testing parameters",
  },
  {
    id: "preview",
    title: "Preview",
    description: "Review your notification across different devices",
  },
  {
    id: "schedule",
    title: "Schedule",
    description: "Set when your campaign should run",
  },
];

export default function NewNotificationPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { notificationData, updateNotificationData, validateStep, createNotification, reset } =
    useNotificationBuilder();

  const currentStepData = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = async () => {
    const isValid = await validateStep(currentStepData.id, notificationData);

    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please complete all required fields before proceeding.",
        variant: "destructive",
      });
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const result = await createNotification(notificationData);

      if (result.success) {
        toast({
          title: "Success",
          description: "Your notification campaign has been created successfully.",
        });
        reset();
        router.push("/dashboard/notifications");
      } else {
        throw new Error(result.error || "Failed to create notification");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create notification campaign.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStepData.id) {
      case "template":
        return (
          <TemplateSelector
            value={notificationData.template}
            onChange={(template) => updateNotificationData({ template })}
          />
        );
      case "targeting":
        return (
          <TargetingRules
            value={notificationData.targeting}
            onChange={(targeting) => updateNotificationData({ targeting })}
          />
        );
      case "ab-test":
        return (
          <ABTestConfig
            value={notificationData.abTest}
            onChange={(abTest) => updateNotificationData({ abTest })}
          />
        );
      case "preview":
        return <NotificationPreview notificationData={notificationData} />;
      case "schedule":
        return (
          <CampaignScheduler
            value={notificationData.schedule}
            onChange={(schedule) => updateNotificationData({ schedule })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create New Notification</h1>
          <p className="text-muted-foreground">
            Build and configure your social proof notification campaign
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/notifications")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Notifications
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Step {currentStep + 1} of {STEPS.length}: {currentStepData.title}
              </CardTitle>
              <CardDescription>{currentStepData.description}</CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">{Math.round(progress)}% Complete</div>
          </div>
          <Progress
            value={progress}
            className="mt-4"
          />
        </CardHeader>
      </Card>

      {/* Step Navigation */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-4">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className="flex items-center"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium ${
                  index < currentStep ? "border-primary bg-primary text-primary-foreground"
                  : index === currentStep ? "border-primary text-primary"
                  : "border-muted-foreground/30 text-muted-foreground"
                } `}
              >
                {index < currentStep ?
                  <Check className="h-4 w-4" />
                : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-12 ${index < currentStep ? "bg-primary" : "bg-muted-foreground/30"} `}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex space-x-2">
          {currentStep === STEPS.length - 1 ?
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Campaign"}
            </Button>
          : <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        </div>
      </div>
    </div>
  );
}
