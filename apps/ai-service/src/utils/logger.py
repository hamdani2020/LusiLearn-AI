import logging
import json
import sys
import os
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

# Create logs directory if it doesn't exist
logs_dir = Path("logs")
logs_dir.mkdir(exist_ok=True)

class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""
    
    def __init__(self, service_name: str = "lusilearn-ai"):
        self.service_name = service_name
        self.environment = os.getenv("ENVIRONMENT", "development")
        super().__init__()
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "service": self.service_name,
            "environment": self.environment,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, 'user_id'):
            log_entry['userId'] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry['requestId'] = record.request_id
        if hasattr(record, 'duration'):
            log_entry['duration'] = record.duration
        if hasattr(record, 'model'):
            log_entry['model'] = record.model
        if hasattr(record, 'tokens'):
            log_entry['tokens'] = record.tokens
        if hasattr(record, 'cost'):
            log_entry['cost'] = record.cost
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add any additional fields from extra parameter
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)
        
        return json.dumps(log_entry)

class AIServiceLogger:
    """Centralized logging service for AI operations"""
    
    def __init__(self):
        self.logger = logging.getLogger("ai_service")
        self.performance_logger = logging.getLogger("ai_performance")
        self.cost_logger = logging.getLogger("ai_cost")
        self.security_logger = logging.getLogger("ai_security")
        
        self._setup_loggers()
    
    def _setup_loggers(self):
        """Setup all loggers with appropriate handlers and formatters"""
        log_level = os.getenv("LOG_LEVEL", "INFO").upper()
        
        # Main application logger
        self._setup_logger(
            self.logger,
            log_level,
            "logs/ai-service.log",
            "logs/ai-error.log"
        )
        
        # Performance logger
        self._setup_logger(
            self.performance_logger,
            "INFO",
            "logs/ai-performance.log"
        )
        
        # Cost tracking logger
        self._setup_logger(
            self.cost_logger,
            "INFO",
            "logs/ai-cost.log"
        )
        
        # Security logger
        self._setup_logger(
            self.security_logger,
            "INFO",
            "logs/ai-security.log"
        )
    
    def _setup_logger(self, logger: logging.Logger, level: str, 
                     info_file: str, error_file: Optional[str] = None):
        """Setup individual logger with handlers"""
        logger.setLevel(getattr(logging, level))
        
        # Remove existing handlers
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
        
        formatter = StructuredFormatter()
        
        # File handler for all logs
        file_handler = logging.FileHandler(info_file)
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        # Separate error file handler if specified
        if error_file:
            error_handler = logging.FileHandler(error_file)
            error_handler.setLevel(logging.ERROR)
            error_handler.setFormatter(formatter)
            logger.addHandler(error_handler)
        
        # Console handler for development
        if os.getenv("ENVIRONMENT") != "production":
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(logging.DEBUG)
            
            # Simple formatter for console
            console_formatter = logging.Formatter(
                '%(asctime)s [%(name)s] %(levelname)s: %(message)s'
            )
            console_handler.setFormatter(console_formatter)
            logger.addHandler(console_handler)
        
        # Prevent propagation to root logger
        logger.propagate = False
    
    def info(self, message: str, **kwargs):
        """Log info message with optional context"""
        self.logger.info(message, extra={'extra_fields': kwargs})
    
    def error(self, message: str, **kwargs):
        """Log error message with optional context"""
        self.logger.error(message, extra={'extra_fields': kwargs})
    
    def warning(self, message: str, **kwargs):
        """Log warning message with optional context"""
        self.logger.warning(message, extra={'extra_fields': kwargs})
    
    def debug(self, message: str, **kwargs):
        """Log debug message with optional context"""
        self.logger.debug(message, extra={'extra_fields': kwargs})
    
    def log_performance(self, operation: str, duration: float, 
                       user_id: Optional[str] = None, **kwargs):
        """Log performance metrics"""
        self.performance_logger.info(
            f"AI Operation: {operation}",
            extra={
                'extra_fields': {
                    'operation': operation,
                    'duration': duration,
                    'user_id': user_id,
                    **kwargs
                }
            }
        )
    
    def log_ai_usage(self, model: str, operation: str, tokens: int, 
                    cost: float, user_id: Optional[str] = None, **kwargs):
        """Log AI API usage and costs"""
        self.cost_logger.info(
            f"AI Usage: {operation} with {model}",
            extra={
                'extra_fields': {
                    'model': model,
                    'operation': operation,
                    'tokens': tokens,
                    'cost': cost,
                    'user_id': user_id,
                    **kwargs
                }
            }
        )
    
    def log_security_event(self, event: str, user_id: Optional[str] = None, 
                          ip: Optional[str] = None, **kwargs):
        """Log security-related events"""
        self.security_logger.info(
            f"Security Event: {event}",
            extra={
                'extra_fields': {
                    'event': event,
                    'user_id': user_id,
                    'ip': ip,
                    **kwargs
                }
            }
        )
    
    def log_model_inference(self, model: str, input_tokens: int, 
                           output_tokens: int, latency: float,
                           user_id: Optional[str] = None, **kwargs):
        """Log model inference metrics"""
        total_tokens = input_tokens + output_tokens
        
        self.performance_logger.info(
            f"Model Inference: {model}",
            extra={
                'extra_fields': {
                    'model': model,
                    'input_tokens': input_tokens,
                    'output_tokens': output_tokens,
                    'total_tokens': total_tokens,
                    'latency': latency,
                    'tokens_per_second': total_tokens / latency if latency > 0 else 0,
                    'user_id': user_id,
                    **kwargs
                }
            }
        )
    
    def log_recommendation_request(self, user_id: str, content_type: str,
                                 num_recommendations: int, duration: float, **kwargs):
        """Log content recommendation requests"""
        self.performance_logger.info(
            f"Content Recommendation Request",
            extra={
                'extra_fields': {
                    'user_id': user_id,
                    'content_type': content_type,
                    'num_recommendations': num_recommendations,
                    'duration': duration,
                    **kwargs
                }
            }
        )
    
    def log_learning_path_generation(self, user_id: str, subject: str,
                                   num_objectives: int, duration: float, **kwargs):
        """Log learning path generation"""
        self.performance_logger.info(
            f"Learning Path Generation",
            extra={
                'extra_fields': {
                    'user_id': user_id,
                    'subject': subject,
                    'num_objectives': num_objectives,
                    'duration': duration,
                    **kwargs
                }
            }
        )

# Global logger instance
ai_logger = AIServiceLogger()

# Convenience functions for backward compatibility
def log_info(message: str, **kwargs):
    ai_logger.info(message, **kwargs)

def log_error(message: str, **kwargs):
    ai_logger.error(message, **kwargs)

def log_warning(message: str, **kwargs):
    ai_logger.warning(message, **kwargs)

def log_debug(message: str, **kwargs):
    ai_logger.debug(message, **kwargs)

def log_performance(operation: str, duration: float, **kwargs):
    ai_logger.log_performance(operation, duration, **kwargs)

def log_ai_usage(model: str, operation: str, tokens: int, cost: float, **kwargs):
    ai_logger.log_ai_usage(model, operation, tokens, cost, **kwargs)

def log_security_event(event: str, **kwargs):
    ai_logger.log_security_event(event, **kwargs)