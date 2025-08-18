'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Shield, Clock, Filter, Mail } from 'lucide-react'
import { ParentalControls, AgeRange } from '@/types'

const parentalControlsSchema = z.object({
  parentEmail: z.string().email('Please enter a valid parent email'),
  restrictedInteractions: z.boolean(),
  contentFiltering: z.enum(['strict', 'moderate', 'minimal']),
  dailyLimit: z.number().min(0, 'Daily limit must be at least 0 minutes').max(480, 'Daily limit cannot exceed 8 hours'),
  allowedStartHour: z.string(),
  allowedEndHour: z.string(),
}).refine((data) => {
  const start = parseInt(data.allowedStartHour)
  const end = parseInt(data.allowedEndHour)
  return start < end
}, {
  message: "End time must be after start time",
  path: ["allowedEndHour"],
})

type ParentalControlsData = z.infer<typeof parentalControlsSchema>

interface ParentalControlsProps {
  userAge: AgeRange
  parentalControls?: ParentalControls
  onUpdateParentalControls: (data: ParentalControlsData) => Promise<void>
  isParentView?: boolean
}

export function ParentalControlsComponent({ 
  userAge, 
  parentalControls, 
  onUpdateParentalControls,
  isParentView = false 
}: ParentalControlsProps) {
  const [isLoading, setIsLoading] = useState(false)
  
  const isMinor = userAge === AgeRange.CHILD || userAge === AgeRange.TEEN

  const form = useForm<ParentalControlsData>({
    resolver: zodResolver(parentalControlsSchema),
    defaultValues: {
      parentEmail: parentalControls?.parentEmail || '',
      restrictedInteractions: parentalControls?.restrictedInteractions || true,
      contentFiltering: parentalControls?.contentFiltering || 'strict',
      dailyLimit: parentalControls?.timeRestrictions.dailyLimit || 120,
      allowedStartHour: parentalControls?.timeRestrictions.allowedHours.start || '08:00',
      allowedEndHour: parentalControls?.timeRestrictions.allowedHours.end || '20:00',
    },
  })

  const handleSubmit = async (data: ParentalControlsData) => {
    setIsLoading(true)
    try {
      await onUpdateParentalControls(data)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isMinor && !isParentView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Parental Controls
          </CardTitle>
          <CardDescription>
            Parental controls are not applicable for adult accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            These settings are only available for users under 18 years old.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Parental Controls
          </CardTitle>
          <CardDescription>
            {isParentView 
              ? "Manage safety and time restrictions for your child's account"
              : "Safety settings managed by your parent/guardian"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Parent Email */}
            <div className="space-y-2">
              <Label htmlFor="parentEmail" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Parent/Guardian Email
              </Label>
              <Input
                id="parentEmail"
                type="email"
                placeholder="parent@example.com"
                {...form.register('parentEmail')}
                disabled={!isParentView}
                data-testid="parent-email"
              />
              {form.formState.errors.parentEmail && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.parentEmail.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                This email will receive notifications about account activity and safety alerts
              </p>
            </div>

            {/* Content Filtering */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Content Filtering Level
              </Label>
              <Select 
                value={form.watch('contentFiltering')} 
                onValueChange={(value) => form.setValue('contentFiltering', value as 'strict' | 'moderate' | 'minimal')}
                disabled={!isParentView}
              >
                <SelectTrigger data-testid="content-filtering">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Strict</span>
                      <span className="text-xs text-muted-foreground">
                        Maximum safety, age-appropriate content only
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="moderate">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Moderate</span>
                      <span className="text-xs text-muted-foreground">
                        Balanced filtering with some flexibility
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="minimal">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Minimal</span>
                      <span className="text-xs text-muted-foreground">
                        Basic safety filters only
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Current Filtering Level: {form.watch('contentFiltering')}</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  {form.watch('contentFiltering') === 'strict' && (
                    <>
                      <p>• Only educational content from verified sources</p>
                      <p>• No user-generated content or comments</p>
                      <p>• Supervised peer interactions only</p>
                      <p>• All content pre-screened for age appropriateness</p>
                    </>
                  )}
                  {form.watch('contentFiltering') === 'moderate' && (
                    <>
                      <p>• Educational content with moderated comments</p>
                      <p>• Limited peer interactions with monitoring</p>
                      <p>• Content filtered for inappropriate material</p>
                      <p>• Parent notifications for new connections</p>
                    </>
                  )}
                  {form.watch('contentFiltering') === 'minimal' && (
                    <>
                      <p>• Standard content filtering</p>
                      <p>• Peer interactions with safety monitoring</p>
                      <p>• Basic inappropriate content detection</p>
                      <p>• Standard safety reporting tools</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Interaction Restrictions */}
            <div className="space-y-3">
              <Label>Interaction Restrictions</Label>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">Restricted Interactions</p>
                  <p className="text-sm text-muted-foreground">
                    Limit interactions to verified mentors and supervised study groups
                  </p>
                </div>
                <input
                  type="checkbox"
                  {...form.register('restrictedInteractions')}
                  disabled={!isParentView}
                  className="h-4 w-4"
                  data-testid="restricted-interactions"
                />
              </div>
              
              {form.watch('restrictedInteractions') && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Restricted Mode Active</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• All peer interactions require adult supervision</p>
                    <p>• Only verified mentors can initiate contact</p>
                    <p>• Study groups limited to known participants</p>
                    <p>• All messages are monitored and logged</p>
                  </div>
                </div>
              )}
            </div>

            {/* Time Restrictions */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Restrictions
              </Label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dailyLimit">Daily Limit (minutes)</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    min="0"
                    max="480"
                    {...form.register('dailyLimit', { valueAsNumber: true })}
                    disabled={!isParentView}
                    data-testid="daily-limit"
                  />
                  {form.formState.errors.dailyLimit && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.dailyLimit.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allowedStartHour">Start Time</Label>
                  <Input
                    id="allowedStartHour"
                    type="time"
                    {...form.register('allowedStartHour')}
                    disabled={!isParentView}
                    data-testid="start-time"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allowedEndHour">End Time</Label>
                  <Input
                    id="allowedEndHour"
                    type="time"
                    {...form.register('allowedEndHour')}
                    disabled={!isParentView}
                    data-testid="end-time"
                  />
                  {form.formState.errors.allowedEndHour && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.allowedEndHour.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Current Schedule</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Daily Limit: {form.watch('dailyLimit')} minutes
                  </Badge>
                  <Badge variant="outline">
                    Allowed Hours: {form.watch('allowedStartHour')} - {form.watch('allowedEndHour')}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Safety Information */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">Safety Information</h4>
              <div className="text-sm text-yellow-800 space-y-1">
                <p>• All interactions are monitored by AI safety systems</p>
                <p>• Inappropriate content or behavior is automatically flagged</p>
                <p>• Parents receive weekly safety and progress reports</p>
                <p>• Emergency contact options are always available</p>
                <p>• Account activity logs are maintained for safety review</p>
              </div>
            </div>

            {isParentView && (
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="save-parental-controls"
                className="w-full"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Parental Controls
              </Button>
            )}

            {!isParentView && (
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  These settings can only be modified by your parent/guardian.
                  Contact them if you need any changes to your account restrictions.
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Emergency Contact Card */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency & Support</CardTitle>
          <CardDescription>
            Quick access to help and safety resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <span className="font-medium">Report Safety Concern</span>
              <span className="text-sm text-muted-foreground">
                Report inappropriate behavior or content
              </span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <span className="font-medium">Contact Parent</span>
              <span className="text-sm text-muted-foreground">
                Send a message to your parent/guardian
              </span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <span className="font-medium">Get Help</span>
              <span className="text-sm text-muted-foreground">
                Access help center and tutorials
              </span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <span className="font-medium">Technical Support</span>
              <span className="text-sm text-muted-foreground">
                Get help with technical issues
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}