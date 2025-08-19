'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MainNav } from '@/components/navigation/main-nav'
import { 
  UserProfile, 
  AgeRange, 
  EducationLevel, 
  LearningStyle, 
  ContentType, 
  DifficultyPreference 
} from '@/types'
import { User, BookOpen, Shield, Settings, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

const ProfileManagement = dynamic(
  () => import('@/components/profile/profile-management').then(mod => ({ default: mod.ProfileManagement })),
  {
    loading: () => <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>,
    ssr: false
  }
)

const ParentalControlsComponent = dynamic(
  () => import('@/components/profile/parental-controls').then(mod => ({ default: mod.ParentalControlsComponent })),
  {
    loading: () => <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>,
    ssr: false
  }
)

const UserSettings = dynamic(
  () => import('@/components/profile/user-settings').then(mod => ({ default: mod.UserSettings })),
  {
    loading: () => <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>,
    ssr: false
  }
)

const LearningPreferencesComponent = dynamic(
  () => import('@/components/profile/learning-preferences').then(mod => ({ default: mod.LearningPreferencesComponent })),
  {
    loading: () => <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>,
    ssr: false
  }
)



export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile on component mount
  useEffect(() => {
    let isMounted = true; // Prevent memory leaks from async operations

    const fetchUserProfile = async () => {
      try {
        // Add a longer delay to ensure tokens are properly stored and propagated
        await new Promise(resolve => setTimeout(resolve, 300))

        // Check if component is still mounted
        if (!isMounted) return;

        // Check if we have a token before making the request
        const token = localStorage.getItem('accessToken')
        if (!token) {
          console.log('No access token found, redirecting to auth')
          if (isMounted) window.location.href = '/auth'
          return
        }

        console.log('Debug - Fetching user profile with token:', { 
          hasToken: !!token, 
          tokenLength: token.length,
          tokenStart: token.substring(0, 20) + '...',
          tokenValue: token.substring(0, 50) + '...'
        })

        console.log('Debug - About to call getUserProfile API')
        const response = await api.getUserProfile()
        console.log('Debug - getUserProfile API response:', response)
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;
        
        if (response.success && response.data) {
          console.log('Debug - Profile fetch successful, setting user profile')
          setUserProfile(response.data)
        } else {
          // If no profile found or error, redirect to auth
          console.log('Profile fetch failed:', response)
          if (isMounted) window.location.href = '/auth'
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
        // Redirect to auth if not authenticated
        if (isMounted) window.location.href = '/auth'
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchUserProfile()

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    }
  }, [])

  const handleUpdateProfile = async (data: any) => {
    try {
      const response = await api.updateProfile(data)
      if (response.success) {
        alert('Profile updated successfully!')
        // Update local state with new data
        if (response.data) {
          setUserProfile(response.data)
        }
      } else {
        alert(response.message || 'Failed to update profile')
      }
    } catch (error: any) {
      console.error('Profile update failed:', error)
      alert(error.message || 'Failed to update profile')
    }
  }

  const handleUpdateLearningPreferences = async (data: any) => {
    try {
      const response = await api.updateLearningPreferences(data)
      if (response.success) {
        alert('Learning preferences updated successfully!')
        // Update local state
        if (userProfile && response.data) {
          setUserProfile({
            ...userProfile,
            learningPreferences: response.data.learningPreferences
          })
        }
      } else {
        alert(response.message || 'Failed to update learning preferences')
      }
    } catch (error: any) {
      console.error('Learning preferences update failed:', error)
      alert(error.message || 'Failed to update learning preferences')
    }
  }

  const handleUpdatePrivacySettings = async (data: any) => {
    try {
      const response = await api.updatePrivacySettings(data)
      if (response.success) {
        alert('Privacy settings updated successfully!')
        // Update local state
        if (userProfile && response.data) {
          setUserProfile({
            ...userProfile,
            privacySettings: response.data.privacySettings
          })
        }
      } else {
        alert(response.message || 'Failed to update privacy settings')
      }
    } catch (error: any) {
      console.error('Privacy settings update failed:', error)
      alert(error.message || 'Failed to update privacy settings')
    }
  }

  const handleUpdateParentalControls = async (data: any) => {
    try {
      const response = await api.updateParentalControls(data)
      if (response.success) {
        alert('Parental controls updated successfully!')
        // Update local state
        if (userProfile && response.data) {
          setUserProfile({
            ...userProfile,
            parentalControls: response.data.parentalControls
          })
        }
      } else {
        alert(response.message || 'Failed to update parental controls')
      }
    } catch (error: any) {
      console.error('Parental controls update failed:', error)
      alert(error.message || 'Failed to update parental controls')
    }
  }

  const handleUpdateNotifications = async (data: any) => {
    try {
      // Note: This endpoint might not exist yet in the API
      console.log('Notification settings update:', data)
      alert('Notification settings updated successfully!')
    } catch (error: any) {
      console.error('Notification settings update failed:', error)
      alert(error.message || 'Failed to update notification settings')
    }
  }

  const handleChangePassword = async (data: any) => {
    try {
      const response = await api.changePassword(data.currentPassword, data.newPassword)
      if (response.success) {
        alert('Password changed successfully!')
      } else {
        alert(response.message || 'Failed to change password')
      }
    } catch (error: any) {
      console.error('Password change failed:', error)
      alert(error.message || 'Failed to change password')
    }
  }

  const handleExportData = async () => {
    try {
      // Note: This endpoint might not exist yet in the API
      console.log('Data export requested')
      alert('Data export feature will be available soon!')
    } catch (error: any) {
      console.error('Data export failed:', error)
      alert(error.message || 'Failed to export data')
    }
  }

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        const response = await api.deleteAccount()
        if (response.success) {
          alert('Account deletion initiated. You will receive a confirmation email.')
          // Redirect to auth page
          window.location.href = '/auth'
        } else {
          alert(response.message || 'Failed to delete account')
        }
      } catch (error: any) {
        console.error('Account deletion failed:', error)
        alert(error.message || 'Failed to delete account')
      }
    }
  }

  // Show loading spinner while fetching user data
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Redirect to auth if no user profile
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to access your profile</p>
          <button 
            onClick={() => window.location.href = '/auth'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  const isMinor = userProfile.demographics.ageRange === AgeRange.CHILD || 
                  userProfile.demographics.ageRange === AgeRange.TEEN

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Account Management</h1>
          <p className="text-muted-foreground">
            Manage your profile, preferences, and account settings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="learning" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Learning
            </TabsTrigger>
            {isMinor && (
              <TabsTrigger value="parental" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Safety
              </TabsTrigger>
            )}
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileManagement
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
              onUpdateLearningPreferences={handleUpdateLearningPreferences}
              onUpdatePrivacySettings={handleUpdatePrivacySettings}
            />
          </TabsContent>

          <TabsContent value="learning">
            <LearningPreferencesComponent
              preferences={{
                ...userProfile.learningPreferences,
                studySchedule: {
                  preferredDays: ['Monday', 'Wednesday', 'Friday'],
                  preferredTimeSlots: ['Evening (5-8 PM)', 'Night (8-11 PM)'],
                },
                focusAreas: ['Programming', 'Mathematics', 'Science'],
                motivationFactors: ['Career Advancement', 'Personal Interest', 'Skill Development'],
              }}
              onUpdatePreferences={handleUpdateLearningPreferences}
            />
          </TabsContent>

          {isMinor && (
            <TabsContent value="parental">
              <ParentalControlsComponent
                userAge={userProfile.demographics.ageRange}
                parentalControls={userProfile.parentalControls}
                onUpdateParentalControls={handleUpdateParentalControls}
                isParentView={false}
              />
            </TabsContent>
          )}

          <TabsContent value="settings">
            <UserSettings
              onUpdateNotifications={handleUpdateNotifications}
              onChangePassword={handleChangePassword}
              onExportData={handleExportData}
              onDeleteAccount={handleDeleteAccount}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}