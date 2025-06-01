'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, Trash2, FlaskConical, Target, Calendar as CalendarIcon, TrendingUp, Users, Crown } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { ABTestConfig, ABTestVariant, NotificationTemplate } from '@/types/notifications'

interface ABTestConfigProps {
  value?: ABTestConfig
  onChange: (abTest: ABTestConfig) => void
}

const GOAL_OPTIONS = [
  { value: 'clicks', label: 'Click-through Rate', description: 'Measure notification clicks' },
  { value: 'conversions', label: 'Conversion Rate', description: 'Measure completed actions' },
  { value: 'engagement', label: 'Engagement Rate', description: 'Measure user interaction' },
  { value: 'revenue', label: 'Revenue per User', description: 'Measure revenue impact' }
]

const SIGNIFICANCE_LEVELS = [
  { value: 0.90, label: '90% (Less strict)' },
  { value: 0.95, label: '95% (Standard)' },
  { value: 0.99, label: '99% (Very strict)' }
]

export function ABTestConfig({ value, onChange }: ABTestConfigProps) {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()

  const defaultConfig: ABTestConfig = {
    enabled: false,
    name: '',
    description: '',
    variants: [],
    trafficSplit: 50,
    duration: {
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
    },
    goals: {
      primary: 'clicks'
    },
    significanceLevel: 0.95,
    minimumSampleSize: 1000
  }

  const abTest = value || defaultConfig

  const updateABTest = (updates: Partial<ABTestConfig>) => {
    onChange({ ...abTest, ...updates })
  }

  const addVariant = () => {
    const isFirstVariant = abTest.variants.length === 0
    const newVariant: ABTestVariant = {
      id: `variant-${Date.now()}`,
      name: isFirstVariant ? 'Control (A)' : `Variant ${String.fromCharCode(65 + abTest.variants.length)}`,
      weight: Math.floor(100 / (abTest.variants.length + 1)),
      template: {} as NotificationTemplate, // This would be set from the template selector
      isControl: isFirstVariant
    }

    // Redistribute weights evenly
    const totalVariants = abTest.variants.length + 1
    const evenWeight = Math.floor(100 / totalVariants)
    const updatedVariants = abTest.variants.map(variant => ({
      ...variant,
      weight: evenWeight
    }))

    updateABTest({
      variants: [...updatedVariants, { ...newVariant, weight: evenWeight }]
    })
  }

  const updateVariant = (variantId: string, updates: Partial<ABTestVariant>) => {
    const updatedVariants = abTest.variants.map(variant =>
      variant.id === variantId ? { ...variant, ...updates } : variant
    )
    updateABTest({ variants: updatedVariants })
  }

  const removeVariant = (variantId: string) => {
    const updatedVariants = abTest.variants.filter(variant => variant.id !== variantId)
    
    // Redistribute weights evenly
    if (updatedVariants.length > 0) {
      const evenWeight = Math.floor(100 / updatedVariants.length)
      const redistributed = updatedVariants.map(variant => ({
        ...variant,
        weight: evenWeight
      }))
      updateABTest({ variants: redistributed })
    } else {
      updateABTest({ variants: [] })
    }
  }

  const updateVariantWeight = (variantId: string, newWeight: number) => {
    const variant = abTest.variants.find(v => v.id === variantId)
    if (!variant) return

    const otherVariants = abTest.variants.filter(v => v.id !== variantId)
    const remainingWeight = 100 - newWeight
    
    if (otherVariants.length === 0) return

    // Distribute remaining weight proportionally among other variants
    const totalOtherWeight = otherVariants.reduce((sum, v) => sum + v.weight, 0)
    
    const updatedVariants = abTest.variants.map(v => {
      if (v.id === variantId) {
        return { ...v, weight: newWeight }
      } else {
        const proportion = totalOtherWeight > 0 ? v.weight / totalOtherWeight : 1 / otherVariants.length
        return { ...v, weight: Math.round(remainingWeight * proportion) }
      }
    })

    updateABTest({ variants: updatedVariants })
  }

  const totalWeight = abTest.variants.reduce((sum, variant) => sum + variant.weight, 0)

  if (!abTest.enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">A/B Testing</h2>
          <p className="text-muted-foreground">
            Test different notification variants to optimize performance.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 text-center">
            <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">A/B Testing Disabled</h3>
            <p className="text-muted-foreground mb-4">
              Enable A/B testing to compare different notification variants and optimize your campaigns.
            </p>
            <div className="flex items-center justify-center space-x-2">
              <Switch
                checked={abTest.enabled}
                onCheckedChange={(enabled) => updateABTest({ enabled })}
              />
              <Label>Enable A/B Testing</Label>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">A/B Testing Configuration</h2>
          <p className="text-muted-foreground">
            Configure your A/B test to compare notification variants.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={abTest.enabled}
            onCheckedChange={(enabled) => updateABTest({ enabled })}
          />
          <Label>A/B Testing Enabled</Label>
        </div>
      </div>

      {/* Basic Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Set up the basic parameters for your A/B test
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-name">Test Name</Label>
              <Input
                id="test-name"
                placeholder="My A/B Test"
                value={abTest.name}
                onChange={(e) => updateABTest({ name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="traffic-split">Traffic Split (%)</Label>
              <Input
                id="traffic-split"
                type="number"
                min="1"
                max="100"
                value={abTest.trafficSplit}
                onChange={(e) => updateABTest({ trafficSplit: parseInt(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Percentage of users included in the test
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-description">Description</Label>
            <Textarea
              id="test-description"
              placeholder="Describe what you're testing..."
              value={abTest.description}
              onChange={(e) => updateABTest({ description: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Duration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5" />
            <span>Test Duration</span>
          </CardTitle>
          <CardDescription>
            Set when your A/B test should start and end
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !abTest.duration.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {abTest.duration.startDate ? (
                      format(abTest.duration.startDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={abTest.duration.startDate}
                    onSelect={(date) => updateABTest({
                      duration: { ...abTest.duration, startDate: date || new Date() }
                    })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !abTest.duration.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {abTest.duration.endDate ? (
                      format(abTest.duration.endDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={abTest.duration.endDate}
                    onSelect={(date) => updateABTest({
                      duration: { ...abTest.duration, endDate: date || new Date() }
                    })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Test Goals</span>
          </CardTitle>
          <CardDescription>
            Define what you want to measure and optimize for
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Goal</Label>
              <Select
                value={abTest.goals.primary}
                onValueChange={(value) => updateABTest({
                  goals: { ...abTest.goals, primary: value as ABTestConfig['goals']['primary'] }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_OPTIONS.map(goal => (
                    <SelectItem key={goal.value} value={goal.value}>
                      <div>
                        <div className="font-medium">{goal.label}</div>
                        <div className="text-xs text-muted-foreground">{goal.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Significance Level</Label>
              <Select
                value={abTest.significanceLevel.toString()}
                onValueChange={(value) => updateABTest({ significanceLevel: parseFloat(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGNIFICANCE_LEVELS.map(level => (
                    <SelectItem key={level.value} value={level.value.toString()}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sample-size">Minimum Sample Size</Label>
            <Input
              id="sample-size"
              type="number"
              min="100"
              value={abTest.minimumSampleSize}
              onChange={(e) => updateABTest({ minimumSampleSize: parseInt(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Minimum number of users per variant before results are considered reliable
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Variants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FlaskConical className="w-5 h-5" />
                <span>Test Variants</span>
              </CardTitle>
              <CardDescription>
                Create different versions of your notification to test
              </CardDescription>
            </div>
            <Button onClick={addVariant} disabled={abTest.variants.length >= 5}>
              <Plus className="w-4 h-4 mr-2" />
              Add Variant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {abTest.variants.length === 0 ? (
            <div className="text-center py-8">
              <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No variants created</h3>
              <p className="text-muted-foreground mb-4">
                Create at least 2 variants to start your A/B test.
              </p>
              <Button onClick={addVariant}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Variant
              </Button>
            </div>
          ) : (
            <>
              {/* Weight Distribution Warning */}
              {totalWeight !== 100 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Variant weights total {totalWeight}%. They should add up to 100%.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {abTest.variants.map((variant, index) => (
                  <div key={variant.id} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {variant.isControl && <Crown className="w-4 h-4 text-yellow-500" />}
                        <Input
                          className="font-semibold border-none p-0 h-auto"
                          value={variant.name}
                          onChange={(e) => updateVariant(variant.id, { name: e.target.value })}
                          placeholder={`Variant ${String.fromCharCode(65 + index)}`}
                        />
                        {variant.isControl && (
                          <Badge variant="secondary">Control</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm">Weight:</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="w-20"
                            value={variant.weight}
                            onChange={(e) => updateVariantWeight(variant.id, parseInt(e.target.value))}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                        {!variant.isControl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariant(variant.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-muted rounded border-dashed border-2">
                      <p className="text-sm text-muted-foreground text-center">
                        Template configuration will be inherited from the main template selector.
                        You can customize this variant's template in the preview step.
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {abTest.variants.length < 2 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 Add at least one more variant to enable A/B testing.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Test Summary */}
      {abTest.variants.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Test Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{abTest.variants.length}</div>
                <div className="text-sm text-muted-foreground">Variants</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{abTest.trafficSplit}%</div>
                <div className="text-sm text-muted-foreground">Traffic Split</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {abTest.duration.startDate && abTest.duration.endDate
                    ? Math.ceil((abTest.duration.endDate.getTime() - abTest.duration.startDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 0}
                </div>
                <div className="text-sm text-muted-foreground">Days</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 