"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Users, Target, Clock, MousePointer, Globe } from "lucide-react";
import {
  TargetingConfig,
  AudienceSegment,
  TargetingRule,
  BehavioralTrigger,
} from "@/types/notifications";

interface TargetingRulesProps {
  value?: TargetingConfig;
  onChange: (targeting: TargetingConfig) => void;
}

const RULE_TYPES = [
  {
    value: "page_url",
    label: "Page URL",
    icon: Globe,
    description: "Target based on current page URL",
  },
  {
    value: "referrer",
    label: "Referrer",
    icon: Globe,
    description: "Target based on referring website",
  },
  {
    value: "device",
    label: "Device",
    icon: MousePointer,
    description: "Target based on device type",
  },
  {
    value: "location",
    label: "Location",
    icon: Globe,
    description: "Target based on geographic location",
  },
  { value: "time", label: "Time", icon: Clock, description: "Target based on time of day/week" },
  {
    value: "behavior",
    label: "Behavior",
    icon: Target,
    description: "Target based on user behavior",
  },
];

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "regex", label: "Regex match" },
  { value: "in", label: "In list" },
  { value: "not_in", label: "Not in list" },
];

const TRIGGER_EVENTS = [
  { value: "page_view", label: "Page View", description: "When user views a page" },
  { value: "time_on_page", label: "Time on Page", description: "After user spends time on page" },
  { value: "scroll_depth", label: "Scroll Depth", description: "When user scrolls to percentage" },
  { value: "exit_intent", label: "Exit Intent", description: "When user is about to leave" },
  { value: "click", label: "Element Click", description: "When user clicks specific element" },
  { value: "form_submit", label: "Form Submit", description: "When user submits a form" },
];

const FREQUENCY_OPTIONS = [
  { value: "once", label: "Once per user" },
  { value: "session", label: "Once per session" },
  { value: "daily", label: "Once per day" },
  { value: "always", label: "Every time" },
];

export function TargetingRules({ value, onChange }: TargetingRulesProps) {
  const [activeTab, setActiveTab] = useState<"segments" | "triggers" | "frequency">("segments");

  const defaultTargeting: TargetingConfig = {
    segments: [],
    triggers: [],
    frequency: {
      maxPerSession: 3,
      maxPerDay: 10,
      cooldownMinutes: 30,
    },
  };

  const targeting = value || defaultTargeting;

  const updateTargeting = (updates: Partial<TargetingConfig>) => {
    onChange({ ...targeting, ...updates });
  };

  const addSegment = () => {
    const newSegment: AudienceSegment = {
      id: `segment-${Date.now()}`,
      name: "New Segment",
      description: "",
      rules: [],
      logic: "AND",
    };
    updateTargeting({
      segments: [...targeting.segments, newSegment],
    });
  };

  const updateSegment = (segmentId: string, updates: Partial<AudienceSegment>) => {
    const updatedSegments = targeting.segments.map((segment) =>
      segment.id === segmentId ? { ...segment, ...updates } : segment
    );
    updateTargeting({ segments: updatedSegments });
  };

  const removeSegment = (segmentId: string) => {
    updateTargeting({
      segments: targeting.segments.filter((segment) => segment.id !== segmentId),
    });
  };

  const addRuleToSegment = (segmentId: string) => {
    const newRule: TargetingRule = {
      id: `rule-${Date.now()}`,
      type: "page_url",
      operator: "contains",
      value: "",
      description: "",
    };

    const updatedSegments = targeting.segments.map((segment) =>
      segment.id === segmentId ? { ...segment, rules: [...segment.rules, newRule] } : segment
    );
    updateTargeting({ segments: updatedSegments });
  };

  const updateRule = (segmentId: string, ruleId: string, updates: Partial<TargetingRule>) => {
    const updatedSegments = targeting.segments.map((segment) =>
      segment.id === segmentId ?
        {
          ...segment,
          rules: segment.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...updates } : rule)),
        }
      : segment
    );
    updateTargeting({ segments: updatedSegments });
  };

  const removeRule = (segmentId: string, ruleId: string) => {
    const updatedSegments = targeting.segments.map((segment) =>
      segment.id === segmentId ?
        { ...segment, rules: segment.rules.filter((rule) => rule.id !== ruleId) }
      : segment
    );
    updateTargeting({ segments: updatedSegments });
  };

  const addTrigger = () => {
    const newTrigger: BehavioralTrigger = {
      id: `trigger-${Date.now()}`,
      event: "page_view",
      conditions: {},
      frequency: "once",
    };
    updateTargeting({
      triggers: [...targeting.triggers, newTrigger],
    });
  };

  const updateTrigger = (triggerId: string, updates: Partial<BehavioralTrigger>) => {
    const updatedTriggers = targeting.triggers.map((trigger) =>
      trigger.id === triggerId ? { ...trigger, ...updates } : trigger
    );
    updateTargeting({ triggers: updatedTriggers });
  };

  const removeTrigger = (triggerId: string) => {
    updateTargeting({
      triggers: targeting.triggers.filter((trigger) => trigger.id !== triggerId),
    });
  };

  const renderRule = (segmentId: string, rule: TargetingRule) => {
    const ruleType = RULE_TYPES.find((type) => type.value === rule.type);
    const Icon = ruleType?.icon || Target;

    return (
      <div
        key={rule.id}
        className="space-y-4 rounded-lg border p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="font-medium">Targeting Rule</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeRule(segmentId, rule.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Rule Type</Label>
            <Select
              value={rule.type}
              onValueChange={(value) =>
                updateRule(segmentId, rule.id, {
                  type: value as TargetingRule["type"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map((type) => (
                  <SelectItem
                    key={type.value}
                    value={type.value}
                  >
                    <div className="flex items-center space-x-2">
                      <type.icon className="h-4 w-4" />
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Operator</Label>
            <Select
              value={rule.operator}
              onValueChange={(value) =>
                updateRule(segmentId, rule.id, {
                  operator: value as TargetingRule["operator"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem
                    key={op.value}
                    value={op.value}
                  >
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Value</Label>
            <Input
              placeholder="Enter value..."
              value={Array.isArray(rule.value) ? rule.value.join(", ") : rule.value}
              onChange={(e) => {
                const value =
                  rule.operator === "in" || rule.operator === "not_in" ?
                    e.target.value.split(",").map((v) => v.trim())
                  : e.target.value;
                updateRule(segmentId, rule.id, { value });
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description (Optional)</Label>
          <Input
            placeholder="Describe this rule..."
            value={rule.description}
            onChange={(e) => updateRule(segmentId, rule.id, { description: e.target.value })}
          />
        </div>
      </div>
    );
  };

  const renderTrigger = (trigger: BehavioralTrigger) => {
    const triggerEvent = TRIGGER_EVENTS.find((event) => event.value === trigger.event);

    return (
      <div
        key={trigger.id}
        className="space-y-4 rounded-lg border p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-medium">Behavioral Trigger</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeTrigger(trigger.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Trigger Event</Label>
            <Select
              value={trigger.event}
              onValueChange={(value) =>
                updateTrigger(trigger.id, {
                  event: value as BehavioralTrigger["event"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_EVENTS.map((event) => (
                  <SelectItem
                    key={event.value}
                    value={event.value}
                  >
                    <div>
                      <div className="font-medium">{event.label}</div>
                      <div className="text-xs text-muted-foreground">{event.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={trigger.frequency}
              onValueChange={(value) =>
                updateTrigger(trigger.id, {
                  frequency: value as BehavioralTrigger["frequency"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((freq) => (
                  <SelectItem
                    key={freq.value}
                    value={freq.value}
                  >
                    {freq.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Conditional fields based on trigger type */}
        {trigger.event === "time_on_page" && (
          <div className="space-y-2">
            <Label>Delay (seconds)</Label>
            <Input
              type="number"
              min="1"
              placeholder="30"
              value={trigger.conditions.delay || ""}
              onChange={(e) =>
                updateTrigger(trigger.id, {
                  conditions: { ...trigger.conditions, delay: parseInt(e.target.value) },
                })
              }
            />
          </div>
        )}

        {trigger.event === "scroll_depth" && (
          <div className="space-y-2">
            <Label>Scroll Percentage</Label>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="50"
              value={trigger.conditions.scrollPercentage || ""}
              onChange={(e) =>
                updateTrigger(trigger.id, {
                  conditions: { ...trigger.conditions, scrollPercentage: parseInt(e.target.value) },
                })
              }
            />
          </div>
        )}

        {trigger.event === "click" && (
          <div className="space-y-2">
            <Label>Element Selector</Label>
            <Input
              placeholder=".button, #submit, [data-track]"
              value={trigger.conditions.elementSelector || ""}
              onChange={(e) =>
                updateTrigger(trigger.id, {
                  conditions: { ...trigger.conditions, elementSelector: e.target.value },
                })
              }
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold">Targeting Rules</h2>
        <p className="text-muted-foreground">
          Define who will see your notifications and when they should be triggered.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger
            value="segments"
            className="flex items-center space-x-2"
          >
            <Users className="h-4 w-4" />
            <span>Audience Segments</span>
          </TabsTrigger>
          <TabsTrigger
            value="triggers"
            className="flex items-center space-x-2"
          >
            <Target className="h-4 w-4" />
            <span>Behavioral Triggers</span>
          </TabsTrigger>
          <TabsTrigger
            value="frequency"
            className="flex items-center space-x-2"
          >
            <Clock className="h-4 w-4" />
            <span>Frequency Control</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="segments"
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Audience Segments</h3>
              <p className="text-sm text-muted-foreground">
                Create segments to target specific groups of users
              </p>
            </div>
            <Button onClick={addSegment}>
              <Plus className="mr-2 h-4 w-4" />
              Add Segment
            </Button>
          </div>

          {targeting.segments.length === 0 ?
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No segments created</h3>
                <p className="mb-4 text-muted-foreground">
                  Create your first audience segment to start targeting specific users.
                </p>
                <Button onClick={addSegment}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Segment
                </Button>
              </CardContent>
            </Card>
          : <div className="space-y-4">
              {targeting.segments.map((segment) => (
                <Card key={segment.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Input
                            className="h-auto border-none p-0 text-lg font-semibold"
                            value={segment.name}
                            onChange={(e) => updateSegment(segment.id, { name: e.target.value })}
                            placeholder="Segment Name"
                          />
                          <Badge variant="outline">
                            {segment.rules.length} rule{segment.rules.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <Input
                          className="h-auto border-none p-0 text-sm text-muted-foreground"
                          value={segment.description}
                          onChange={(e) =>
                            updateSegment(segment.id, { description: e.target.value })
                          }
                          placeholder="Describe this segment..."
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm">Logic:</Label>
                          <RadioGroup
                            value={segment.logic}
                            onValueChange={(value) =>
                              updateSegment(segment.id, {
                                logic: value as AudienceSegment["logic"],
                              })
                            }
                            className="flex space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="AND"
                                id={`and-${segment.id}`}
                              />
                              <Label htmlFor={`and-${segment.id}`}>AND</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="OR"
                                id={`or-${segment.id}`}
                              />
                              <Label htmlFor={`or-${segment.id}`}>OR</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSegment(segment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {segment.rules.map((rule) => renderRule(segment.id, rule))}

                    <Button
                      variant="outline"
                      onClick={() => addRuleToSegment(segment.id)}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Targeting Rule
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          }
        </TabsContent>

        <TabsContent
          value="triggers"
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Behavioral Triggers</h3>
              <p className="text-sm text-muted-foreground">
                Define when notifications should be shown based on user behavior
              </p>
            </div>
            <Button onClick={addTrigger}>
              <Plus className="mr-2 h-4 w-4" />
              Add Trigger
            </Button>
          </div>

          {targeting.triggers.length === 0 ?
            <Card>
              <CardContent className="p-6 text-center">
                <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No triggers configured</h3>
                <p className="mb-4 text-muted-foreground">
                  Add behavioral triggers to control when notifications appear.
                </p>
                <Button onClick={addTrigger}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Trigger
                </Button>
              </CardContent>
            </Card>
          : <div className="space-y-4">{targeting.triggers.map(renderTrigger)}</div>}
        </TabsContent>

        <TabsContent
          value="frequency"
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Frequency Control</CardTitle>
              <CardDescription>
                Control how often notifications are shown to prevent overwhelming users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="max-per-session">Max per Session</Label>
                  <Input
                    id="max-per-session"
                    type="number"
                    min="1"
                    max="20"
                    value={targeting.frequency.maxPerSession}
                    onChange={(e) =>
                      updateTargeting({
                        frequency: {
                          ...targeting.frequency,
                          maxPerSession: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum notifications per user session
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-per-day">Max per Day</Label>
                  <Input
                    id="max-per-day"
                    type="number"
                    min="1"
                    max="100"
                    value={targeting.frequency.maxPerDay}
                    onChange={(e) =>
                      updateTargeting({
                        frequency: {
                          ...targeting.frequency,
                          maxPerDay: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum notifications per user per day
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    min="0"
                    max="1440"
                    value={targeting.frequency.cooldownMinutes}
                    onChange={(e) =>
                      updateTargeting({
                        frequency: {
                          ...targeting.frequency,
                          cooldownMinutes: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum time between notifications
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
