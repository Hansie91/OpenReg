"""
Artifact Generation Service

Converts DataFrames to various output formats (CSV, XML, JSON, TXT)
with metadata generation and checksum calculation.
"""

import pandas as pd
import json
import hashlib
import gzip
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET
import xml.dom.minidom as minidom
import logging

logger = logging.getLogger(__name__)


class ArtifactGenerator:
    """Service for generating artifacts in multiple formats"""
    
    @staticmethod
    def generate_csv(
        data: pd.DataFrame,
        filepath: str,
        delimiter: str = ',',
        include_index: bool = False,
        encoding: str = 'utf-8',
        compress: bool = False
    ) -> Dict[str, Any]:
        """
        Generate CSV artifact from DataFrame.
        
        Args:
            data: DataFrame to export
            filepath: Output file path
            delimiter: CSV delimiter (default: comma)
            include_index: Whether to include DataFrame index
            encoding: File encoding
            compress: Whether to gzip compress the file
            
        Returns:
            Dict with metadata (size, checksum, row_count, column_count)
        """
        try:
            logger.info(f"Generating CSV artifact: {filepath}")
            
            # Write CSV
            data.to_csv(
                filepath,
                sep=delimiter,
                index=include_index,
                encoding=encoding,
                date_format='%Y-%m-%d %H:%M:%S'
            )
            
            # Optionally compress
            if compress:
                with open(filepath, 'rb') as f_in:
                    with gzip.open(f"{filepath}.gz", 'wb') as f_out:
                        f_out.writelines(f_in)
                filepath = f"{filepath}.gz"
            
            # Generate metadata
            metadata = ArtifactGenerator._generate_metadata(
                filepath, data, 'text/csv'
            )
            
            logger.info(f"CSV artifact generated: {metadata['size_bytes']} bytes, {metadata['row_count']} rows")
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to generate CSV: {e}")
            raise
    
    @staticmethod
    def generate_json(
        data: pd.DataFrame,
        filepath: str,
        orient: str = 'records',
        date_format: str = 'iso',
        compress: bool = False
    ) -> Dict[str, Any]:
        """
        Generate JSON artifact from DataFrame.
        
        Args:
            data: DataFrame to export
            filepath: Output file path
            orient: JSON structure ('records', 'index', 'columns', 'values')
            date_format: Date serialization format
            compress: Whether to gzip compress
            
        Returns:
            Dict with metadata
        """
        try:
            logger.info(f"Generating JSON artifact: {filepath}")
            
            # Convert DataFrame to JSON
            json_data = data.to_json(
                orient=orient,
                date_format=date_format,
                indent=2
            )
            
            # Write JSON
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(json_data)
            
            # Optionally compress
            if compress:
                with open(filepath, 'rb') as f_in:
                    with gzip.open(f"{filepath}.gz", 'wb') as f_out:
                        f_out.writelines(f_in)
                filepath = f"{filepath}.gz"
            
            # Generate metadata
            metadata = ArtifactGenerator._generate_metadata(
                filepath, data, 'application/json'
            )
            
            logger.info(f"JSON artifact generated: {metadata['size_bytes']} bytes")
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to generate JSON: {e}")
            raise
    
    @staticmethod
    def generate_xml(
        data: pd.DataFrame,
        filepath: str,
        root_name: str = 'data',
        row_name: str = 'row',
        compress: bool = False
    ) -> Dict[str, Any]:
        """
        Generate XML artifact from DataFrame.
        
        Args:
            data: DataFrame to export
            filepath: Output file path
            root_name: Name of root XML element
            row_name: Name of row elements
            compress: Whether to gzip compress
            
        Returns:
            Dict with metadata
        """
        try:
            logger.info(f"Generating XML artifact: {filepath}")
            
            # Create root element
            root = ET.Element(root_name)
            root.set('generated_at', datetime.utcnow().isoformat())
            root.set('row_count', str(len(data)))
            root.set('column_count', str(len(data.columns)))
            
            # Add each row
            for idx, row in data.iterrows():
                row_elem = ET.SubElement(root, row_name)
                row_elem.set('index', str(idx))
                
                for col_name, value in row.items():
                    col_elem = ET.SubElement(row_elem, str(col_name).replace(' ', '_'))
                    
                    # Handle different data types
                    if pd.isna(value):
                        col_elem.set('null', 'true')
                        col_elem.text = ''
                    elif isinstance(value, (pd.Timestamp, datetime)):
                        col_elem.text = value.isoformat()
                    else:
                        col_elem.text = str(value)
            
            # Pretty print XML
            xml_str = minidom.parseString(
                ET.tostring(root, encoding='utf-8')
            ).toprettyxml(indent='  ', encoding='utf-8')
            
            # Write XML
            with open(filepath, 'wb') as f:
                f.write(xml_str)
            
            # Optionally compress
            if compress:
                with open(filepath, 'rb') as f_in:
                    with gzip.open(f"{filepath}.gz", 'wb') as f_out:
                        f_out.writelines(f_in)
                filepath = f"{filepath}.gz"
            
            # Generate metadata
            metadata = ArtifactGenerator._generate_metadata(
                filepath, data, 'application/xml'
            )
            
            logger.info(f"XML artifact generated: {metadata['size_bytes']} bytes")
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to generate XML: {e}")
            raise
    
    @staticmethod
    def generate_txt(
        data: pd.DataFrame,
        filepath: str,
        delimiter: str = '\t',
        include_header: bool = True,
        encoding: str = 'utf-8',
        compress: bool = False
    ) -> Dict[str, Any]:
        """
        Generate plain text artifact from DataFrame.
        
        Args:
            data: DataFrame to export
            filepath: Output file path
            delimiter: Column delimiter (tab, pipe, etc.)
            include_header: Whether to include column headers
            encoding: File encoding
            compress: Whether to gzip compress
            
        Returns:
            Dict with metadata
        """
        try:
            logger.info(f"Generating TXT artifact: {filepath}")
            
            # Build text content
            lines = []
            
            # Add header if requested
            if include_header:
                header = delimiter.join(str(col) for col in data.columns)
                lines.append(header)
            
            # Add data rows
            for _, row in data.iterrows():
                row_text = delimiter.join(
                    '' if pd.isna(val) else str(val) 
                    for val in row
                )
                lines.append(row_text)
            
            # Write to file
            with open(filepath, 'w', encoding=encoding) as f:
                f.write('\n'.join(lines))
            
            # Optionally compress
            if compress:
                with open(filepath, 'rb') as f_in:
                    with gzip.open(f"{filepath}.gz", 'wb') as f_out:
                        f_out.writelines(f_in)
                filepath = f"{filepath}.gz"
            
            # Generate metadata
            metadata = ArtifactGenerator._generate_metadata(
                filepath, data, 'text/plain'
            )
            
            logger.info(f"TXT artifact generated: {metadata['size_bytes']} bytes")
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to generate TXT: {e}")
            raise
    
    @staticmethod
    def _generate_metadata(
        filepath: str,
        data: pd.DataFrame,
        mime_type: str
    ) -> Dict[str, Any]:
        """
        Generate metadata for artifact file.
        
        Args:
            filepath: Path to artifact file
            data: Source DataFrame
            mime_type: MIME type of artifact
            
        Returns:
            Dict with metadata
        """
        file_path = Path(filepath)
        file_size = file_path.stat().st_size
        
        # Calculate checksums
        md5_hash = hashlib.md5()
        sha256_hash = hashlib.sha256()
        
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                md5_hash.update(chunk)
                sha256_hash.update(chunk)
        
        # Collect column info
        column_info = []
        for col in data.columns:
            dtype = str(data[col].dtype)
            null_count = int(data[col].isna().sum())
            
            column_info.append({
                'name': col,
                'dtype': dtype,
                'null_count': null_count
            })
        
        return {
            'filename': file_path.name,
            'filepath': str(file_path),
            'size_bytes': file_size,
            'mime_type': mime_type,
            'row_count': len(data),
            'column_count': len(data.columns),
            'columns': column_info,
            'md5_checksum': md5_hash.hexdigest(),
            'sha256_checksum': sha256_hash.hexdigest(),
            'generated_at': datetime.utcnow().isoformat()
        }
