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
    def generate_xml_from_dicts(
        data: List[Dict[str, Any]],
        filepath: str,
        root_name: str = 'Document',
        row_name: str = 'Tx',
        pretty_print: bool = True,
        include_declaration: bool = True,
        namespace: Optional[str] = None,
        namespace_prefix: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate hierarchical XML from a list of nested dictionaries.
        
        This method properly handles nested dict structures like:
        [{'New': {'TxId': '123', 'Buyr': {'LEI': 'ABC'}}}]
        
        Args:
            data: List of nested dictionaries
            filepath: Output file path
            root_name: Name of root XML element
            row_name: Name of each row wrapper element
            pretty_print: Whether to indent the output
            include_declaration: Whether to include XML declaration
            namespace: Optional XML namespace
            namespace_prefix: Optional namespace prefix
            
        Returns:
            Dict with metadata
        """
        try:
            logger.info(f"Generating hierarchical XML artifact: {filepath}")
            
            indent = '    ' if pretty_print else ''
            newline = '\n' if pretty_print else ''
            
            lines = []
            
            # XML Declaration
            if include_declaration:
                lines.append('<?xml version="1.0" encoding="UTF-8"?>')
            
            # Root element with optional namespace
            if namespace and namespace_prefix:
                lines.append(f'<{root_name} xmlns:{namespace_prefix}="{namespace}">')
            elif namespace:
                lines.append(f'<{root_name} xmlns="{namespace}">')
            else:
                lines.append(f'<{root_name}>')
            
            # Process each record
            for record in data:
                # Wrap in row element
                lines.append(f'{indent}<{row_name}>')
                # Recursively build XML from nested dict
                record_xml = ArtifactGenerator._dict_to_xml(record, 2, pretty_print)
                lines.append(record_xml)
                lines.append(f'{indent}</{row_name}>')
            
            # Close root
            lines.append(f'</{root_name}>')
            
            # Join and write
            xml_content = newline.join(lines)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(xml_content)
            
            # Generate metadata
            import pandas as pd
            dummy_df = pd.DataFrame({'records': range(len(data))})
            metadata = ArtifactGenerator._generate_metadata(filepath, dummy_df, 'application/xml')
            metadata['row_count'] = len(data)
            
            logger.info(f"Hierarchical XML artifact generated: {metadata['size_bytes']} bytes")
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to generate hierarchical XML: {e}")
            raise
    
    @staticmethod
    def _dict_to_xml(data: Any, indent_level: int = 0, pretty_print: bool = True) -> str:
        """
        Recursively convert a dictionary or value to XML string.
        
        Args:
            data: Dictionary, list, or primitive value
            indent_level: Current indentation level
            pretty_print: Whether to format with indentation
            
        Returns:
            XML string
        """
        indent = '    ' * indent_level if pretty_print else ''
        newline = '\n' if pretty_print else ''
        lines = []
        
        if isinstance(data, dict):
            for key, value in data.items():
                if value is None:
                    continue
                    
                # Escape XML special chars in key
                safe_key = str(key).replace(' ', '_').replace('-', '_')
                
                if isinstance(value, dict):
                    # Nested dict
                    lines.append(f'{indent}<{safe_key}>')
                    child_xml = ArtifactGenerator._dict_to_xml(value, indent_level + 1, pretty_print)
                    if child_xml:
                        lines.append(child_xml)
                    lines.append(f'{indent}</{safe_key}>')
                elif isinstance(value, list):
                    # List of items
                    for item in value:
                        lines.append(f'{indent}<{safe_key}>')
                        child_xml = ArtifactGenerator._dict_to_xml(item, indent_level + 1, pretty_print)
                        if child_xml:
                            lines.append(child_xml)
                        lines.append(f'{indent}</{safe_key}>')
                else:
                    # Leaf value
                    escaped_value = ArtifactGenerator._escape_xml(str(value))
                    lines.append(f'{indent}<{safe_key}>{escaped_value}</{safe_key}>')
        elif isinstance(data, list):
            for item in data:
                item_xml = ArtifactGenerator._dict_to_xml(item, indent_level, pretty_print)
                if item_xml:
                    lines.append(item_xml)
        else:
            # Primitive value
            escaped = ArtifactGenerator._escape_xml(str(data))
            return f'{indent}{escaped}'
        
        return newline.join(lines)
    
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
        compress: bool = False,
        field_mappings: Optional[List[Dict[str, Any]]] = None,
        namespace: Optional[str] = None,
        namespace_prefix: Optional[str] = None,
        pretty_print: bool = True,
        include_declaration: bool = True
    ) -> Dict[str, Any]:
        """
        Generate XML artifact from DataFrame.
        
        Args:
            data: DataFrame to export
            filepath: Output file path
            root_name: Name of root XML element (used if no field_mappings)
            row_name: Name of row elements (used if no field_mappings)
            compress: Whether to gzip compress
            field_mappings: List of field mappings with targetXPath for hierarchical structure
            namespace: XML namespace URI
            namespace_prefix: Prefix for the namespace
            pretty_print: Whether to pretty-print (indent) the XML output
            include_declaration: Whether to include XML declaration
            
        Returns:
            Dict with metadata
        """
        try:
            logger.info(f"Generating XML artifact: {filepath}")
            
            # If field_mappings provided, use hierarchical generation
            if field_mappings and len(field_mappings) > 0:
                xml_content = ArtifactGenerator._generate_hierarchical_xml(
                    data=data,
                    field_mappings=field_mappings,
                    namespace=namespace,
                    namespace_prefix=namespace_prefix,
                    pretty_print=pretty_print,
                    include_declaration=include_declaration
                )
                
                # Write XML with proper formatting
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(xml_content)
            else:
                # Fall back to flat structure
                root = ET.Element(root_name)
                root.set('generated_at', datetime.utcnow().isoformat())
                root.set('row_count', str(len(data)))
                root.set('column_count', str(len(data.columns)))
                
                # Add each row
                for idx, row in data.iterrows():
                    row_elem = ET.SubElement(root, row_name)
                    row_elem.set('index', str(idx))
                    
                    for col_name, value in row.items():
                        # Sanitize column name for XML tag
                        safe_col_name = str(col_name).replace(' ', '_').replace('-', '_')
                        # Remove any characters not valid in XML tags
                        safe_col_name = ''.join(c for c in safe_col_name if c.isalnum() or c == '_')
                        if not safe_col_name or not safe_col_name[0].isalpha():
                            safe_col_name = 'field_' + safe_col_name
                        
                        col_elem = ET.SubElement(row_elem, safe_col_name)
                        
                        # Handle different data types
                        if pd.isna(value):
                            col_elem.set('null', 'true')
                            col_elem.text = ''
                        elif isinstance(value, (pd.Timestamp, datetime)):
                            col_elem.text = value.isoformat()
                        else:
                            col_elem.text = str(value)
                
                # Convert to string first
                xml_str = ET.tostring(root, encoding='unicode')
                
                # Pretty print if requested
                if pretty_print:
                    dom = minidom.parseString(xml_str)
                    if include_declaration:
                        xml_output = dom.toprettyxml(indent='  ', encoding=None)
                    else:
                        # Remove the XML declaration line
                        xml_output = '\n'.join(dom.toprettyxml(indent='  ').split('\n')[1:])
                else:
                    if include_declaration:
                        xml_output = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_str
                    else:
                        xml_output = xml_str
                
                # Write to file
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(xml_output)
            
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
    def _generate_hierarchical_xml(
        data: pd.DataFrame,
        field_mappings: List[Dict[str, Any]],
        namespace: Optional[str] = None,
        namespace_prefix: Optional[str] = None,
        pretty_print: bool = True,
        include_declaration: bool = True
    ) -> str:
        """
        Generate hierarchical XML from DataFrame using XPath field mappings.
        
        Args:
            data: DataFrame with the data
            field_mappings: List of mappings with sourceColumn and targetXPath
            namespace: Optional XML namespace
            namespace_prefix: Optional namespace prefix
            pretty_print: Whether to pretty-print (indent) the XML output
            include_declaration: Whether to include XML declaration
            
        Returns:
            Formatted XML string
        """
        # Determine root element from field mappings
        # Find the common root from all XPaths
        xpaths = [m.get('targetXPath', '') for m in field_mappings if m.get('targetXPath')]
        if not xpaths:
            # No valid XPaths, use default
            root_name = 'Document'
        else:
            # Extract root element name from first XPath
            first_xpath = xpaths[0].lstrip('/')
            root_name = first_xpath.split('/')[0] if '/' in first_xpath else first_xpath
        
        # Determine repeating element (the element that wraps each row)
        # Usually it's the element that appears right after the root
        row_wrapper = None
        for xpath in xpaths:
            parts = xpath.lstrip('/').split('/')
            if len(parts) >= 2:
                row_wrapper = parts[1]
                break
        
        # Build XML structure
        lines = []
        newline = '\n' if pretty_print else ''
        
        if include_declaration:
            lines.append('<?xml version="1.0" encoding="UTF-8"?>')
        
        # Add root element with optional namespace
        if namespace and namespace_prefix:
            lines.append(f'<{root_name} xmlns:{namespace_prefix}="{namespace}">')
        elif namespace:
            lines.append(f'<{root_name} xmlns="{namespace}">')
        else:
            lines.append(f'<{root_name}>')
        
        # Process each row of data
        for idx, row in data.iterrows():
            # Build hierarchical structure for this row
            row_xml = ArtifactGenerator._build_row_xml(
                row=row,
                field_mappings=field_mappings,
                root_name=root_name,
                indent_level=1 if pretty_print else 0,
                pretty_print=pretty_print
            )
            lines.append(row_xml)
        
        # Close root element
        lines.append(f'</{root_name}>')
        
        return newline.join(lines)
    
    @staticmethod
    def _build_row_xml(
        row: pd.Series,
        field_mappings: List[Dict[str, Any]],
        root_name: str,
        indent_level: int = 1,
        pretty_print: bool = True
    ) -> str:
        """
        Build XML for a single row based on field mappings.
        
        Args:
            row: DataFrame row
            field_mappings: List of field mappings
            root_name: Root element name (to exclude from path)
            indent_level: Current indentation level
            pretty_print: Whether to pretty-print (indent) the XML output
            
        Returns:
            XML string for this row
        """
        indent = '    ' * indent_level if pretty_print else ''
        
        # Build a tree structure from mappings
        # Key = tuple of path elements, Value = value
        path_values = {}
        
        for mapping in field_mappings:
            source_col = mapping.get('sourceColumn', '')
            target_xpath = mapping.get('targetXPath', '')
            default_value = mapping.get('defaultValue', '')
            
            if not target_xpath:
                continue
            
            # Derive the target field name from XPath (last element, used by code generator)
            target_field_name = target_xpath.split('/')[-1].replace('@', '') if target_xpath else ''
            
            # Get value from row - try multiple column names:
            # 1. Source column name (for direct data)
            # 2. Target field name (for transformed data from code generator)
            value = None
            
            if source_col and source_col in row.index:
                value = row[source_col]
            elif target_field_name and target_field_name in row.index:
                value = row[target_field_name]
            
            # Handle value conversion
            if value is None or (hasattr(value, '__iter__') and pd.isna(value)):
                value = default_value or ''
            elif isinstance(value, (pd.Timestamp, datetime)):
                value = value.isoformat()
            else:
                value = str(value) if value is not None else ''
            
            # Use default if value is empty
            if not value and default_value:
                value = default_value
            
            # Parse XPath into path parts (skip root element)
            path_parts = target_xpath.lstrip('/').split('/')
            if path_parts[0] == root_name:
                path_parts = path_parts[1:]  # Remove root from path
            
            if path_parts:
                path_values[tuple(path_parts)] = value
        
        # Build XML from path structure
        return ArtifactGenerator._paths_to_xml(path_values, indent_level, pretty_print)
    
    @staticmethod
    def _paths_to_xml(path_values: Dict[tuple, str], indent_level: int = 1, pretty_print: bool = True) -> str:
        """
        Convert path-value pairs to XML string.
        
        Args:
            path_values: Dict mapping path tuples to values
            indent_level: Current indentation level
            pretty_print: Whether to pretty-print (indent) the XML output
            
        Returns:
            XML string
        """
        # Group by first element to build hierarchy
        from collections import defaultdict
        
        # Find the row wrapper element (first level after root)
        first_elements = set()
        for path in path_values.keys():
            if path:
                first_elements.add(path[0])
        
        if not first_elements:
            return ''
        
        lines = []
        indent = '    ' * indent_level if pretty_print else ''
        newline = '\n' if pretty_print else ''
        
        # Group paths by their first element
        grouped = defaultdict(dict)
        for path, value in path_values.items():
            if path:
                first = path[0]
                rest = path[1:]
                if rest:
                    grouped[first][rest] = value
                else:
                    # Leaf element
                    grouped[first][tuple()] = value
        
        # Recursively build XML
        for element, sub_paths in grouped.items():
            # Handle attributes (elements starting with @)
            if element.startswith('@'):
                continue  # Attributes handled separately
            
            # Check for leaf vs nested
            if tuple() in sub_paths and len(sub_paths) == 1:
                # Simple leaf element
                value = sub_paths[tuple()]
                escaped_value = ArtifactGenerator._escape_xml(value)
                lines.append(f'{indent}<{element}>{escaped_value}</{element}>')
            elif sub_paths:
                # Nested element
                lines.append(f'{indent}<{element}>')
                
                # Check for direct value
                if tuple() in sub_paths:
                    value = sub_paths.pop(tuple())
                    # Element has both value and children - put value as text
                    if value:
                        child_indent = '    ' * (indent_level + 1) if pretty_print else ''
                        lines.append(f'{child_indent}{ArtifactGenerator._escape_xml(value)}')
                
                # Recursively build children
                child_xml = ArtifactGenerator._paths_to_xml(sub_paths, indent_level + 1, pretty_print)
                if child_xml:
                    lines.append(child_xml)
                
                lines.append(f'{indent}</{element}>')
            else:
                # Empty element
                lines.append(f'{indent}<{element}/>')
        
        return newline.join(lines)
    
    @staticmethod
    def _escape_xml(value: str) -> str:
        """Escape special XML characters."""
        if not value:
            return ''
        return (str(value)
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&apos;'))
    
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
