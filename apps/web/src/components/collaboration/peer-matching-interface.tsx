'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { PeerMatch, MatchingCriteria, AgeRange } from '@lusilearn/shared-types';
import { Users, Star, Clock, MapPin, BookOpen, Target } from 'lucide-react';

interface PeerMatchingInterfaceProps {
  onMatchRequest: (criteria: MatchingCriteria) => void;
  matches: PeerMatch[];
  isLoading: boolean;
}

export function PeerMatchingInterface({ onMatchRequest, matches, isLoading }: PeerMatchingInterfaceProps) {
  const [criteria, setCriteria] = useState<Partial<MatchingCriteria>>({
    subjects: [],
    skillLevels: [],
    learningGoals: [],
    collaborationType: 'study_buddy'
  });

  const handleFindMatches = () => {
    if (criteria.subjects && criteria.skillLevels && criteria.learningGoals) {
      onMatchRequest(criteria as MatchingCriteria);
    }
  };

  const handleSubjectToggle = (subject: string) => {
    setCriteria((prev: Partial<MatchingCriteria>) => ({
      ...prev,
      subjects: prev.subjects?.includes(subject)
        ? prev.subjects.filter((s: string) => s !== subject)
        : [...(prev.subjects || []), subject]
    }));
  };

  const handleSkillLevelToggle = (level: string) => {
    setCriteria((prev: Partial<MatchingCriteria>) => ({
      ...prev,
      skillLevels: prev.skillLevels?.includes(level)
        ? prev.skillLevels.filter((l: string) => l !== level)
        : [...(prev.skillLevels || []), level]
    }));
  };

  const handleGoalToggle = (goal: string) => {
    setCriteria((prev: Partial<MatchingCriteria>) => ({
      ...prev,
      learningGoals: prev.learningGoals?.includes(goal)
        ? prev.learningGoals.filter((g: string) => g !== goal)
        : [...(prev.learningGoals || []), goal]
    }));
  };

  const subjects = ['Mathematics', 'Computer Science', 'Physics', 'Chemistry', 'Biology', 'English', 'History'];
  const skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
  const learningGoals = ['Exam Preparation', 'Skill Building', 'Project Collaboration', 'Career Development', 'Academic Research'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Find Learning Partners
          </CardTitle>
          <CardDescription>
            Discover peers who complement your skills and share your learning goals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="criteria" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="criteria">Matching Criteria</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>
            
            <TabsContent value="criteria" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Collaboration Type</Label>
                  <Select
                    value={criteria.collaborationType}
                    onValueChange={(value) => setCriteria((prev: Partial<MatchingCriteria>) => ({ ...prev, collaborationType: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select collaboration type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="study_buddy">Study Buddy</SelectItem>
                      <SelectItem value="mentor">Mentor/Mentee</SelectItem>
                      <SelectItem value="project_partner">Project Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Subjects of Interest</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {subjects.map(subject => (
                      <Badge
                        key={subject}
                        variant={criteria.subjects?.includes(subject) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleSubjectToggle(subject)}
                      >
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Skill Levels</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {skillLevels.map(level => (
                      <Badge
                        key={level}
                        variant={criteria.skillLevels?.includes(level) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleSkillLevelToggle(level)}
                      >
                        {level}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Learning Goals</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {learningGoals.map(goal => (
                      <Badge
                        key={goal}
                        variant={criteria.learningGoals?.includes(goal) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleGoalToggle(goal)}
                      >
                        {goal}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timezone">Time Zone</Label>
                  <Input
                    id="timezone"
                    placeholder="e.g., UTC-5, EST"
                    value={criteria.timeZone || ''}
                    onChange={(e) => setCriteria((prev: Partial<MatchingCriteria>) => ({ ...prev, timeZone: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="ageRange">Age Range Preference</Label>
                  <Select
                    value={criteria.ageRange}
                    onValueChange={(value) => setCriteria((prev: Partial<MatchingCriteria>) => ({ ...prev, ageRange: value as AgeRange }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any Age" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any Age</SelectItem>
                      <SelectItem value={AgeRange.CHILD}>5-12 years</SelectItem>
                      <SelectItem value={AgeRange.TEEN}>13-17 years</SelectItem>
                      <SelectItem value={AgeRange.YOUNG_ADULT}>18-25 years</SelectItem>
                      <SelectItem value={AgeRange.ADULT}>26-40 years</SelectItem>
                      <SelectItem value={AgeRange.MATURE}>40+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="communicationStyle">Communication Style</Label>
                  <Select
                    value={criteria.communicationStyle}
                    onValueChange={(value) => setCriteria((prev: Partial<MatchingCriteria>) => ({ ...prev, communicationStyle: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any Style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any Style</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end mt-6">
            <Button 
              onClick={handleFindMatches}
              disabled={isLoading || !criteria.subjects?.length || !criteria.skillLevels?.length}
              className="min-w-32"
            >
              {isLoading ? 'Finding Matches...' : 'Find Matches'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Potential Matches</CardTitle>
            <CardDescription>
              Found {matches.length} compatible learning partners
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {matches.map((match, index) => (
                <PeerMatchCard key={match.userId} match={match} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PeerMatchCardProps {
  match: PeerMatch;
}

function PeerMatchCard({ match }: PeerMatchCardProps) {
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">User {match.userId.slice(0, 8)}...</h4>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">
                  {match.compatibilityScore}% match
                </span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">{match.matchReason}</p>
            
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Shared Interests</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {match.sharedInterests.map((interest: string) => (
                    <Badge key={interest} variant="secondary" className="text-xs">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">Complementary Skills</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {match.complementarySkills.map((skill: string) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                <span>{match.estimatedCollaborationSuccess}% success rate</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 ml-4">
            <Button size="sm">Connect</Button>
            <Button size="sm" variant="outline">View Profile</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}