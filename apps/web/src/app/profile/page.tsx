'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  UserProfile, 
  AgeRange, 
  EducationLevel, 
  LearningStyle, 
  ContentType, 
  DifficultyPreference 
} from '@/types'
import { User, BookOpen, Shield, Settings, Loader2 } from 'lucide-react'

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

// Mock user profile data for demonstration
const mockUserProfile: UserProfile = {
  id: 'user-123',
  email: 'student@example.com',
  username: 'student_learner',
  demographics: {
    ageRange: AgeRange.TEEN,
    educationLevel: EducationLevel.HIGH_SCHOOL,
    timezone: 'America/New_York',
    preferredLanguage: 'en',
  },
  learningPreferences: {
    learningStyle: [LearningStyle.VISUAL, LearningStyle.HANDS_ON],
    preferredContentTypes: [ContentType.VIDEO, ContentType.INTERACTIVE],
    sessionDuration: 45,
    difficultyPreference: DifficultyPreference.MODERATE,
  },
  skillProfile: [
    {
      subject: 'Mathematics',
      level: 7,
      confidence: 6,
      lastAssessed: new Date('2024-01-15'),
    },
    {
      subject: 'Programming',
      level: 5,
      confidence: 7,
      lastAssessed: new Date('2024-01-10'),
    },
    {
      subject: 'Science',
      level: 8,
      confidence: 8,
      lastAssessed: new Date('2024-01-12'),
    },
  ],
  privacySettings: {
    profileVisibility: 'friends',
    allowPeerMatching: true,
    shareProgressData: true,
    allowDataCollection: false,
  },
  parentalControls: {
    parentEmail: 'parent@example.com',
    restrictedInteractions: true,
    contentFiltering: 'moderate',
    timeRestrictions: {
      dailyLimit: 120,
      allowedHours: {
        start: '08:00',
        end: '20:00',
      },
    },
  },
  isVerified: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('profile')

  const handleUpdateProfile = async (data: any) => {
    // TODO: Implement actual profile update logic with API call
    console.log('Profile update:', data)
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Profile updated successfully! (This is a demo)')
  }

  const handleUpdateLearningPreferences = async (data: any) => {
    // TODO: Implement actual learning preferences update logic with API call
    console.log('Learning preferences update:', data)
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Learning preferences updated successfully! (This is a demo)')
  }

  const handleUpdatePrivacySettings = async (data: any) => {
    // TODO: Implement actual privacy settings update logic with API call
    console.log('Privacy settings update:', data)
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Privacy settings updated successfully! (This is a demo)')
  }

  const handleUpdateParentalControls = async (data: any) => {
    // TODO: Implement actual parental controls update logic with API call
    console.log('Parental controls update:', data)
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Parental controls updated successfully! (This is a demo)')
  }

  const handleUpdateNotifications = async (data: any) => {
    // TODO: Implement actual notification settings update logic with API call
    console.log('Notification settings update:', data)
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Notification settings updated successfully! (This is a demo)')
  }

  const handleChangePassword = async (data: any) => {
    // TODO: Implement actual password change logic with API call
    console.log('Password change:', data)
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Password changed successfully! (This is a demo)')
  }

  const handleExportData = async () => {
    // TODO: Implement actual data export logic
    console.log('Data export requested')
    await new Promise(resolve => setTimeout(resolve, 2000))
    alert('Data export completed! Check your downloads. (This is a demo)')
  }

  const handleDeleteAccount = async () => {
    // TODO: Implement actual account deletion logic
    console.log('Account deletion requested')
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Account deletion initiated. You will receive a confirmation email. (This is a demo)')
  }

  const isMinor = mockUserProfile.demographics.ageRange === AgeRange.CHILD || 
                  mockUserProfile.demographics.ageRange === AgeRange.TEEN

  return (
    <div className="min-h-screen bg-background">
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
              userProfile={mockUserProfile}
              onUpdateProfile={handleUpdateProfile}
              onUpdateLearningPreferences={handleUpdateLearningPreferences}
              onUpdatePrivacySettings={handleUpdatePrivacySettings}
            />
          </TabsContent>

          <TabsContent value="learning">
            <LearningPreferencesComponent
              preferences={{
                ...mockUserProfile.learningPreferences,
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
                userAge={mockUserProfile.demographics.ageRange}
                parentalControls={mockUserProfile.parentalControls}
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