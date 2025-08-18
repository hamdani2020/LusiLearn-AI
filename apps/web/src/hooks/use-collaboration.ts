import { useState, useCallback } from 'react';
import { collaborationApi, PeerMatch, MatchingCriteria, StudyGroup, CreateStudyGroupRequest, UpdateStudyGroupRequest } from '@/lib/api-extended';

export function useCollaboration() {
  const [peerMatches, setPeerMatches] = useState<PeerMatch[]>([]);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [currentGroup, setCurrentGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find peer matches
  const findPeerMatches = useCallback(async (criteria: MatchingCriteria) => {
    setLoading(true);
    setError(null);
    try {
      const response = await collaborationApi.findPeerMatches(criteria);
      if (response.success && response.data) {
        setPeerMatches(response.data.matches);
        return response.data.matches;
      } else {
        setError(response.message || 'Failed to find peer matches');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create study group
  const createStudyGroup = useCallback(async (data: CreateStudyGroupRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await collaborationApi.createStudyGroup(data);
      if (response.success && response.data) {
        setStudyGroups(prev => [...prev, response.data!]);
        return response.data;
      } else {
        setError(response.message || 'Failed to create study group');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get all study groups
  const fetchStudyGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await collaborationApi.getStudyGroups();
      if (response.success && response.data) {
        setStudyGroups(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch study groups');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get specific study group
  const fetchStudyGroup = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await collaborationApi.getStudyGroup(groupId);
      if (response.success && response.data) {
        setCurrentGroup(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch study group');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update study group
  const updateStudyGroup = useCallback(async (groupId: string, data: UpdateStudyGroupRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await collaborationApi.updateStudyGroup(groupId, data);
      if (response.success && response.data) {
        setStudyGroups(prev => 
          prev.map(group => group.id === groupId ? response.data! : group)
        );
        if (currentGroup?.id === groupId) {
          setCurrentGroup(response.data);
        }
        return response.data;
      } else {
        setError(response.message || 'Failed to update study group');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentGroup]);

  // Delete study group
  const deleteStudyGroup = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await collaborationApi.deleteStudyGroup(groupId);
      if (response.success) {
        setStudyGroups(prev => prev.filter(group => group.id !== groupId));
        if (currentGroup?.id === groupId) {
          setCurrentGroup(null);
        }
        return true;
      } else {
        setError(response.message || 'Failed to delete study group');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentGroup]);

  // Join study group
  const joinStudyGroup = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await collaborationApi.joinStudyGroup(groupId);
      if (response.success) {
        // Refresh the study group data
        await fetchStudyGroup(groupId);
        return true;
      } else {
        setError(response.message || 'Failed to join study group');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchStudyGroup]);

  // Leave study group
  const leaveStudyGroup = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await collaborationApi.leaveStudyGroup(groupId);
      if (response.success) {
        // Refresh the study group data
        await fetchStudyGroup(groupId);
        return true;
      } else {
        setError(response.message || 'Failed to leave study group');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchStudyGroup]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clear peer matches
  const clearPeerMatches = useCallback(() => {
    setPeerMatches([]);
  }, []);

  // Clear current group
  const clearCurrentGroup = useCallback(() => {
    setCurrentGroup(null);
  }, []);

  return {
    // State
    peerMatches,
    studyGroups,
    currentGroup,
    loading,
    error,
    
    // Actions
    findPeerMatches,
    createStudyGroup,
    fetchStudyGroups,
    fetchStudyGroup,
    updateStudyGroup,
    deleteStudyGroup,
    joinStudyGroup,
    leaveStudyGroup,
    clearError,
    clearPeerMatches,
    clearCurrentGroup,
    
    // Computed
    hasPeerMatches: peerMatches.length > 0,
    hasStudyGroups: studyGroups.length > 0,
    hasCurrentGroup: currentGroup !== null,
    peerMatchCount: peerMatches.length,
    studyGroupCount: studyGroups.length,
    currentGroupId: currentGroup?.id
  };
} 