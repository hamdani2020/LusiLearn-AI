/**
 * Basic test to verify Jest setup
 */

describe('Basic Test Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const asyncOperation = () => Promise.resolve('success');
    
    const result = await asyncOperation();
    
    expect(result).toBe('success');
  });

  it('should have Jest globals available', () => {
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });
});