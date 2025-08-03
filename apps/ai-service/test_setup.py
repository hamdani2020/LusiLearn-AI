#!/usr/bin/env python3
"""
Test script to verify AI service setup.
"""
import os
import sys

def test_structure():
    """Test that all required files and directories exist."""
    print("Testing AI service structure...")
    
    base_dir = os.path.dirname(__file__)
    required_files = [
        'src/__init__.py',
        'src/main.py',
        'src/config.py',
        'src/services/__init__.py',
        'src/services/ai_service.py',
        'src/services/openai_service.py',
        'src/services/gemini_service.py',
        'src/services/vector_service.py',
        'src/services/health_service.py',
        'src/models/__init__.py',
        'src/models/ai_models.py',
        'src/utils/__init__.py',
        'src/utils/exceptions.py',
        'src/middleware/__init__.py',
        'src/middleware/error_handler.py',
        'src/middleware/logging_middleware.py',
        'src/routes/__init__.py',
        'src/routes/health.py',
        'src/routes/recommendations.py',
        'src/routes/learning_paths.py',
        'src/routes/peer_matching.py',
        'requirements.txt',
        'Dockerfile'
    ]
    
    missing_files = []
    for file_path in required_files:
        full_path = os.path.join(base_dir, file_path)
        if os.path.exists(full_path):
            print(f"✓ {file_path}")
        else:
            print(f"✗ {file_path}")
            missing_files.append(file_path)
    
    if missing_files:
        print(f"\n❌ Missing {len(missing_files)} required files")
        return False
    else:
        print(f"\n✅ All {len(required_files)} required files present")
        return True

def test_imports():
    """Test basic imports without external dependencies."""
    print("\nTesting basic imports...")
    
    # Add src to path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
    
    try:
        # Test basic structure imports
        from src.utils import exceptions
        print("✓ Exceptions module imported")
        
        # Test that classes are defined
        assert hasattr(exceptions, 'AIServiceError')
        assert hasattr(exceptions, 'OpenAIError')
        assert hasattr(exceptions, 'VectorServiceError')
        print("✓ Exception classes defined")
        
        # Test AI service imports
        try:
            from src.services.ai_service import AIService, AIProvider
            print("✓ Unified AI service imported")
        except ImportError as e:
            print(f"⚠ AI service import failed (dependencies missing): {e}")
        
        try:
            from src.services.openai_service import OpenAIService
            print("✓ OpenAI service imported")
        except ImportError as e:
            print(f"⚠ OpenAI service import failed (dependencies missing): {e}")
        
        try:
            from src.services.gemini_service import GeminiService
            print("✓ Gemini service imported")
        except ImportError as e:
            print(f"⚠ Gemini service import failed (dependencies missing): {e}")
        
        return True
    except Exception as e:
        print(f"✗ Import test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("AI Service Setup Verification")
    print("=" * 40)
    
    structure_ok = test_structure()
    imports_ok = test_imports()
    
    print("\n" + "=" * 40)
    if structure_ok and imports_ok:
        print("✅ AI service setup verification PASSED")
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Configure environment variables in .env file")
        print("3. Run service: python -m uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload")
        return 0
    else:
        print("❌ AI service setup verification FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())