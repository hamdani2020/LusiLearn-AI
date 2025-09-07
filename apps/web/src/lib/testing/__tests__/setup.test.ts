/**
 * Basic test to verify testing infrastructure setup
 */

import { createMockUser } from '../test-utils';
import type { UserProfile } from '@lusilearn/shared-types';
import { EducationLevel } from '@lusilearn/shared-types';

describe('Testing Infrastructure Setup', () => {
    it('should create mock data', () => {
        const mockUser = createMockUser();

        expect(mockUser).toHaveProperty('id');
        expect(mockUser).toHaveProperty('email');
        expect(mockUser).toHaveProperty('username');
        expect(mockUser).toHaveProperty('demographics');
        expect(mockUser.demographics.educationLevel).toBe(EducationLevel.COLLEGE);
    });

    it('should handle async operations', async () => {
        const asyncOperation = () => Promise.resolve('success');

        const result = await asyncOperation();

        expect(result).toBe('success');
    });

    it('should have testing utilities available', () => {
        expect(typeof createMockUser).toBe('function');
    });
});