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
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AgeRange, EducationLevel } from '@/types'

const registrationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  ageRange: z.nativeEnum(AgeRange),
  educationLevel: z.nativeEnum(EducationLevel),
  timezone: z.string().min(1, 'Please select your timezone'),
  preferredLanguage: z.string().min(1, 'Please select your preferred language'),
  parentEmail: z.string().email('Please enter a valid parent email').optional().or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  // Require parent email for minors
  if (data.ageRange === AgeRange.CHILD || data.ageRange === AgeRange.TEEN) {
    return data.parentEmail && data.parentEmail.length > 0
  }
  return true
}, {
  message: "Parent email is required for users under 18",
  path: ["parentEmail"],
})

type RegistrationFormData = z.infer<typeof registrationSchema>

interface RegistrationFormProps {
  onSubmit: (data: RegistrationFormData) => Promise<void>
  onSwitchToLogin: () => void
}

export function RegistrationForm({ onSubmit, onSwitchToLogin }: RegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
  })

  const ageRange = watch('ageRange')
  const isMinor = ageRange === AgeRange.CHILD || ageRange === AgeRange.TEEN

  const handleFormSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true)
    try {
      await onSubmit(data)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Join LusiLearn AI and start your personalized learning journey
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...register('email')}
              data-testid="email"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Choose a username"
              {...register('username')}
              data-testid="username"
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                {...register('password')}
                data-testid="password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                {...register('confirmPassword')}
                data-testid="confirm-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ageRange">Age Range</Label>
              <Select onValueChange={(value) => setValue('ageRange', value as AgeRange)}>
                <SelectTrigger data-testid="age-range">
                  <SelectValue placeholder="Select age" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AgeRange.CHILD}>5-12 years</SelectItem>
                  <SelectItem value={AgeRange.TEEN}>13-17 years</SelectItem>
                  <SelectItem value={AgeRange.YOUNG_ADULT}>18-25 years</SelectItem>
                  <SelectItem value={AgeRange.ADULT}>26-40 years</SelectItem>
                  <SelectItem value={AgeRange.MATURE}>40+ years</SelectItem>
                </SelectContent>
              </Select>
              {errors.ageRange && (
                <p className="text-sm text-destructive">{errors.ageRange.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="educationLevel">Education Level</Label>
              <Select onValueChange={(value) => setValue('educationLevel', value as EducationLevel)}>
                <SelectTrigger data-testid="education-level">
                  <SelectValue placeholder="Select level" />
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
              {errors.educationLevel && (
                <p className="text-sm text-destructive">{errors.educationLevel.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select onValueChange={(value) => setValue('timezone', value)}>
                <SelectTrigger data-testid="timezone">
                  <SelectValue placeholder="Select timezone" />
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
              {errors.timezone && (
                <p className="text-sm text-destructive">{errors.timezone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">Language</Label>
              <Select onValueChange={(value) => setValue('preferredLanguage', value)}>
                <SelectTrigger data-testid="preferred-language">
                  <SelectValue placeholder="Select language" />
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
              {errors.preferredLanguage && (
                <p className="text-sm text-destructive">{errors.preferredLanguage.message}</p>
              )}
            </div>
          </div>

          {isMinor && (
            <div className="space-y-2">
              <Label htmlFor="parentEmail">Parent/Guardian Email</Label>
              <Input
                id="parentEmail"
                type="email"
                placeholder="Enter parent/guardian email"
                {...register('parentEmail')}
                data-testid="parent-email"
              />
              {errors.parentEmail && (
                <p className="text-sm text-destructive">{errors.parentEmail.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Required for users under 18. Your parent/guardian will receive account notifications.
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            data-testid="register-button"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Button
            variant="link"
            className="p-0 h-auto font-normal"
            onClick={onSwitchToLogin}
          >
            Sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}