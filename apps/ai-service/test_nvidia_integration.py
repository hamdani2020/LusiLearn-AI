#!/usr/bin/env python3
"""
Test script to verify NVIDIA service integration.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.services.nvidia_service import NVIDIAService
from src.config import settings


async def test_nvidia_service():
    """Test NVIDIA service functionality."""
    print("🧪 Testing NVIDIA Service Integration")
    print("=" * 50)
    
    # Check configuration
    print(f"🔧 Configuration:")
    print(f"   AI Provider: {settings.AI_PROVIDER}")
    print(f"   NVIDIA API Key: {'✅ Set' if settings.NVIDIA_API_KEY and settings.NVIDIA_API_KEY != 'your-nvidia-api-key' else '❌ Not Set'}")
    print(f"   NVIDIA Base URL: {settings.NVIDIA_BASE_URL}")
    print(f"   NVIDIA Model: {settings.NVIDIA_MODEL}")
    print(f"   NVIDIA Max Tokens: {settings.NVIDIA_MAX_TOKENS}")
    print(f"   NVIDIA Temperature: {settings.NVIDIA_TEMPERATURE}")
    print(f"   NVIDIA Top P: {settings.NVIDIA_TOP_P}")
    print()
    
    # Test service initialization
    try:
        print("🚀 Initializing NVIDIA Service...")
        nvidia_service = NVIDIAService()
        await nvidia_service.initialize()
        print("✅ NVIDIA Service initialized successfully")
        print()
        
        # Test API connection
        print("🔌 Testing NVIDIA API Connection...")
        test_response = await nvidia_service._test_api_connection()
        if test_response:
            print("✅ NVIDIA API connection test successful")
        else:
            print("❌ NVIDIA API connection test failed")
        print()
        
        # Test learning path generation
        print("📚 Testing Learning Path Generation...")
        try:
            # Mock request data
            mock_request = type('MockRequest', (), {
                'user_id': 'test-user-123',
                'subject': 'Mathematics',
                'education_level': 'high_school',
                'learning_goals': ['Algebra', 'Geometry'],
                'time_commitment': 45,
                'learning_style': ['visual', 'interactive'],
                'current_level': 'beginner'
            })()
            
            # Add dict method to mock object
            mock_request.dict = lambda: {
                'user_id': mock_request.user_id,
                'subject': mock_request.subject,
                'education_level': mock_request.education_level,
                'learning_goals': mock_request.learning_goals,
                'time_commitment': mock_request.time_commitment,
                'learning_style': mock_request.learning_style,
                'current_level': mock_request.current_level
            }
            
            result = await nvidia_service.generate_learning_path(mock_request)
            print("✅ Learning path generation successful")
            print(f"   Result type: {type(result)}")
            print(f"   Result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
        except Exception as e:
            print(f"❌ Learning path generation failed: {e}")
        print()
        
        # Cleanup
        await nvidia_service.close()
        print("🧹 NVIDIA Service cleaned up")
        
    except Exception as e:
        print(f"❌ NVIDIA Service test failed: {e}")
        return False
    
    print("🎉 NVIDIA Service Integration Test Complete!")
    return True


async def test_ai_service_integration():
    """Test AI service with NVIDIA integration."""
    print("\n🧪 Testing AI Service Integration")
    print("=" * 50)
    
    try:
        from src.services.ai_service import AIService
        
        print("🚀 Initializing AI Service...")
        ai_service = AIService()
        await ai_service.initialize()
        
        print(f"✅ AI Service initialized successfully")
        print(f"   Current Provider: {ai_service.get_current_provider()}")
        print(f"   Provider Status: {ai_service.get_provider_status()}")
        
        # Cleanup
        await ai_service.close()
        print("🧹 AI Service cleaned up")
        
    except Exception as e:
        print(f"❌ AI Service test failed: {e}")
        return False
    
    print("🎉 AI Service Integration Test Complete!")
    return True


async def main():
    """Main test function."""
    print("🚀 Starting NVIDIA Integration Tests")
    print("=" * 60)
    print()
    
    # Test NVIDIA service directly
    nvidia_success = await test_nvidia_service()
    
    # Test AI service integration
    ai_success = await test_ai_service_integration()
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)
    print(f"   NVIDIA Service: {'✅ PASS' if nvidia_success else '❌ FAIL'}")
    print(f"   AI Service Integration: {'✅ PASS' if ai_success else '❌ FAIL'}")
    print(f"   Overall: {'✅ PASS' if nvidia_success and ai_success else '❌ FAIL'}")
    
    if not nvidia_success or not ai_success:
        print("\n💡 To enable NVIDIA GPT-OSS:")
        print("   1. Get API key from https://integrate.api.nvidia.com/v1")
        print("   2. Set NVIDIA_API_KEY in your .env file")
        print("   3. Restart the AI service")
    
    return nvidia_success and ai_success


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1) 