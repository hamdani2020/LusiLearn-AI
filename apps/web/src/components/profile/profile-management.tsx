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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, User, Settings, Shield, BookOpen } from 'lucide-react'
import { 
  AgeRange, 
  EducationLevel, 
  UserProfile,
  LearningStyle,
  ContentType,
  DifficultyPreference 
} from '@/types'

const profileUpdateSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters'),
  ageRange: z.nativeEnum(AgeRange),
  educationLevel: z.nativeEnum(EducationLevel),
  timezone: z.string().min(1, 'Please select your timezone'),
  preferredLanguage: z.string().min(1, 'Please select your preferred language'),
})

const learningPreferencesSchema = z.object({
  learningStyle: z.array(z.nativeEnum(LearningStyle)).min(1, 'Please select at least one learning style'),
  preferredContentTypes: z.array(z.nativeEnum(ContentType)).min(1, 'Please select at least one content type'),
  sessionDuration: z.number().min(5, 'Session duration must be at least 5 minutes').max(180, 'Session duration cannot exceed 180 minutes'),
  difficultyPreference: z.nativeEnum(DifficultyPreference),
})

const privacySettingsSchema = z.object({
  profileVisibility: z.enum(['public', 'friends', 'private']),
  allowPeerMatching: z.boolean(),
  shareProgressData: z.boolean(),
  allowDataCollection: z.boolean(),
})

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>
type LearningPreferencesData = z.infer<typeof learningPreferencesSchema>
type PrivacySettingsData = z.infer<typeof privacySettingsSchema>

interface ProfileManagementProps {
  userProfile: UserProfile
  onUpdateProfile: (data: ProfileUpdateData) => Promise<void>
  onUpdateLearningPreferences: (data: LearningPreferencesData) => Promise<void>
  onUpdatePrivacySettings: (data: PrivacySettingsData) => Promise<void>
}

export function ProfileManagement({ 
  userProfile, 
  onUpdateProfile, 
  onUpdateLearningPreferences,
  onUpdatePrivacySettings 
}: ProfileManagementProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  // Profile form
  const profileForm = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      username: userProfile.username,
      ageRange: userProfile.demographics.ageRange,
      educationLevel: userProfile.demographics.educationLevel,
      timezone: userProfile.demographics.timezone,
      preferredLanguage: userProfile.demographics.preferredLanguage,
    },
  })

  // Learning preferences form
  const preferencesForm = useForm<LearningPreferencesData>({
    resolver: zodResolver(learningPreferencesSchema),
    defaultValues: {
      learningStyle: userProfile.learningPreferences.learningStyle,
      preferredContentTypes: userProfile.learningPreferences.preferredContentTypes,
      sessionDuration: userProfile.learningPreferences.sessionDuration,
      difficultyPreference: userProfile.learningPreferences.difficultyPreference,
    },
  })

  // Privacy settings form
  const privacyForm = useForm<PrivacySettingsData>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: {
      profileVisibility: userProfile.privacySettings.profileVisibility,
      allowPeerMatching: userProfile.privacySettings.allowPeerMatching,
      shareProgressData: userProfile.privacySettings.shareProgressData,
      allowDataCollection: userProfile.privacySettings.allowDataCollection,
    },
  })

  const handleProfileSubmit = async (data: ProfileUpdateData) => {
    setIsLoading('profile')
    try {
      await onUpdateProfile(data)
    } finally {
      setIsLoading(null)
    }
  }

  const handlePreferencesSubmit = async (data: LearningPreferencesData) => {
    setIsLoading('preferences')
    try {
      await onUpdateLearningPreferences(data)
    } finally {
      setIsLoading(null)
    }
  }

  const handlePrivacySubmit = async (data: PrivacySettingsData) => {
    setIsLoading('privacy')
    try {
      await onUpdatePrivacySettings(data)
    } finally {
      setIsLoading(null)
    }
  }

  const toggleLearningStyle = (style: LearningStyle) => {
    const currentStyles = preferencesForm.getValues('learningStyle')
    const newStyles = currentStyles.includes(style)
      ? currentStyles.filter(s => s !== style)
      : [...currentStyles, style]
    preferencesForm.setValue('learningStyle', newStyles)
  }

  const toggleContentType = (type: ContentType) => {
    const currentTypes = preferencesForm.getValues('preferredContentTypes')
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type]
    preferencesForm.setValue('preferredContentTypes', newTypes)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile Management</h1>
        <p className="text-muted-foreground">
          Manage your account settings and learning preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Learning
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Skills
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Update your basic profile information and demographics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      {...profileForm.register('username')}
                      data-testid="username"
                    />
                    {profileForm.formState.errors.username && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={userProfile.email} disabled />
                    <p className="text-xs text-muted-foreground">
                      Contact support to change your email address
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Age Range</Label>
                    <Select 
                      value={profileForm.watch('ageRange')} 
                      onValueChange={(value) => profileForm.setValue('ageRange', value as AgeRange)}
                    >
                      <SelectTrigger data-testid="age-range">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AgeRange.CHILD}>5-12 years</SelectItem>
                        <SelectItem value={AgeRange.TEEN}>13-17 years</SelectItem>
                        <SelectItem value={AgeRange.YOUNG_ADULT}>18-25 years</SelectItem>
                        <SelectItem value={AgeRange.ADULT}>26-40 years</SelectItem>
                        <SelectItem value={AgeRange.MATURE}>40+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Education Level</Label>
                    <Select 
                      value={profileForm.watch('educationLevel')} 
                      onValueChange={(value) => profileForm.setValue('educationLevel', value as EducationLevel)}
                    >
                      <SelectTrigger data-testid="education-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EducationLevel.ELEMENTARY}>Elementary</SelectItem>
                        <SelectItem value={EducationLevel.MIDDLE_SCHOOL}>Middle School</SelectItem>
                        <SelectItem value={EducationLevel.HIGH_SCHOOL}>High School</SelectItem>
                        <SelectItem value={EducationLevel.COLLEGE}>College</SelectItem>
                        <SelectItem value={EducationLevel.GRADUATE}>Graduate</SelectItem>
                        <SelectItem value={EducationLevel.PROFESSIONAL}>Professional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select 
                      value={profileForm.watch('timezone')} 
                      onValueChange={(value) => profileForm.setValue('timezone', value)}
                    >
                      <SelectTrigger data-testid="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">GMT</SelectItem>
                        <SelectItem value="Europe/Paris">CET</SelectItem>
                        <SelectItem value="Asia/Tokyo">JST</SelectItem>
                        <SelectItem value="Asia/Shanghai">CST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Language</Label>
                    <Select 
                      value={profileForm.watch('preferredLanguage')} 
                      onValueChange={(value) => profileForm.setValue('preferredLanguage', value)}
                    >
                      <SelectTrigger data-testid="preferred-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading === 'profile'}
                  data-testid="save-profile"
                >
                  {isLoading === 'profile' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learning Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Learning Preferences</CardTitle>
              <CardDescription>
                Customize your learning experience and content preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={preferencesForm.handleSubmit(handlePreferencesSubmit)} className="space-y-6">
                <div className="space-y-3">
                  <Label>Learning Styles</Label>
                  <p className="text-sm text-muted-foreground">
                    Select all learning styles that work best for you
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(LearningStyle).map((style) => (
                      <Badge
                        key={style}
                        variant={preferencesForm.watch('learningStyle').includes(style) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleLearningStyle(style)}
                      >
                        {style.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                  {preferencesForm.formState.errors.learningStyle && (
                    <p className="text-sm text-destructive">
                      {preferencesForm.formState.errors.learningStyle.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Preferred Content Types</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose the types of content you prefer for learning
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(ContentType).map((type) => (
                      <Badge
                        key={type}
                        variant={preferencesForm.watch('preferredContentTypes').includes(type) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleContentType(type)}
                      >
                        {type.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                  {preferencesForm.formState.errors.preferredContentTypes && (
                    <p className="text-sm text-destructive">
                      {preferencesForm.formState.errors.preferredContentTypes.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionDuration">Session Duration (minutes)</Label>
                    <Input
                      id="sessionDuration"
                      type="number"
                      min="5"
                      max="180"
                      {...preferencesForm.register('sessionDuration', { valueAsNumber: true })}
                      data-testid="session-duration"
                    />
                    {preferencesForm.formState.errors.sessionDuration && (
                      <p className="text-sm text-destructive">
                        {preferencesForm.formState.errors.sessionDuration.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Difficulty Preference</Label>
                    <Select 
                      value={preferencesForm.watch('difficultyPreference')} 
                      onValueChange={(value) => preferencesForm.setValue('difficultyPreference', value as DifficultyPreference)}
                    >
                      <SelectTrigger data-testid="difficulty-preference">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DifficultyPreference.GRADUAL}>Gradual progression</SelectItem>
                        <SelectItem value={DifficultyPreference.MODERATE}>Moderate challenge</SelectItem>
                        <SelectItem value={DifficultyPreference.CHALLENGING}>High challenge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading === 'preferences'}
                  data-testid="save-preferences"
                >
                  {isLoading === 'preferences' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Preferences
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Settings Tab */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control your privacy and data sharing preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={privacyForm.handleSubmit(handlePrivacySubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label>Profile Visibility</Label>
                  <Select 
                    value={privacyForm.watch('profileVisibility')} 
                    onValueChange={(value) => privacyForm.setValue('profileVisibility', value as 'public' | 'friends' | 'private')}
                  >
                    <SelectTrigger data-testid="profile-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public - Anyone can see your profile</SelectItem>
                      <SelectItem value="friends">Friends - Only your connections can see your profile</SelectItem>
                      <SelectItem value="private">Private - Only you can see your profile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Peer Matching</Label>
                      <p className="text-sm text-muted-foreground">
                        Let the system suggest study partners and collaborators
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      {...privacyForm.register('allowPeerMatching')}
                      className="h-4 w-4"
                      data-testid="allow-peer-matching"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Share Progress Data</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow anonymized progress data to help improve recommendations
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      {...privacyForm.register('shareProgressData')}
                      className="h-4 w-4"
                      data-testid="share-progress-data"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Data Collection</Label>
                      <p className="text-sm text-muted-foreground">
                        Help improve the platform by sharing usage analytics
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      {...privacyForm.register('allowDataCollection')}
                      className="h-4 w-4"
                      data-testid="allow-data-collection"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading === 'privacy'}
                  data-testid="save-privacy"
                >
                  {isLoading === 'privacy' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Privacy Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Skill Assessment</CardTitle>
                <CardDescription>
                  View and update your current skill levels across different subjects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userProfile.skillProfile.map((skill, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{skill.subject}</h4>
                        <p className="text-sm text-muted-foreground">
                          Last assessed: {new Date(skill.lastAssessed).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Level</p>
                          <div className="flex items-center gap-1">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${(skill.level / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold">{skill.level}/10</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Confidence</p>
                          <div className="flex items-center gap-1">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full" 
                                style={{ width: `${(skill.confidence / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold">{skill.confidence}/10</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Retake Assessment
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {userProfile.skillProfile.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No skill assessments completed yet
                      </p>
                      <Button>Take Initial Assessment</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Learning Goals Card */}
            <Card>
              <CardHeader>
                <CardTitle>Learning Goals</CardTitle>
                <CardDescription>
                  Set and track your learning objectives
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Master React Development</h4>
                      <p className="text-sm text-muted-foreground">
                        Target completion: March 2024
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <div className="flex items-center gap-1">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full w-3/4" />
                          </div>
                          <span className="text-sm font-bold">75%</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Advanced Mathematics</h4>
                      <p className="text-sm text-muted-foreground">
                        Target completion: June 2024
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <div className="flex items-center gap-1">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full w-1/3" />
                          </div>
                          <span className="text-sm font-bold">33%</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    Add New Learning Goal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}