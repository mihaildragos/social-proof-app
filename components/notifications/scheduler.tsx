'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Clock, Calendar as CalendarIcon, Repeat, Play, Pause, AlertTriangle, Globe } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { ScheduleConfig } from '@/types/notifications'

interface CampaignSchedulerProps {
  value?: ScheduleConfig
  onChange: (schedule: ScheduleConfig) => void
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' }
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
]

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily', description: 'Run every day' },
  { value: 'weekly', label: 'Weekly', description: 'Run on specific days of the week' },
  { value: 'monthly', label: 'Monthly', description: 'Run on specific days of the month' }
]

export function CampaignScheduler({ value, onChange }: CampaignSchedulerProps) {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()

  const defaultSchedule: ScheduleConfig = {
    type: 'immediate',
    timezone: 'UTC',
    recurring: {
      frequency: 'daily',
      timeSlots: [{ start: '09:00', end: '17:00' }]
    }
  }

  const schedule = value || defaultSchedule

  const updateSchedule = (updates: Partial<ScheduleConfig>) => {
    onChange({ ...schedule, ...updates })
  }

  const addTimeSlot = () => {
    const newTimeSlot = { start: '09:00', end: '17:00' }
    const updatedTimeSlots = [...(schedule.recurring?.timeSlots || []), newTimeSlot]
    
    updateSchedule({
      recurring: {
        ...schedule.recurring,
        frequency: schedule.recurring?.frequency || 'daily',
        timeSlots: updatedTimeSlots
      }
    })
  }

  const updateTimeSlot = (index: number, field: 'start' | 'end', value: string) => {
    const updatedTimeSlots = [...(schedule.recurring?.timeSlots || [])]
    updatedTimeSlots[index] = { ...updatedTimeSlots[index], [field]: value }
    
    updateSchedule({
      recurring: {
        ...schedule.recurring,
        frequency: schedule.recurring?.frequency || 'daily',
        timeSlots: updatedTimeSlots
      }
    })
  }

  const removeTimeSlot = (index: number) => {
    const updatedTimeSlots = (schedule.recurring?.timeSlots || []).filter((_, i) => i !== index)
    
    updateSchedule({
      recurring: {
        ...schedule.recurring,
        frequency: schedule.recurring?.frequency || 'daily',
        timeSlots: updatedTimeSlots
      }
    })
  }

  const toggleDayOfWeek = (day: number) => {
    const currentDays = schedule.recurring?.daysOfWeek || []
    const updatedDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort()
    
    updateSchedule({
      recurring: {
        ...schedule.recurring,
        frequency: schedule.recurring?.frequency || 'weekly',
        daysOfWeek: updatedDays,
        timeSlots: schedule.recurring?.timeSlots || [{ start: '09:00', end: '17:00' }]
      }
    })
  }

  const getScheduleSummary = () => {
    switch (schedule.type) {
      case 'immediate':
        return 'Campaign will start immediately when created'
      case 'scheduled':
        return schedule.startDate 
          ? `Campaign will start on ${format(schedule.startDate, 'PPP')} at the specified time`
          : 'Campaign will start on the selected date'
      case 'recurring':
        const freq = schedule.recurring?.frequency
        const days = schedule.recurring?.daysOfWeek
        const timeSlots = schedule.recurring?.timeSlots || []
        
        let summary = `Campaign will run ${freq}`
        
        if (freq === 'weekly' && days && days.length > 0) {
          const dayNames = days.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short).join(', ')
          summary += ` on ${dayNames}`
        }
        
        if (timeSlots.length > 0) {
          const times = timeSlots.map(slot => `${slot.start}-${slot.end}`).join(', ')
          summary += ` between ${times}`
        }
        
        return summary
      default:
        return ''
    }
  }

  const validateSchedule = () => {
    const errors: string[] = []
    
    if (schedule.type === 'scheduled' && !schedule.startDate) {
      errors.push('Start date is required for scheduled campaigns')
    }
    
    if (schedule.type === 'recurring') {
      if (!schedule.recurring?.timeSlots || schedule.recurring.timeSlots.length === 0) {
        errors.push('At least one time slot is required for recurring campaigns')
      }
      
      if (schedule.recurring?.frequency === 'weekly' && (!schedule.recurring.daysOfWeek || schedule.recurring.daysOfWeek.length === 0)) {
        errors.push('At least one day of the week must be selected for weekly recurring campaigns')
      }
    }
    
    return errors
  }

  const validationErrors = validateSchedule()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Campaign Schedule</h2>
        <p className="text-muted-foreground">
          Configure when and how often your notification campaign should run.
        </p>
      </div>

      {/* Schedule Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Schedule Type</span>
          </CardTitle>
          <CardDescription>
            Choose when your campaign should start running
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={schedule.type}
            onValueChange={(value) => updateSchedule({ type: value as ScheduleConfig['type'] })}
            className="space-y-4"
          >
            <div className="flex items-center space-x-2 p-4 border rounded-lg">
              <RadioGroupItem value="immediate" id="immediate" />
              <div className="flex-1">
                <Label htmlFor="immediate" className="font-medium">Start Immediately</Label>
                <p className="text-sm text-muted-foreground">
                  Campaign begins as soon as it's created and approved
                </p>
              </div>
              <Play className="w-5 h-5 text-green-500" />
            </div>

            <div className="flex items-center space-x-2 p-4 border rounded-lg">
              <RadioGroupItem value="scheduled" id="scheduled" />
              <div className="flex-1">
                <Label htmlFor="scheduled" className="font-medium">Schedule for Later</Label>
                <p className="text-sm text-muted-foreground">
                  Set a specific start date and time for your campaign
                </p>
              </div>
              <CalendarIcon className="w-5 h-5 text-blue-500" />
            </div>

            <div className="flex items-center space-x-2 p-4 border rounded-lg">
              <RadioGroupItem value="recurring" id="recurring" />
              <div className="flex-1">
                <Label htmlFor="recurring" className="font-medium">Recurring Campaign</Label>
                <p className="text-sm text-muted-foreground">
                  Run campaign on a repeating schedule with specific time windows
                </p>
              </div>
              <Repeat className="w-5 h-5 text-purple-500" />
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Timezone Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5" />
            <span>Timezone</span>
          </CardTitle>
          <CardDescription>
            Select the timezone for your campaign schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={schedule.timezone}
            onValueChange={(value) => updateSchedule({ timezone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Scheduled Campaign Configuration */}
      {schedule.type === 'scheduled' && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Configuration</CardTitle>
            <CardDescription>
              Set the start and end dates for your campaign
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
                        !schedule.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {schedule.startDate ? (
                        format(schedule.startDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={schedule.startDate}
                      onSelect={(date) => updateSchedule({ startDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !schedule.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {schedule.endDate ? (
                        format(schedule.endDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={schedule.endDate}
                      onSelect={(date) => updateSchedule({ endDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recurring Campaign Configuration */}
      {schedule.type === 'recurring' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recurring Schedule</CardTitle>
              <CardDescription>
                Configure how often and when your campaign should run
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Frequency Selection */}
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={schedule.recurring?.frequency}
                  onValueChange={(value) => updateSchedule({
                    recurring: {
                      ...schedule.recurring,
                      frequency: value as 'daily' | 'weekly' | 'monthly',
                      timeSlots: schedule.recurring?.timeSlots || [{ start: '09:00', end: '17:00' }]
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(freq => (
                      <SelectItem key={freq.value} value={freq.value}>
                        <div>
                          <div className="font-medium">{freq.label}</div>
                          <div className="text-xs text-muted-foreground">{freq.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Days of Week Selection (for weekly frequency) */}
              {schedule.recurring?.frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>Days of Week</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <Button
                        key={day.value}
                        variant={schedule.recurring?.daysOfWeek?.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDayOfWeek(day.value)}
                        className="h-12 flex flex-col"
                      >
                        <span className="text-xs">{day.short}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Time Slots */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active Time Slots</Label>
                    <p className="text-sm text-muted-foreground">
                      Define when during the day notifications should be shown
                    </p>
                  </div>
                  <Button onClick={addTimeSlot} size="sm">
                    Add Time Slot
                  </Button>
                </div>

                <div className="space-y-3">
                  {(schedule.recurring?.timeSlots || []).map((slot, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
                      <div className="flex items-center space-x-2 flex-1">
                        <Label className="text-sm">From:</Label>
                        <Input
                          type="time"
                          value={slot.start}
                          onChange={(e) => updateTimeSlot(index, 'start', e.target.value)}
                          className="w-32"
                        />
                        <Label className="text-sm">To:</Label>
                        <Input
                          type="time"
                          value={slot.end}
                          onChange={(e) => updateTimeSlot(index, 'end', e.target.value)}
                          className="w-32"
                        />
                      </div>
                      {(schedule.recurring?.timeSlots || []).length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTimeSlot(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campaign Duration */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Duration</CardTitle>
              <CardDescription>
                Set the overall start and end dates for the recurring campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campaign Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !schedule.startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {schedule.startDate ? (
                          format(schedule.startDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={schedule.startDate}
                        onSelect={(date) => updateSchedule({ startDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Campaign End Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !schedule.endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {schedule.endDate ? (
                          format(schedule.endDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={schedule.endDate}
                        onSelect={(date) => updateSchedule({ endDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pause Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Pause className="w-5 h-5" />
            <span>Auto-Pause Conditions</span>
          </CardTitle>
          <CardDescription>
            Automatically pause the campaign when certain conditions are met
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Pause on Low Traffic</Label>
                <p className="text-sm text-muted-foreground">
                  Pause when website traffic is below normal levels
                </p>
              </div>
              <Switch
                checked={schedule.pauseConditions?.lowTraffic || false}
                onCheckedChange={(checked) => updateSchedule({
                  pauseConditions: {
                    ...schedule.pauseConditions,
                    lowTraffic: checked,
                    highBounceRate: schedule.pauseConditions?.highBounceRate || false
                  }
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Pause on High Bounce Rate</Label>
                <p className="text-sm text-muted-foreground">
                  Pause when bounce rate exceeds normal thresholds
                </p>
              </div>
              <Switch
                checked={schedule.pauseConditions?.highBounceRate || false}
                onCheckedChange={(checked) => updateSchedule({
                  pauseConditions: {
                    ...schedule.pauseConditions,
                    lowTraffic: schedule.pauseConditions?.lowTraffic || false,
                    highBounceRate: checked
                  }
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Summary</CardTitle>
          <CardDescription>
            Review your campaign schedule configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">{getScheduleSummary()}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {schedule.type === 'immediate' ? 'Now' : 
                   schedule.type === 'scheduled' ? '1x' : 
                   schedule.recurring?.frequency === 'daily' ? 'Daily' :
                   schedule.recurring?.frequency === 'weekly' ? 'Weekly' : 'Monthly'}
                </div>
                <div className="text-sm text-muted-foreground">Frequency</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{schedule.timezone}</div>
                <div className="text-sm text-muted-foreground">Timezone</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {schedule.type === 'recurring' ? (schedule.recurring?.timeSlots?.length || 0) : 'All Day'}
                </div>
                <div className="text-sm text-muted-foreground">Time Slots</div>
              </div>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-800">Configuration Issues</span>
                </div>
                <ul className="text-sm text-red-700 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 