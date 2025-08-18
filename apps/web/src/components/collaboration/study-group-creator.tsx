'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateStudyGroupSchema, ModerationLevel, PrivacyLevel, AgeRange } from '@lusilearn/shared-types';
import { Users, Settings, Shield, Eye, Clock, BookOpen, Plus } from 'lucide-react';
import { z } from 'zod';

interface StudyGroupCreatorProps {
  onCreateGroup: (groupData: z.infer<typeof CreateStudyGroupSchema>) => void;
  isCreating: boolean;
}

export function StudyGroupCreator({ onCreateGroup, isCreating }: StudyGroupCreatorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    topic: '',
    subject: '',
    maxSize: 4,
    ageRestrictions: [] as AgeRange[],
    moderationLevel: ModerationLevel.MODERATE,
    privacy: PrivacyLevel.PUBLIC
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const subjects = [
    'Mathematics', 'Computer Science', 'Physics', 'Chemistry', 'Biology',
    'English', 'History', 'Art', 'Music', 'Languages', 'Business', 'Psychology'
  ];

  const topics = {
    'Mathematics': ['Algebra', 'Calculus', 'Statistics', 'Geometry', 'Number Theory'],
    'Computer Science': ['Programming', 'Data Structures', 'Algorithms', 'Web Development', 'Machine Learning'],
    'Physics': ['Mechanics', 'Thermodynamics', 'Electromagnetism', 'Quantum Physics', 'Relativity'],
    'Chemistry': ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Biochemistry'],
    'Biology': ['Cell Biology', 'Genetics', 'Evolution', 'Ecology', 'Anatomy'],
    'English': ['Literature', 'Writing', 'Grammar', 'Poetry', 'Creative Writing'],
    'History': ['World History', 'American History', 'Ancient History', 'Modern History'],
    'Art': ['Drawing', 'Painting', 'Sculpture', 'Digital Art', 'Art History'],
    'Music': ['Theory', 'Composition', 'Performance', 'Music History', 'Instruments'],
    'Languages': ['Spanish', 'French', 'German', 'Chinese', 'Japanese'],
    'Business': ['Marketing', 'Finance', 'Management', 'Entrepreneurship', 'Economics'],
    'Psychology': ['Cognitive Psychology', 'Social Psychology', 'Developmental Psychology', 'Clinical Psychology']
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAgeRestrictionToggle = (ageRange: AgeRange) => {
    setFormData(prev => ({
      ...prev,
      ageRestrictions: prev.ageRestrictions.includes(ageRange)
        ? prev.ageRestrictions.filter(range => range !== ageRange)
        : [...prev.ageRestrictions, ageRange]
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Group name must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.subject) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.topic) {
      newErrors.topic = 'Topic is required';
    }

    if (formData.maxSize < 2 || formData.maxSize > 8) {
      newErrors.maxSize = 'Group size must be between 2 and 8 members';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      try {
        const validatedData = CreateStudyGroupSchema.parse(formData);
        onCreateGroup(validatedData);
      } catch (error) {
        console.error('Validation error:', error);
      }
    }
  };

  const currentTopics = formData.subject ? topics[formData.subject as keyof typeof topics] || [] : [];

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create Study Group
        </CardTitle>
        <CardDescription>
          Set up a collaborative learning space for you and your peers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Group Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Calculus Study Squad"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <textarea
                  id="description"
                  placeholder="Describe what your group will focus on and what members can expect..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className={`w-full min-h-20 px-3 py-2 border rounded-md resize-none ${errors.description ? 'border-red-500' : 'border-input'}`}
                />
                {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Select
                    value={formData.subject}
                    onValueChange={(value) => {
                      handleInputChange('subject', value);
                      handleInputChange('topic', ''); // Reset topic when subject changes
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(subject => (
                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.subject && <p className="text-sm text-red-500 mt-1">{errors.subject}</p>}
                </div>

                <div>
                  <Label htmlFor="topic">Topic *</Label>
                  <Select
                    value={formData.topic}
                    onValueChange={(value) => handleInputChange('topic', value)}
                    disabled={!formData.subject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentTopics.map(topic => (
                        <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.topic && <p className="text-sm text-red-500 mt-1">{errors.topic}</p>}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-6">
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" />
                  Group Size
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="2"
                    max="8"
                    value={formData.maxSize}
                    onChange={(e) => handleInputChange('maxSize', parseInt(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">
                    Maximum number of members (2-8)
                  </span>
                </div>
                {errors.maxSize && <p className="text-sm text-red-500 mt-1">{errors.maxSize}</p>}
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4" />
                  Privacy Level
                </Label>
                <div className="space-y-2">
                  {(Object.values(PrivacyLevel) as PrivacyLevel[]).map(level => (
                    <label key={level} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="privacy"
                        value={level}
                        checked={formData.privacy === level}
                        onChange={(e) => handleInputChange('privacy', e.target.value as PrivacyLevel)}
                        className="radio"
                      />
                      <span className="capitalize">{level}</span>
                      <span className="text-sm text-muted-foreground">
                        {level === PrivacyLevel.PUBLIC && '- Anyone can find and join'}
                        {level === PrivacyLevel.FRIENDS && '- Only friends can see and join'}
                        {level === PrivacyLevel.PRIVATE && '- Invite-only group'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4" />
                  Moderation Level
                </Label>
                <div className="space-y-2">
                  {(Object.values(ModerationLevel) as ModerationLevel[]).map(level => (
                    <label key={level} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="moderation"
                        value={level}
                        checked={formData.moderationLevel === level}
                        onChange={(e) => handleInputChange('moderationLevel', e.target.value as ModerationLevel)}
                        className="radio"
                      />
                      <span className="capitalize">{level}</span>
                      <span className="text-sm text-muted-foreground">
                        {level === ModerationLevel.MINIMAL && '- Basic content filtering'}
                        {level === ModerationLevel.MODERATE && '- Standard safety measures'}
                        {level === ModerationLevel.STRICT && '- Enhanced monitoring and controls'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4" />
                  Age Restrictions (Optional)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.values(AgeRange) as AgeRange[]).map(range => (
                    <Badge
                      key={range}
                      variant={formData.ageRestrictions.includes(range) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleAgeRestrictionToggle(range)}
                    >
                      {range}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Select age ranges to restrict group membership. Leave empty for no restrictions.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <div className="space-y-4">
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <h3 className="font-medium mb-3">Group Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span>{formData.name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subject:</span>
                      <span>{formData.subject || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Topic:</span>
                      <span>{formData.topic || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Size:</span>
                      <span>{formData.maxSize} members</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Privacy:</span>
                      <span className="capitalize">{formData.privacy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Moderation:</span>
                      <span className="capitalize">{formData.moderationLevel}</span>
                    </div>
                    {formData.ageRestrictions.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Age Restrictions:</span>
                        <span>{formData.ageRestrictions.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Your group will be created and you'll become the admin</li>
                  <li>• Other learners can discover and join your group</li>
                  <li>• You can start scheduling study sessions and activities</li>
                  <li>• Group members can collaborate in real-time</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-6">
          <Button variant="outline">Cancel</Button>
          <Button 
            onClick={handleSubmit}
            disabled={isCreating}
            className="min-w-32"
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}