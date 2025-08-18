'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserProfile, AgeRange, EducationLevel } from '@lusilearn/shared-types';
import { Search, Filter, Users, BookOpen, Clock, MapPin, Star } from 'lucide-react';

interface PeerDiscoveryProps {
  onSearch: (query: string, filters: DiscoveryFilters) => void;
  peers: DiscoveredPeer[];
  isLoading: boolean;
}

interface DiscoveryFilters {
  subjects?: string[];
  educationLevel?: EducationLevel[];
  ageRange?: AgeRange[];
  skillLevel?: string[];
  availability?: string;
}

interface DiscoveredPeer {
  id: string;
  username: string;
  profile: Partial<UserProfile>;
  onlineStatus: 'online' | 'offline' | 'away';
  lastActive: Date;
  compatibilityScore: number;
  sharedSubjects: string[];
  skillLevel: string;
}

export function PeerDiscovery({ onSearch, peers, isLoading }: PeerDiscoveryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = () => {
    onSearch(searchQuery, filters);
  };

  const handleFilterChange = (key: keyof DiscoveryFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const subjects = ['Mathematics', 'Computer Science', 'Physics', 'Chemistry', 'Biology', 'English', 'History'];
  const skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Discover Learning Peers
          </CardTitle>
          <CardDescription>
            Find and connect with learners in your areas of interest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search by username, subject, or skill..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {showFilters && (
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Subjects</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {subjects.map(subject => (
                          <Badge
                            key={subject}
                            variant={filters.subjects?.includes(subject) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              const current = filters.subjects || [];
                              const updated = current.includes(subject)
                                ? current.filter(s => s !== subject)
                                : [...current, subject];
                              handleFilterChange('subjects', updated);
                            }}
                          >
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Skill Level</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {skillLevels.map(level => (
                          <Badge
                            key={level}
                            variant={filters.skillLevel?.includes(level) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              const current = filters.skillLevel || [];
                              const updated = current.includes(level)
                                ? current.filter(l => l !== level)
                                : [...current, level];
                              handleFilterChange('skillLevel', updated);
                            }}
                          >
                            {level}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Education Level</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(Object.values(EducationLevel) as EducationLevel[]).map(level => (
                            <Badge
                              key={level}
                              variant={filters.educationLevel?.includes(level) ? "default" : "outline"}
                              className="cursor-pointer text-xs"
                              onClick={() => {
                                const current = filters.educationLevel || [];
                                const updated = current.includes(level)
                                  ? current.filter(l => l !== level)
                                  : [...current, level];
                                handleFilterChange('educationLevel', updated);
                              }}
                            >
                              {level.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Age Range</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(Object.values(AgeRange) as AgeRange[]).map(range => (
                            <Badge
                              key={range}
                              variant={filters.ageRange?.includes(range) ? "default" : "outline"}
                              className="cursor-pointer text-xs"
                              onClick={() => {
                                const current = filters.ageRange || [];
                                const updated = current.includes(range)
                                  ? current.filter(r => r !== range)
                                  : [...current, range];
                                handleFilterChange('ageRange', updated);
                              }}
                            >
                              {range}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="grid" className="w-full">
        <TabsList>
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="grid">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {peers.map(peer => (
              <PeerCard key={peer.id} peer={peer} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="list">
          <div className="space-y-3">
            {peers.map(peer => (
              <PeerListItem key={peer.id} peer={peer} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {peers.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No peers found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria or filters to find more learning partners.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PeerCardProps {
  peer: DiscoveredPeer;
}

function PeerCard({ peer }: PeerCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                  {peer.username.charAt(0).toUpperCase()}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(peer.onlineStatus)}`} />
              </div>
              <div>
                <h4 className="font-medium">{peer.username}</h4>
                <p className="text-xs text-muted-foreground capitalize">{peer.onlineStatus}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500" />
              <span className="text-xs">{peer.compatibilityScore}%</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Subjects</p>
            <div className="flex flex-wrap gap-1">
              {peer.sharedSubjects.slice(0, 3).map(subject => (
                <Badge key={subject} variant="secondary" className="text-xs">
                  {subject}
                </Badge>
              ))}
              {peer.sharedSubjects.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{peer.sharedSubjects.length - 3}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {peer.skillLevel}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatLastActive(peer.lastActive)}
            </span>
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1">Connect</Button>
            <Button size="sm" variant="outline">Profile</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PeerListItem({ peer }: PeerCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                {peer.username.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(peer.onlineStatus)}`} />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{peer.username}</h4>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">{peer.compatibilityScore}% match</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {peer.skillLevel}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatLastActive(peer.lastActive)}
                </span>
                <span className="capitalize">{peer.onlineStatus}</span>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {peer.sharedSubjects.map(subject => (
                  <Badge key={subject} variant="secondary" className="text-xs">
                    {subject}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button size="sm">Connect</Button>
            <Button size="sm" variant="outline">Profile</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatLastActive(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}