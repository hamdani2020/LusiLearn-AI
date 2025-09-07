/**
 * Comprehensive unit tests for validation system
 * Tests runtime validation, type safety, and error handling
 */

import { z } from 'zod';
import {
  validateApiResponse,
  validateRequestPayload,
  createValidationMiddleware,
  ValidationResult,
  ApiValidationError
} from '../runtime-validator';
import {
  LearningPathSchema,
  UserProfileSchema,
  StudyGroupSchema,
  ApiResponseSchema,
  CreateLearningPathRequestSchema,
  UpdateLearningPathRequestSchema
} from '../schemas';
import {
  createMockLearningPath,
  createMockUser,
  createMockStudyGroup,
  createMockApiResponse,
  createMockApiError
} from '@/lib/testing';

describe('Validation System', () => {
  describe('Schema Validation', () => {
    describe('LearningPathSchema', () => {
      it('should validate correct learning path data', () => {
        const validLearningPath = createMockLearningPath();
        
        const result = LearningPathSchema.safeParse(validLearningPath);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validLearningPath);
        }
      });

      it('should reject invalid learning path data', () => {
        const invalidLearningPath = {
          id: 'invalid-uuid', // Invalid UUID format
          subject: '', // Empty subject
          currentLevel: 'invalid-level', // Invalid level
          objectives: 'not-an-array', // Should be array
          milestones: null, // Should be array
          createdAt: 'invalid-date', // Invalid date format
          updatedAt: new Date() // Should be string
        };

        const result = LearningPathSchema.safeParse(invalidLearningPath);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors.length).toBeGreaterThan(0);
          expect(result.error.errors.some(e => e.path.includes('id'))).toBe(true);
          expect(result.error.errors.some(e => e.path.includes('subject'))).toBe(true);
        }
      });

      it('should validate optional fields correctly', () => {
        const minimalLearningPath = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          userId: '123e4567-e89b-12d3-a456-426614174001',
          subject: 'Mathematics',
          currentLevel: 'beginner',
          objectives: ['Learn algebra'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        };

        const result = LearningPathSchema.safeParse(minimalLearningPath);
        
        expect(result.success).toBe(true);
      });
    });

    describe('UserProfileSchema', () => {
      it('should validate correct user profile data', () => {
        const validUser = createMockUser();
        
        const result = UserProfileSchema.safeParse(validUser);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validUser);
        }
      });

      it('should reject invalid email formats', () => {
        const invalidUser = createMockUser({
          email: 'invalid-email-format'
        });

        const result = UserProfileSchema.safeParse(invalidUser);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors.some(e => 
            e.path.includes('email') && e.code === 'invalid_string'
          )).toBe(true);
        }
      });

      it('should validate enum values correctly', () => {
        const invalidUser = createMockUser({
          role: 'invalid-role' as any,
          educationLevel: 'invalid-level' as any
        });

        const result = UserProfileSchema.safeParse(invalidUser);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors.some(e => e.path.includes('role'))).toBe(true);
          expect(result.error.errors.some(e => e.path.includes('educationLevel'))).toBe(true);
        }
      });
    });

    describe('StudyGroupSchema', () => {
      it('should validate correct study group data', () => {
        const validStudyGroup = createMockStudyGroup();
        
        const result = StudyGroupSchema.safeParse(validStudyGroup);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validStudyGroup);
        }
      });

      it('should validate member count constraints', () => {
        const invalidStudyGroup = createMockStudyGroup({
          currentMembers: 15,
          maxMembers: 10 // Current members exceed max
        });

        const result = StudyGroupSchema.safeParse(invalidStudyGroup);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors.some(e => 
            e.message.includes('Current members cannot exceed max members')
          )).toBe(true);
        }
      });
    });

    describe('Request Schemas', () => {
      it('should validate create learning path request', () => {
        const validRequest = {
          subject: 'Mathematics',
          goals: ['Master calculus', 'Understand linear algebra'],
          educationLevel: 'college',
          estimatedDuration: 180
        };

        const result = CreateLearningPathRequestSchema.safeParse(validRequest);
        
        expect(result.success).toBe(true);
      });

      it('should validate update learning path request', () => {
        const validRequest = {
          subject: 'Advanced Mathematics',
          objectives: ['Master advanced calculus']
        };

        const result = UpdateLearningPathRequestSchema.safeParse(validRequest);
        
        expect(result.success).toBe(true);
      });

      it('should reject empty required fields', () => {
        const invalidRequest = {
          subject: '', // Empty subject
          goals: [] // Empty goals array
        };

        const result = CreateLearningPathRequestSchema.safeParse(invalidRequest);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors.some(e => e.path.includes('subject'))).toBe(true);
          expect(result.error.errors.some(e => e.path.includes('goals'))).toBe(true);
        }
      });
    });
  });

  describe('Runtime Validation', () => {
    describe('validateApiResponse', () => {
      it('should validate successful API responses', () => {
        const mockData = createMockLearningPath();
        const apiResponse = createMockApiResponse(mockData);

        const result = validateApiResponse(
          apiResponse,
          ApiResponseSchema(LearningPathSchema)
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(apiResponse);
        expect(result.errors).toBeUndefined();
      });

      it('should validate error API responses', () => {
        const apiResponse = createMockApiError('Validation failed');

        const result = validateApiResponse(
          apiResponse,
          ApiResponseSchema(LearningPathSchema)
        );

        expect(result.success).toBe(true); // Schema validation passes
        expect(result.data?.success).toBe(false); // But API response indicates failure
      });

      it('should handle malformed API responses', () => {
        const malformedResponse = {
          success: 'not-a-boolean', // Should be boolean
          data: 'invalid-data-structure',
          metadata: 'not-an-object' // Should be object
        };

        const result = validateApiResponse(
          malformedResponse,
          ApiResponseSchema(LearningPathSchema)
        );

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      });

      it('should provide detailed error messages', () => {
        const invalidResponse = {
          success: true,
          data: {
            id: 'invalid-uuid',
            subject: '',
            currentLevel: 'invalid-level'
          }
        };

        const result = validateApiResponse(
          invalidResponse,
          ApiResponseSchema(LearningPathSchema)
        );

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        
        const errorMessages = result.errors!;
        expect(errorMessages.some(msg => msg.includes('id'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('subject'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('currentLevel'))).toBe(true);
      });
    });

    describe('validateRequestPayload', () => {
      it('should validate correct request payloads', () => {
        const validPayload = {
          subject: 'Physics',
          goals: ['Understand mechanics', 'Learn thermodynamics'],
          educationLevel: 'college'
        };

        const result = validateRequestPayload(
          validPayload,
          CreateLearningPathRequestSchema
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(validPayload);
      });

      it('should reject invalid request payloads', () => {
        const invalidPayload = {
          subject: '', // Empty subject
          goals: 'not-an-array', // Should be array
          educationLevel: 'invalid-level' // Invalid enum value
        };

        const result = validateRequestPayload(
          invalidPayload,
          CreateLearningPathRequestSchema
        );

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      });

      it('should handle null and undefined payloads', () => {
        const nullResult = validateRequestPayload(
          null,
          CreateLearningPathRequestSchema
        );
        
        const undefinedResult = validateRequestPayload(
          undefined,
          CreateLearningPathRequestSchema
        );

        expect(nullResult.success).toBe(false);
        expect(undefinedResult.success).toBe(false);
      });
    });
  });

  describe('Validation Middleware', () => {
    it('should create validation middleware for API calls', () => {
      const middleware = createValidationMiddleware({
        requestSchema: CreateLearningPathRequestSchema,
        responseSchema: ApiResponseSchema(LearningPathSchema)
      });

      expect(typeof middleware.validateRequest).toBe('function');
      expect(typeof middleware.validateResponse).toBe('function');
    });

    it('should validate requests in middleware', async () => {
      const middleware = createValidationMiddleware({
        requestSchema: CreateLearningPathRequestSchema,
        responseSchema: ApiResponseSchema(LearningPathSchema)
      });

      const validRequest = {
        subject: 'Chemistry',
        goals: ['Learn organic chemistry'],
        educationLevel: 'college'
      };

      const result = await middleware.validateRequest(validRequest);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validRequest);
    });

    it('should validate responses in middleware', async () => {
      const middleware = createValidationMiddleware({
        requestSchema: CreateLearningPathRequestSchema,
        responseSchema: ApiResponseSchema(LearningPathSchema)
      });

      const validResponse = createMockApiResponse(createMockLearningPath());

      const result = await middleware.validateResponse(validResponse);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validResponse);
    });

    it('should handle validation errors in middleware', async () => {
      const middleware = createValidationMiddleware({
        requestSchema: CreateLearningPathRequestSchema,
        responseSchema: ApiResponseSchema(LearningPathSchema),
        onValidationError: (error) => {
          expect(error).toBeInstanceOf(ApiValidationError);
          expect(error.type).toBe('request');
        }
      });

      const invalidRequest = {
        subject: '', // Invalid empty subject
        goals: []    // Invalid empty goals
      };

      const result = await middleware.validateRequest(invalidRequest);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Custom Validation Rules', () => {
    it('should support custom validation functions', () => {
      const CustomSchema = z.object({
        email: z.string().email(),
        age: z.number().min(13).max(120),
        username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/)
      }).refine(
        (data) => data.age >= 18 || data.email.includes('parent'),
        {
          message: "Users under 18 must have parental consent (parent email)",
          path: ["age"]
        }
      );

      // Valid adult user
      const validAdult = {
        email: 'adult@example.com',
        age: 25,
        username: 'adult_user'
      };

      expect(CustomSchema.safeParse(validAdult).success).toBe(true);

      // Valid minor with parent email
      const validMinor = {
        email: 'parent@example.com',
        age: 16,
        username: 'minor_user'
      };

      expect(CustomSchema.safeParse(validMinor).success).toBe(true);

      // Invalid minor without parent email
      const invalidMinor = {
        email: 'minor@example.com',
        age: 16,
        username: 'minor_user'
      };

      const result = CustomSchema.safeParse(invalidMinor);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => 
          e.message.includes('parental consent')
        )).toBe(true);
      }
    });

    it('should support async validation', async () => {
      const AsyncSchema = z.object({
        username: z.string().min(3)
      }).refine(async (data) => {
        // Simulate async username availability check
        await new Promise(resolve => setTimeout(resolve, 10));
        return data.username !== 'taken_username';
      }, {
        message: "Username is already taken"
      });

      // Valid username
      const validData = { username: 'available_username' };
      const validResult = await AsyncSchema.safeParseAsync(validData);
      expect(validResult.success).toBe(true);

      // Taken username
      const takenData = { username: 'taken_username' };
      const takenResult = await AsyncSchema.safeParseAsync(takenData);
      expect(takenResult.success).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should validate large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) =>
        createMockLearningPath({ id: `path-${i}`, subject: `Subject ${i}` })
      );

      const startTime = Date.now();
      
      const results = largeDataset.map(item => 
        LearningPathSchema.safeParse(item)
      );
      
      const endTime = Date.now();
      const validationTime = endTime - startTime;

      // Should validate 1000 items in reasonable time
      expect(validationTime).toBeLessThan(1000); // Less than 1 second
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle complex nested validation efficiently', () => {
      const complexData = {
        user: createMockUser(),
        learningPaths: Array.from({ length: 50 }, (_, i) => 
          createMockLearningPath({ id: `path-${i}` })
        ),
        studyGroups: Array.from({ length: 20 }, (_, i) => 
          createMockStudyGroup({ id: `group-${i}` })
        )
      };

      const ComplexSchema = z.object({
        user: UserProfileSchema,
        learningPaths: z.array(LearningPathSchema),
        studyGroups: z.array(StudyGroupSchema)
      });

      const startTime = Date.now();
      const result = ComplexSchema.safeParse(complexData);
      const endTime = Date.now();
      const validationTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(validationTime).toBeLessThan(500); // Less than 0.5 seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle circular references gracefully', () => {
      const circularData: any = {
        id: 'test',
        name: 'Circular Test'
      };
      circularData.self = circularData;

      const SimpleSchema = z.object({
        id: z.string(),
        name: z.string()
      });

      // Should not throw error, but validation should fail
      expect(() => {
        const result = SimpleSchema.safeParse(circularData);
        expect(result.success).toBe(false);
      }).not.toThrow();
    });

    it('should provide helpful error messages for nested validation failures', () => {
      const invalidNestedData = {
        user: {
          id: 'invalid-uuid',
          email: 'invalid-email',
          name: '',
          role: 'invalid-role'
        },
        settings: {
          theme: 'invalid-theme',
          notifications: 'not-a-boolean'
        }
      };

      const NestedSchema = z.object({
        user: UserProfileSchema,
        settings: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean()
        })
      });

      const result = NestedSchema.safeParse(invalidNestedData);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPaths = result.error.errors.map(e => e.path.join('.'));
        expect(errorPaths.some(path => path.includes('user.id'))).toBe(true);
        expect(errorPaths.some(path => path.includes('user.email'))).toBe(true);
        expect(errorPaths.some(path => path.includes('settings.theme'))).toBe(true);
      }
    });

    it('should handle validation of unknown data types', () => {
      const unknownData = new Map([['key', 'value']]);

      const result = LearningPathSchema.safeParse(unknownData);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });
});