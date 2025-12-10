"""
Execution Models and Data Classes

Defines data structures for code execution context, limits, and results.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from uuid import UUID
import pandas as pd


@dataclass
class ExecutionContext:
    """Context provided to executing code"""
    
    # Database connection info
    connector_type: str
    connector_config: Dict[str, Any]
    connector_credentials: Dict[str, str]
    
    # Cross-reference mappings (mapping_name -> DataFrame)
    mappings: Dict[str, pd.DataFrame] = field(default_factory=dict)
    
    # Runtime parameters
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    report_version_id: UUID = None
    job_run_id: UUID = None
    tenant_id: UUID = None
    
    # Query SQL (optional - can be pre-fetched)
    query_sql: Optional[str] = None


@dataclass
class ResourceLimits:
    """Resource limits for code execution"""
    
    max_memory_mb: int = 512
    max_execution_seconds: int = 300
    max_output_size_mb: int = 100
    max_code_lines: int = 5000
    

@dataclass
class ValidationResult:
    """Result of code validation"""
    
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    blocked_imports: List[str] = field(default_factory=list)
    

@dataclass
class ExecutionResult:
    """Result of code execution"""
    
    success: bool
    output_data: Optional[Any] = None  # Can be DataFrame, dict, list, etc.
    execution_time_seconds: float = 0.0
    memory_used_mb: float = 0.0
    
    # Error information
    error: Optional[str] = None
    error_type: Optional[str] = None
    stack_trace: Optional[str] = None
    
    # Execution logs
    logs: List[str] = field(default_factory=list)
    
    # Metadata
    code_lines: int = 0
    output_size_bytes: int = 0
