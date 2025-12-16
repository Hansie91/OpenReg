"""
Code Executor Service

Provides secure Python code execution with sandboxing, resource limits,
and library allowlisting for report transformations.
"""

import ast
import logging
import traceback
import time
import sys
import io
import resource
import signal
from typing import Dict, Any, Optional
from contextlib import contextmanager

import pandas as pd
from RestrictedPython import compile_restricted, safe_globals
from RestrictedPython.Guards import guarded_iter_unpack_sequence, guarded_unpack_sequence

from services.execution_models import (
    ExecutionContext,
    ResourceLimits,
    ValidationResult,
    ExecutionResult
)
from services.database import DatabaseService
from config import settings

logger = logging.getLogger(__name__)


# ==================== Configuration ====================

ALLOWED_LIBRARIES = [
    'pandas', 'numpy', 'lxml', 'openpyxl', 'datetime',
    'dateutil', 'decimal', 'json', 'csv', 're', 'math',
    'statistics', 'defusedxml', 'collections', 'xml'
]

BLOCKED_IMPORTS = [
    'os', 'subprocess', 'socket', 'sys', 'importlib',
    '__import__', 'open', 'file', 'execfile', 'reload'
]


# ==================== Timeout Handler ====================

class TimeoutError(Exception):
    """Raised when execution exceeds timeout"""
    pass


def timeout_handler(signum, frame):
    """Signal handler for execution timeout"""
    raise TimeoutError("Code execution exceeded timeout limit")


# ==================== Code Executor ====================

class CodeExecutor:
    """Service for secure Python code execution"""
    
    @staticmethod
    def validate_code(code: str, limits: ResourceLimits) -> ValidationResult:
        """
        Validate Python code without executing it.
        
        Args:
            code: Python code to validate
            limits: Resource limits including max_code_lines
            
        Returns:
            ValidationResult with validation status and any errors
        """
        errors = []
        warnings = []
        blocked_imports = []
        
        # Check code length
        lines = code.split('\n')
        if len(lines) > limits.max_code_lines:
            errors.append(f"Code exceeds maximum {limits.max_code_lines} lines")
        
        # Parse AST to detect dangerous constructs
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            errors.append(f"Syntax error: {str(e)}")
            return ValidationResult(valid=False, errors=errors)
        
        # Check for blocked imports
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in BLOCKED_IMPORTS:
                        blocked_imports.append(alias.name)
                        errors.append(f"Blocked import: {alias.name}")
                    elif alias.name.split('.')[0] not in ALLOWED_LIBRARIES:
                        warnings.append(f"Non-standard library import: {alias.name}")
                        
            elif isinstance(node, ast.ImportFrom):
                if node.module and node.module in BLOCKED_IMPORTS:
                    blocked_imports.append(node.module)
                    errors.append(f"Blocked import: {node.module}")
                elif node.module and node.module.split('.')[0] not in ALLOWED_LIBRARIES:
                    warnings.append(f"Non-standard library import: {node.module}")
            
            # Check for eval/exec
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in ['eval', 'exec', 'compile', '__import__']:
                        errors.append(f"Blocked function call: {node.func.id}")
        
        valid = len(errors) == 0 and len(blocked_imports) == 0
        
        return ValidationResult(
            valid=valid,
            errors=errors,
            warnings=warnings,
            blocked_imports=blocked_imports
        )
    
    @staticmethod
    def create_sandbox(context: ExecutionContext) -> Dict[str, Any]:
        """
        Create a sandboxed execution environment.
        
        Args:
            context: Execution context with database and mapping access
            
        Returns:
            Dictionary of globals for code execution
        """
        # Start with safe globals from RestrictedPython
        sandbox = safe_globals.copy()
        
        # Add safe builtins with RestrictedPython guards
        # Guard functions for attribute and item access
        def _getattr_(obj, name, default=None):
            """Safe getattr for RestrictedPython"""
            return getattr(obj, name, default)
        
        def _getitem_(obj, key):
            """Safe getitem for RestrictedPython"""
            return obj[key]
        
        def _write_(obj):
            """Allow writes to safe objects"""
            return obj
        
        def _iter_unpack_sequence_(*args):
            """Safe iterator unpacking"""
            # Args: (iter_target, spec, _getiter_)
            it = args[0] if args else []
            return list(it) if hasattr(it, '__iter__') else [it]
        
        def _inplacevar_(op, x, y):
            """Safe in-place operations"""
            if op == '+=': return x + y
            if op == '-=': return x - y
            if op == '*=': return x * y
            if op == '/=': return x / y
            if op == '//=': return x // y
            if op == '%=': return x % y
            if op == '**=': return x ** y
            if op == '&=': return x & y
            if op == '|=': return x | y
            if op == '^=': return x ^ y
            if op == '>>=': return x >> y
            if op == '<<=': return x << y
            return x
        
        def _getiter_(obj):
            """Return an iterator for the object - required by RestrictedPython"""
            return iter(obj)
        
        sandbox.update({
            '__builtins__': {
                'True': True,
                'False': False,
                'None': None,
                'str': str,
                'int': int,
                'float': float,
                'bool': bool,
                'list': list,
                'dict': dict,
                'tuple': tuple,
                'set': set,
                'len': len,
                'range': range,
                'enumerate': enumerate,
                'zip': zip,
                'min': min,
                'max': max,
                'sum': sum,
                'abs': abs,
                'round': round,
                'sorted': sorted,
                'reversed': reversed,
                'any': any,
                'all': all,
                'isinstance': isinstance,
                'type': type,
                'print': print,
                'getattr': getattr,
                'hasattr': hasattr,
                'iter': iter,
                'next': next,
                'map': map,
                'filter': filter,
                '_getiter_': _getiter_,
                '_unpack_sequence_': guarded_unpack_sequence,
                '_iter_unpack_sequence_': _iter_unpack_sequence_,
                '_getattr_': _getattr_,
                '_getitem_': _getitem_,
                '_write_': _write_,
                '_inplacevar_': _inplacevar_,
            }
        })
        
        # Add allowed libraries
        import pandas as pd
        import numpy as np
        import json
        import csv
        import re
        import math
        import statistics
        from datetime import datetime, timedelta, date
        from decimal import Decimal
        import xml.etree.ElementTree as ET
        from xml.dom import minidom
        from collections import OrderedDict, defaultdict
        
        sandbox.update({
            'pd': pd,
            'pandas': pd,
            'np': np,
            'numpy': np,
            'json': json,
            'csv': csv,
            're': re,
            'math': math,
            'statistics': statistics,
            'datetime': datetime,
            'timedelta': timedelta,
            'date': date,
            'Decimal': Decimal,
            'ET': ET,
            'ElementTree': ET,
            'minidom': minidom,
            'OrderedDict': OrderedDict,
            'defaultdict': defaultdict,
        })
        
        # Inject utility functions
        execution_logs = []
        
        def log(message: str):
            """Log a message during execution"""
            execution_logs.append(f"[{datetime.now().isoformat()}] {message}")
            logger.info(f"User code log: {message}")
        
        def query_db(query: str, params=None):
            """Execute a database query"""
            try:
                log(f"Executing query: {query[:100]}...")
                results = DatabaseService.execute_query(
                    db_type=context.connector_type,
                    config=context.connector_config,
                    credentials=context.connector_credentials,
                    query=query,
                    params=params
                )
                df = pd.DataFrame(results)
                log(f"Query returned {len(df)} rows")
                return df
            except Exception as e:
                log(f"Query error: {str(e)}")
                raise
        
        def get_mapping(mapping_name: str, source_value: Any) -> Any:
            """Get mapped value from cross-reference"""
            if mapping_name not in context.mappings:
                log(f"Warning: Mapping '{mapping_name}' not found")
                return source_value
            
            mapping_df = context.mappings[mapping_name]
            result = mapping_df[mapping_df['source_value'] == source_value]
            
            if len(result) > 0:
                return result.iloc[0]['target_value']
            else:
                log(f"Warning: No mapping found for '{source_value}' in '{mapping_name}'")
                return source_value
        
        sandbox.update({
            'log': log,
            'query_db': query_db,
            'get_mapping': get_mapping,
            'parameters': context.parameters,
            '_execution_logs': execution_logs,
        })
        
        return sandbox
    
    @staticmethod
    @contextmanager
    def resource_limits(limits: ResourceLimits):
        """
        Context manager to enforce resource limits.
        
        Args:
            limits: Resource limits to enforce
        """
        # Set memory limit (in bytes)
        if sys.platform != 'win32':  # resource module doesn't work on Windows
            try:
                memory_limit = limits.max_memory_mb * 1024 * 1024
                resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
            except Exception as e:
                logger.warning(f"Could not set memory limit: {e}")
        
        # Set timeout using signal (Unix-like systems only)
        if sys.platform != 'win32':
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(limits.max_execution_seconds)
        
        try:
            yield
        finally:
            # Reset limits
            if sys.platform != 'win32':
                signal.alarm(0)  # Cancel alarm
    
    @staticmethod
    def execute(
        code: str,
        context: ExecutionContext,
        limits: ResourceLimits
    ) -> ExecutionResult:
        """
        Execute Python code in a sandboxed environment.
        
        Args:
            code: Python code to execute
            context: Execution context with database/mapping access
            limits: Resource limits
            
        Returns:
            ExecutionResult with output data or error information
        """
        start_time = time.time()
        
        # Validate code first
        validation = CodeExecutor.validate_code(code, limits)
        if not validation.valid:
            return ExecutionResult(
                success=False,
                error="Code validation failed",
                error_type="ValidationError",
                stack_trace="\n".join(validation.errors),
                code_lines=len(code.split('\n'))
            )
        
        # Create sandbox environment
        sandbox = CodeExecutor.create_sandbox(context)
        
        # Capture stdout
        old_stdout = sys.stdout
        sys.stdout = captured_output = io.StringIO()
        
        try:
            # Compile with RestrictedPython
            # compile_restricted returns a code object directly (or raises SyntaxError)
            try:
                byte_code = compile_restricted(
                    code,
                    filename='<user_code>',
                    mode='exec'
                )
            except SyntaxError as e:
                return ExecutionResult(
                    success=False,
                    error="Code compilation failed",
                    error_type="CompilationError",
                    stack_trace=str(e),
                    code_lines=len(code.split('\n'))
                )
            
            # Execute with resource limits
            with CodeExecutor.resource_limits(limits):
                exec(byte_code, sandbox)
            
            # Get execution result
            execution_time = time.time() - start_time
            
            # Extract output (look for 'result' or 'output' variable)
            output_data = sandbox.get('result') or sandbox.get('output')
            
            # Get execution logs
            logs = sandbox.get('_execution_logs', [])
            stdout_content = captured_output.getvalue()
            if stdout_content:
                logs.append(f"[stdout] {stdout_content}")
            
            # Calculate output size
            output_size = 0
            if output_data is not None:
                if isinstance(output_data, pd.DataFrame):
                    output_size = output_data.memory_usage(deep=True).sum()
                elif isinstance(output_data, (dict, list)):
                    # sys is already imported at module level
                    output_size = len(str(output_data))
            
            # Check output size limit
            max_output_bytes = limits.max_output_size_mb * 1024 * 1024
            if output_size > max_output_bytes:
                return ExecutionResult(
                    success=False,
                    error=f"Output size ({output_size / 1024 / 1024:.2f}MB) exceeds limit ({limits.max_output_size_mb}MB)",
                    error_type="OutputSizeError",
                    execution_time_seconds=execution_time,
                    logs=logs
                )
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_seconds=execution_time,
                logs=logs,
                code_lines=len(code.split('\n')),
                output_size_bytes=output_size
            )
            
        except TimeoutError as e:
            return ExecutionResult(
                success=False,
                error=f"Execution timeout: {str(e)}",
                error_type="TimeoutError",
                execution_time_seconds=time.time() - start_time,
                logs=sandbox.get('_execution_logs', [])
            )
            
        except MemoryError as e:
            return ExecutionResult(
                success=False,
                error=f"Memory limit exceeded: {str(e)}",
                error_type="MemoryError",
                execution_time_seconds=time.time() - start_time,
                logs=sandbox.get('_execution_logs', [])
            )
            
        except Exception as e:
            return ExecutionResult(
                success=False,
                error=str(e),
                error_type=type(e).__name__,
                stack_trace=traceback.format_exc(),
                execution_time_seconds=time.time() - start_time,
                logs=sandbox.get('_execution_logs', [])
            )
            
        finally:
            # Restore stdout
            sys.stdout = old_stdout
