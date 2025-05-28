'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Monitor, Tablet, Smartphone, Eye, Play, Pause, RotateCcw, Settings } from 'lucide-react'
import type { NotificationBuilderData, DevicePreview } from '@/types/notifications'

interface NotificationPreviewProps {
  notificationData: NotificationBuilderData
}

const DEVICE_PRESETS: DevicePreview[] = [
  {
    type: 'desktop',
    width: 1920,
    height: 1080,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    type: 'tablet',
    width: 768,
    height: 1024,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  {
    type: 'mobile',
    width: 375,
    height: 812,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  }
]

const DEVICE_ICONS = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone
}

const SAMPLE_DATA = {
  customer: 'Sarah M.',
  location: 'New York',
  product: 'Premium Plan',
  count: 23,
  review: 'Amazing product! Highly recommend it.',
  name: 'John D.'
}

export function NotificationPreview({ notificationData }: NotificationPreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState<DevicePreview>(DEVICE_PRESETS[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const { template, targeting, abTest, schedule } = notificationData

  if (!template) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Preview</h2>
          <p className="text-muted-foreground">
            Preview your notification across different devices and configurations.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 text-center">
            <Eye className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Template Selected</h3>
            <p className="text-muted-foreground">
              Please select a template in the first step to see the preview.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const interpolateMessage = (message: string) => {
    return message
      .replace(/\{customer\}/g, SAMPLE_DATA.customer)
      .replace(/\{location\}/g, SAMPLE_DATA.location)
      .replace(/\{product\}/g, SAMPLE_DATA.product)
      .replace(/\{count\}/g, SAMPLE_DATA.count.toString())
      .replace(/\{review\}/g, SAMPLE_DATA.review)
      .replace(/\{name\}/g, SAMPLE_DATA.name)
  }

  const getPositionClasses = (position: string) => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-right':
        return 'bottom-4 right-4'
      case 'center':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
      default:
        return 'bottom-4 right-4'
    }
  }

  const getAnimationClasses = (animation: string) => {
    switch (animation) {
      case 'slide':
        return 'animate-slide-in'
      case 'fade':
        return 'animate-fade-in'
      case 'bounce':
        return 'animate-bounce-in'
      default:
        return ''
    }
  }

  const renderNotification = () => {
    const positionClasses = getPositionClasses(template.styling.position)
    const animationClasses = isPlaying ? getAnimationClasses(template.styling.animation) : ''

    return (
      <div
        className={`
          absolute max-w-sm p-4 rounded-lg shadow-lg border z-10
          ${positionClasses} ${animationClasses}
        `}
        style={{
          backgroundColor: template.styling.colors.background,
          color: template.styling.colors.text,
          borderColor: template.styling.colors.accent
        }}
      >
        <div className="space-y-2">
          <div className="font-semibold text-sm">
            {template.content.title}
          </div>
          <div className="text-sm opacity-90">
            {interpolateMessage(template.content.message)}
          </div>
          {template.content.cta && (
            <Button
              size="sm"
              className="mt-2 text-xs"
              style={{ 
                backgroundColor: template.styling.colors.accent,
                color: template.styling.colors.background
              }}
            >
              {template.content.cta.text}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const renderDeviceFrame = () => {
    const scale = selectedDevice.type === 'desktop' ? 0.5 : selectedDevice.type === 'tablet' ? 0.7 : 0.9

    return (
      <div className="flex justify-center">
        <div
          className="relative bg-gray-100 rounded-lg overflow-hidden border-8 border-gray-800"
          style={{
            width: selectedDevice.width * scale,
            height: selectedDevice.height * scale,
            maxWidth: '100%',
            maxHeight: '600px'
          }}
        >
          {/* Mock website content */}
          <div className="w-full h-full bg-white">
            {/* Header */}
            <div className="h-16 bg-gray-50 border-b flex items-center px-4">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div className="ml-4 flex-1 bg-gray-200 rounded px-3 py-1 text-xs text-gray-600">
                https://example.com
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 rounded"></div>
                <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                <div className="h-4 bg-gray-100 rounded w-4/6"></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="h-32 bg-gray-100 rounded"></div>
                <div className="h-32 bg-gray-100 rounded"></div>
              </div>
            </div>

            {/* Notification */}
            {renderNotification()}
          </div>
        </div>
      </div>
    )
  }

  const renderConfigurationSummary = () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold mb-2">Template Configuration</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline">{template.type}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position:</span>
            <span>{template.styling.position}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Animation:</span>
            <span>{template.styling.animation}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration:</span>
            <span>{template.styling.duration}ms</span>
          </div>
        </div>
      </div>

      {targeting && (
        <div>
          <h4 className="font-semibold mb-2">Targeting</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Segments:</span>
              <span>{targeting.segments.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Triggers:</span>
              <span>{targeting.triggers.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max per session:</span>
              <span>{targeting.frequency.maxPerSession}</span>
            </div>
          </div>
        </div>
      )}

      {abTest?.enabled && (
        <div>
          <h4 className="font-semibold mb-2">A/B Testing</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Variants:</span>
              <span>{abTest.variants.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Traffic split:</span>
              <span>{abTest.trafficSplit}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Primary goal:</span>
              <span>{abTest.goals.primary}</span>
            </div>
          </div>
        </div>
      )}

      {schedule && (
        <div>
          <h4 className="font-semibold mb-2">Schedule</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <Badge variant="outline">{schedule.type}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timezone:</span>
              <span>{schedule.timezone}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Preview</h2>
          <p className="text-muted-foreground">
            See how your notification will appear across different devices.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Play Animation
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsPlaying(false)
              setTimeout(() => setIsPlaying(true), 100)
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Replay
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Device Preview</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {DEVICE_PRESETS.map((device) => {
                    const Icon = DEVICE_ICONS[device.type]
                    return (
                      <Button
                        key={device.type}
                        variant={selectedDevice.type === device.type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedDevice(device)}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {device.type.charAt(0).toUpperCase() + device.type.slice(1)}
                      </Button>
                    )
                  })}
                </div>
              </div>
              <CardDescription>
                Preview how your notification appears on {selectedDevice.type} devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderDeviceFrame()}
              
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {selectedDevice.width} × {selectedDevice.height} • {selectedDevice.type}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Summary of your notification settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderConfigurationSummary()}
            </CardContent>
          </Card>

          {/* A/B Test Variants */}
          {abTest?.enabled && abTest.variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>A/B Test Variants</CardTitle>
                <CardDescription>
                  Preview different test variants
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {abTest.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{variant.name}</span>
                        {variant.isControl && (
                          <Badge variant="secondary" className="text-xs">Control</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{variant.weight}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Estimates */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Estimates</CardTitle>
              <CardDescription>
                Estimated metrics based on configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Expected CTR:</span>
                  <span className="text-sm font-medium">2.5-4.2%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Visibility score:</span>
                  <span className="text-sm font-medium">High</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">User experience:</span>
                  <span className="text-sm font-medium">Good</span>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground">
                  Estimates based on template type, position, and timing configuration.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 