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
import { Loader2, Bell, Eye, Download, Trash2 } from 'lucide-react'

const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  weeklyProgress: z.boolean(),
  peerMessages: z.boolean(),
  systemUpdates: z.boolean(),
  marketingEmails: z.boolean(),
})

const accountSettingsSchema = z.object({
  currentPassword: z.string().min(8, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type NotificationSettingsData = z.infer<typeof notificationSettingsSchema>
type AccountSettingsData = z.infer<typeof accountSettingsSchema>

interface UserSettingsProps {
  onUpdateNotifications: (data: NotificationSettingsData) => Promise<void>
  onChangePassword: (data: AccountSettingsData) => Promise<void>
  onExportData: () => Promise<void>
  onDeleteAccount: () => Promise<void>
}

export function UserSettings({ 
  onUpdateNotifications, 
  onChangePassword,
  onExportData,
  onDeleteAccount 
}: UserSettingsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  // Notification settings form
  const notificationForm = useForm<NotificationSettingsData>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailNotifications: true,
      pushNotifications: true,
      weeklyProgress: true,
      peerMessages: true,
      systemUpdates: true,
      marketingEmails: false,
    },
  })

  // Password change form
  const passwordForm = useForm<AccountSettingsData>({
    resolver: zodResolver(accountSettingsSchema),
  })

  const handleNotificationSubmit = async (data: NotificationSettingsData) => {
    setIsLoading('notifications')
    try {
      await onUpdateNotifications(data)
    } finally {
      setIsLoading(null)
    }
  }

  const handlePasswordSubmit = async (data: AccountSettingsData) => {
    setIsLoading('password')
    try {
      await onChangePassword(data)
      passwordForm.reset()
    } finally {
      setIsLoading(null)
    }
  }

  const handleExportData = async () => {
    setIsLoading('export')
    try {
      await onExportData()
    } finally {
      setIsLoading(null)
    }
  }

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      setIsLoading('delete')
      try {
        await onDeleteAccount()
      } finally {
        setIsLoading(null)
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and security settings
        </p>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications and updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={notificationForm.handleSubmit(handleNotificationSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive important updates via email
                  </p>
                </div>
                <input
                  type="checkbox"
                  {...notificationForm.register('emailNotifications')}
                  className="h-4 w-4"
                  data-testid="email-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get real-time notifications in your browser
                  </p>
                </div>
                <input
                  type="checkbox"
                  {...notificationForm.register('pushNotifications')}
                  className="h-4 w-4"
                  data-testid="push-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Progress Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly summaries of your learning progress
                  </p>
                </div>
                <input
                  type="checkbox"
                  {...notificationForm.register('weeklyProgress')}
                  className="h-4 w-4"
                  data-testid="weekly-progress"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Peer Messages</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when peers send you messages
                  </p>
                </div>
                <input
                  type="checkbox"
                  {...notificationForm.register('peerMessages')}
                  className="h-4 w-4"
                  data-testid="peer-messages"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>System Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Important platform updates and maintenance notices
                  </p>
                </div>
                <input
                  type="checkbox"
                  {...notificationForm.register('systemUpdates')}
                  className="h-4 w-4"
                  data-testid="system-updates"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Promotional content and feature announcements
                  </p>
                </div>
                <input
                  type="checkbox"
                  {...notificationForm.register('marketingEmails')}
                  className="h-4 w-4"
                  data-testid="marketing-emails"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading === 'notifications'}
              data-testid="save-notifications"
            >
              {isLoading === 'notifications' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Notification Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password for better security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter your current password"
                {...passwordForm.register('currentPassword')}
                data-testid="current-password"
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter your new password"
                {...passwordForm.register('newPassword')}
                data-testid="new-password"
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                {...passwordForm.register('confirmPassword')}
                data-testid="confirm-new-password"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading === 'password'}
              data-testid="change-password"
            >
              {isLoading === 'password' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Export your data or manage your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Export Your Data</h4>
              <p className="text-sm text-muted-foreground">
                Download a copy of all your learning data and progress
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={isLoading === 'export'}
              data-testid="export-data"
            >
              {isLoading === 'export' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Export Data
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
            <div>
              <h4 className="font-medium text-red-900">Delete Account</h4>
              <p className="text-sm text-red-700">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isLoading === 'delete'}
              data-testid="delete-account"
            >
              {isLoading === 'delete' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            View your account details and membership information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Account Created</Label>
              <p className="text-sm">January 15, 2024</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Last Login</Label>
              <p className="text-sm">Today at 2:30 PM</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Total Learning Time</Label>
              <p className="text-sm">47 hours, 23 minutes</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Completed Courses</Label>
              <p className="text-sm">12 courses</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}