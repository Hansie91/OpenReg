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
import logging

logger = logging.getLogger(__name__)


class ArtifactGenerator:
    """Service for generating artifacts in multiple formats"""

    @staticmethod
    def replace_placeholders(
        template: str,
        record_count: int = 0,
        reporting_date: Optional[str] = None,
        reporting_lei: str = '',
        page_number: int = 1,
        filename: str = '',
        data: Optional[str] = None
    ) -> str:
        """
        Replace placeholders in a template string.

        Supported placeholders:
            {record_count} - Number of records
            {reporting_date} - Current date in ISO format
            {reporting_lei} - Reporting party LEI
            {page_number} - Page number for pagination
            {filename} - Output filename
            {data} - Data content (for JSON wrapper)
            {timestamp} - Current timestamp

        Args:
            template: Template string with placeholders
            record_count: Number of records
            reporting_date: Reporting date (default: today)
            reporting_lei: LEI code
            page_number: Page number
            filename: Output filename
            data: Data content for embedding

        Returns:
            Template with placeholders replaced
        """
        from datetime import date, datetime

        if not reporting_date:
            reporting_date = date.today().isoformat()

        replacements = {
            '{record_count}': str(record_count),
            '{reporting_date}': reporting_date,
            '{reporting_lei}': reporting_lei,
            '{page_number}': str(page_number),
            '{filename}': filename,
            '{timestamp}': datetime.now().isoformat(),
        }

        result = template
        for placeholder, value in replacements.items():
            result = result.replace(placeholder, value)

        # Handle {data} separately as it might be large
        if data is not None:
            result = result.replace('{data}', data)

        return result

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
        quote_char: str = '"',
        escape_char: str = '\\',
        include_header: bool = True,
        include_index: bool = False,
        encoding: str = 'utf-8',
        line_ending: str = 'lf',
        column_headers: Optional[List[str]] = None,
        compress: bool = False,
        file_header: Optional[str] = None,
        file_trailer: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate CSV artifact from DataFrame.

        Args:
            data: DataFrame to export
            filepath: Output file path
            delimiter: CSV delimiter (default: comma)
            quote_char: Character used to quote fields (default: ")
            escape_char: Character used to escape quote_char (default: \\)
            include_header: Whether to include column headers (default: True)
            include_index: Whether to include DataFrame index
            encoding: File encoding
            line_ending: Line ending style - 'lf' (Unix) or 'crlf' (Windows)
            column_headers: Optional custom column header names
            compress: Whether to gzip compress the file
            file_header: Optional header lines to prepend (supports placeholders)
            file_trailer: Optional trailer lines to append (supports placeholders)

        Returns:
            Dict with metadata (size, checksum, row_count, column_count)
        """
        try:
            logger.info(f"Generating CSV artifact: {filepath}")

            # Apply custom column headers if provided
            output_data = data.copy()
            if column_headers:
                if len(column_headers) == len(data.columns):
                    logger.info(f"Applying custom column headers: {column_headers}")
                    output_data.columns = column_headers
                else:
                    logger.warning(
                        f"Column headers count mismatch: {len(column_headers)} headers for "
                        f"{len(data.columns)} columns. Using original column names: {list(data.columns)}"
                    )

            # Determine line terminator
            line_terminator = '\r\n' if line_ending == 'crlf' else '\n'

            # Get filename for placeholder replacement
            from pathlib import Path
            filename = Path(filepath).name

            # Write file header if provided
            if file_header:
                header_content = ArtifactGenerator.replace_placeholders(
                    file_header,
                    record_count=len(data),
                    filename=filename
                )
                with open(filepath, 'w', encoding=encoding) as f:
                    f.write(header_content)
                    if not header_content.endswith('\n'):
                        f.write(line_terminator)

                # Append CSV data
                output_data.to_csv(
                    filepath,
                    mode='a',  # Append mode
                    sep=delimiter,
                    quotechar=quote_char,
                    escapechar=escape_char if escape_char else None,
                    header=include_header,
                    index=include_index,
                    encoding=encoding,
                    lineterminator=line_terminator,
                    date_format='%Y-%m-%d %H:%M:%S'
                )
            else:
                # Write CSV normally
                output_data.to_csv(
                    filepath,
                    sep=delimiter,
                    quotechar=quote_char,
                    escapechar=escape_char if escape_char else None,
                    header=include_header,
                    index=include_index,
                    encoding=encoding,
                    lineterminator=line_terminator,
                    date_format='%Y-%m-%d %H:%M:%S'
                )

            # Write file trailer if provided
            if file_trailer:
                trailer_content = ArtifactGenerator.replace_placeholders(
                    file_trailer,
                    record_count=len(data),
                    filename=filename
                )
                with open(filepath, 'a', encoding=encoding) as f:
                    f.write(trailer_content)
                    if not trailer_content.endswith('\n'):
                        f.write(line_terminator)
            
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
        indent: Optional[int] = 2,
        compress: bool = False,
        wrapper_template: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate JSON artifact from DataFrame.

        Args:
            data: DataFrame to export
            filepath: Output file path
            orient: JSON structure ('records', 'index', 'columns', 'values')
            date_format: Date serialization format
            indent: Indentation level for pretty printing (None for compact)
            compress: Whether to gzip compress
            wrapper_template: Optional wrapper template with {data} placeholder

        Returns:
            Dict with metadata
        """
        try:
            logger.info(f"Generating JSON artifact: {filepath}")

            # Convert DataFrame to JSON
            json_data = data.to_json(
                orient=orient,
                date_format=date_format,
                indent=indent
            )

            # Apply wrapper template if provided
            if wrapper_template:
                output_content = ArtifactGenerator.replace_placeholders(
                    wrapper_template,
                    record_count=len(data),
                    data=json_data
                )
            else:
                output_content = json_data

            # Write JSON
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(output_content)
            
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
        include_declaration: bool = True,
        header_config: Optional[Dict[str, Any]] = None
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
            header_config: Optional header configuration for regulatory reports (MiFIR, etc.)
                - message_type: e.g., "auth.016" for MiFIR transaction reports
                - reporting_party_lei: LEI of the reporting entity
                - competent_authority_country: Country code of the NCA (e.g., "NL")
                - include_record_count: Whether to include NbRcrds (default: True)
                - include_pagination: Whether to include MsgPgntn (default: False)
                - page_number: Current page number (default: 1)
                - is_last_page: Whether this is the last page (default: True)

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
                    root_name=root_name,
                    namespace=namespace,
                    namespace_prefix=namespace_prefix,
                    pretty_print=pretty_print,
                    include_declaration=include_declaration,
                    header_config=header_config,
                    record_count=len(data)
                )
                
                # Write XML with proper formatting
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(xml_content)
            else:
                # Fall back to flat structure - use streaming approach to avoid memory issues
                xml_content = ArtifactGenerator._generate_flat_xml_streaming(
                    data=data,
                    root_name=root_name or 'Document',
                    row_name=row_name or 'Tx',
                    pretty_print=pretty_print,
                    include_declaration=include_declaration,
                    header_config=header_config
                )

                # Write to file
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(xml_content)
            
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
    
    # ISO 20022 regulatory message type configurations
    # Used for MiFIR, EMIR, SFTR and other regulatory reports
    #
    # IMPORTANT: All packaged regulatory reports MUST use these message types
    # with proper headers. See .claude/CLAUDE.md for template requirements.
    #
    REGULATORY_MESSAGE_TYPES = {
        # =====================================================
        # MiFIR - Markets in Financial Instruments Regulation
        # =====================================================
        'auth.016': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.016.001.01',
            'message_wrapper': 'FinInstrmRptgTxRpt',
            'row_element': 'Tx',
            'description': 'MiFIR Transaction Report',
            'regulation': 'MiFIR',
            'header_type': 'RptHdr'
        },
        'auth.017': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.017.001.01',
            'message_wrapper': 'FinInstrmRptgTxRptStsAdvc',
            'row_element': 'TxStsAdvc',
            'description': 'MiFIR Transaction Report Status Advice',
            'regulation': 'MiFIR',
            'header_type': 'RptHdr'
        },
        'auth.040': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.040.001.01',
            'message_wrapper': 'FinInstrmRptgRefDataRpt',
            'row_element': 'RefData',
            'description': 'MiFIR Reference Data Report',
            'regulation': 'MiFIR',
            'header_type': 'RptHdr'
        },
        'auth.041': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.041.001.01',
            'message_wrapper': 'FinInstrmRptgRefDataRptStsAdvc',
            'row_element': 'RefDataSts',
            'description': 'MiFIR Reference Data Report Status Advice',
            'regulation': 'MiFIR',
            'header_type': 'RptHdr'
        },

        # =====================================================
        # EMIR - European Market Infrastructure Regulation
        # =====================================================
        'auth.030': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.030.001.03',
            'message_wrapper': 'DerivsTradRpt',
            'row_element': 'Trade',
            'description': 'EMIR Derivatives Trade Report',
            'regulation': 'EMIR',
            'header_type': 'TxHdr'
        },
        'auth.031': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.031.001.01',
            'message_wrapper': 'DerivsTradRptQry',
            'row_element': 'Qry',
            'description': 'EMIR Derivatives Trade Report Query',
            'regulation': 'EMIR',
            'header_type': 'TxHdr'
        },
        'auth.032': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.032.001.01',
            'message_wrapper': 'DerivsTradRptStsAdvc',
            'row_element': 'TradSts',
            'description': 'EMIR Derivatives Trade Report Status Advice',
            'regulation': 'EMIR',
            'header_type': 'TxHdr'
        },
        'auth.036': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.036.001.01',
            'message_wrapper': 'DerivsTradMrgnDataRpt',
            'row_element': 'MrgnData',
            'description': 'EMIR Margin Data Report',
            'regulation': 'EMIR',
            'header_type': 'TxHdr'
        },

        # =====================================================
        # SFTR - Securities Financing Transactions Regulation
        # =====================================================
        'auth.052': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.052.001.01',
            'message_wrapper': 'SctiesFincgRptgTxRpt',
            'row_element': 'SFT',
            'description': 'SFTR Securities Financing Transaction Report',
            'regulation': 'SFTR',
            'header_type': 'RptHdr'
        },
        'auth.053': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.053.001.01',
            'message_wrapper': 'SctiesFincgRptgTxStsAdvc',
            'row_element': 'TxSts',
            'description': 'SFTR Transaction Status Advice',
            'regulation': 'SFTR',
            'header_type': 'RptHdr'
        },
        'auth.070': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.070.001.01',
            'message_wrapper': 'SctiesFincgRptgMrgnDataRpt',
            'row_element': 'MrgnData',
            'description': 'SFTR Margin Data Report',
            'regulation': 'SFTR',
            'header_type': 'RptHdr'
        },
        'auth.071': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.071.001.01',
            'message_wrapper': 'SctiesFincgRptgReuseDataRpt',
            'row_element': 'ReuseData',
            'description': 'SFTR Reuse Data Report',
            'regulation': 'SFTR',
            'header_type': 'RptHdr'
        },

        # =====================================================
        # MMF - Money Market Funds Regulation
        # =====================================================
        'auth.025': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.025.001.01',
            'message_wrapper': 'MnyMktFndRpt',
            'row_element': 'Rpt',
            'description': 'Money Market Fund Report',
            'regulation': 'MMF',
            'header_type': 'RptHdr'
        },

        # =====================================================
        # AIFMD - Alternative Investment Fund Managers Directive
        # =====================================================
        'auth.045': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.045.001.01',
            'message_wrapper': 'AIFMRpt',
            'row_element': 'Fund',
            'description': 'AIFMD Manager Report',
            'regulation': 'AIFMD',
            'header_type': 'RptHdr'
        },

        # =====================================================
        # Short Selling Regulation
        # =====================================================
        'auth.010': {
            'namespace': 'urn:iso:std:iso:20022:tech:xsd:auth.010.001.01',
            'message_wrapper': 'ShrtSellgRpt',
            'row_element': 'Pos',
            'description': 'Short Selling Report',
            'regulation': 'SSR',
            'header_type': 'RptHdr'
        }
    }

    # Backwards compatibility alias
    MIFIR_MESSAGE_TYPES = REGULATORY_MESSAGE_TYPES

    @staticmethod
    def _generate_hierarchical_xml(
        data: pd.DataFrame,
        field_mappings: List[Dict[str, Any]],
        root_name: Optional[str] = None,
        namespace: Optional[str] = None,
        namespace_prefix: Optional[str] = None,
        pretty_print: bool = True,
        include_declaration: bool = True,
        header_config: Optional[Dict[str, Any]] = None,
        record_count: int = 0
    ) -> str:
        """
        Generate hierarchical XML from DataFrame using XPath field mappings.

        Args:
            data: DataFrame with the data
            field_mappings: List of mappings with sourceColumn and targetXPath
            root_name: Optional root element name (if not provided, derived from XPath)
            namespace: Optional XML namespace
            namespace_prefix: Optional namespace prefix
            pretty_print: Whether to pretty-print (indent) the XML output
            include_declaration: Whether to include XML declaration
            header_config: Optional header configuration for regulatory reports
            record_count: Number of records (for header)

        Returns:
            Formatted XML string
        """
        indent = '    ' if pretty_print else ''
        newline = '\n' if pretty_print else ''

        # Get all XPaths from field mappings
        xpaths = [m.get('targetXPath', '') for m in field_mappings if m.get('targetXPath')]

        # Check if we have MiFIR header config (structured)
        if header_config and header_config.get('message_type'):
            return ArtifactGenerator._generate_mifir_xml(
                data=data,
                field_mappings=field_mappings,
                header_config=header_config,
                record_count=record_count,
                pretty_print=pretty_print,
                include_declaration=include_declaration,
                namespace=namespace
            )

        # Check for custom header template (freeform)
        custom_header = header_config.get('custom_header') if header_config else None

        # Standard hierarchical XML generation (non-MiFIR)
        # Determine root element - use provided root_name or derive from field mappings
        if not root_name:
            if not xpaths:
                root_name = 'Document'
            else:
                # Extract root element name from first XPath
                first_xpath = xpaths[0].lstrip('/')
                root_name = first_xpath.split('/')[0] if '/' in first_xpath else first_xpath

        # Build XML structure
        lines = []

        if include_declaration:
            lines.append('<?xml version="1.0" encoding="UTF-8"?>')

        # Add root element with optional namespace
        if namespace and namespace_prefix:
            lines.append(f'<{root_name} xmlns:{namespace_prefix}="{namespace}">')
        elif namespace:
            lines.append(f'<{root_name} xmlns="{namespace}">')
        else:
            lines.append(f'<{root_name}>')

        # Add custom header if provided
        if custom_header:
            header_content = ArtifactGenerator.replace_placeholders(
                custom_header,
                record_count=record_count,
                reporting_lei=header_config.get('reporting_party_lei', '') if header_config else ''
            )
            # Indent each line of the header
            for line in header_content.split('\n'):
                lines.append(f'{indent}{line}' if line.strip() else '')

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
    def _generate_mifir_xml(
        data: pd.DataFrame,
        field_mappings: List[Dict[str, Any]],
        header_config: Dict[str, Any],
        record_count: int,
        pretty_print: bool = True,
        include_declaration: bool = True,
        namespace: Optional[str] = None
    ) -> str:
        """
        Generate MiFIR-compliant XML with proper header structure.

        Args:
            data: DataFrame with transaction data
            field_mappings: Field mappings for transactions
            header_config: Header configuration containing:
                - message_type: e.g., "auth.016"
                - reporting_party_lei: LEI of reporting entity
                - competent_authority_country: NCA country code
                - include_record_count: Include NbRcrds (default: True)
                - include_pagination: Include MsgPgntn (default: False)
                - page_number: Page number (default: 1)
                - is_last_page: Is last page (default: True)
                - reporting_date: Reporting date (default: today)
            record_count: Number of records
            pretty_print: Whether to indent output
            include_declaration: Include XML declaration

        Returns:
            MiFIR-compliant XML string
        """
        indent = '    ' if pretty_print else ''
        newline = '\n' if pretty_print else ''

        # Get message type config
        message_type = header_config.get('message_type', 'auth.016')
        msg_config = ArtifactGenerator.MIFIR_MESSAGE_TYPES.get(message_type, ArtifactGenerator.MIFIR_MESSAGE_TYPES['auth.016'])

        # Use provided namespace or default from message type
        ns = namespace or msg_config['namespace']
        message_wrapper = msg_config['message_wrapper']
        row_element = header_config.get('row_element') or msg_config['row_element']

        # Header values
        reporting_party_lei = header_config.get('reporting_party_lei', '')
        competent_authority = header_config.get('competent_authority_country', '')
        include_record_count = header_config.get('include_record_count', True)
        include_pagination = header_config.get('include_pagination', False)
        page_number = header_config.get('page_number', 1)
        is_last_page = header_config.get('is_last_page', True)

        # Get reporting date
        from datetime import date
        reporting_date = header_config.get('reporting_date') or date.today().isoformat()

        lines = []

        # XML declaration
        if include_declaration:
            lines.append('<?xml version="1.0" encoding="UTF-8"?>')

        # Document root with namespace
        lines.append(f'<Document xmlns="{ns}">')

        # Message wrapper
        lines.append(f'{indent}<{message_wrapper}>')

        # Report Header (RptHdr)
        lines.append(f'{indent}{indent}<RptHdr>')

        # Reporting Date
        lines.append(f'{indent}{indent}{indent}<RptgDt>{reporting_date}</RptgDt>')

        # Pagination (optional)
        if include_pagination:
            lines.append(f'{indent}{indent}{indent}<MsgPgntn>')
            lines.append(f'{indent}{indent}{indent}{indent}<PgNb>{page_number}</PgNb>')
            lines.append(f'{indent}{indent}{indent}{indent}<LastPgInd>{"true" if is_last_page else "false"}</LastPgInd>')
            lines.append(f'{indent}{indent}{indent}</MsgPgntn>')

        # Record count
        if include_record_count:
            lines.append(f'{indent}{indent}{indent}<NbRcrds>{record_count}</NbRcrds>')

        # Reporting Party
        if reporting_party_lei:
            lines.append(f'{indent}{indent}{indent}<RptgPty>')
            lines.append(f'{indent}{indent}{indent}{indent}<LEI>{reporting_party_lei}</LEI>')
            lines.append(f'{indent}{indent}{indent}</RptgPty>')

        # Competent Authority
        if competent_authority:
            lines.append(f'{indent}{indent}{indent}<CmptntAuthrty>')
            lines.append(f'{indent}{indent}{indent}{indent}<Ctry>{competent_authority}</Ctry>')
            lines.append(f'{indent}{indent}{indent}</CmptntAuthrty>')

        lines.append(f'{indent}{indent}</RptHdr>')

        # Process each row as a transaction
        for idx, row in data.iterrows():
            row_xml = ArtifactGenerator._build_mifir_transaction_xml(
                row=row,
                field_mappings=field_mappings,
                row_element=row_element,
                indent_level=2 if pretty_print else 0,
                pretty_print=pretty_print
            )
            lines.append(row_xml)

        # Close message wrapper and document
        lines.append(f'{indent}</{message_wrapper}>')
        lines.append('</Document>')

        return newline.join(lines)

    @staticmethod
    def _build_mifir_transaction_xml(
        row: pd.Series,
        field_mappings: List[Dict[str, Any]],
        row_element: str = 'Tx',
        indent_level: int = 2,
        pretty_print: bool = True
    ) -> str:
        """
        Build XML for a single MiFIR transaction.

        The field mappings use XPaths like /FinInstrmRptgTxRpt/Tx/Field,
        so we strip the prefix and build from Tx level.
        """
        indent = '    ' * indent_level if pretty_print else ''

        # Build path-value pairs, stripping the message wrapper prefix
        path_values = {}

        for mapping in field_mappings:
            source_col = mapping.get('sourceColumn', '')
            target_xpath = mapping.get('targetXPath', '')
            default_value = mapping.get('defaultValue', '')

            if not target_xpath:
                continue

            # Get value from row
            value = None
            if source_col and source_col in row.index:
                value = row[source_col]

            # Handle value conversion
            if value is None or (hasattr(value, '__iter__') and not isinstance(value, str) and pd.isna(value).any() if hasattr(pd.isna(value), 'any') else pd.isna(value)):
                value = default_value or ''
            elif hasattr(value, 'isoformat'):  # datetime
                value = value.isoformat()
            else:
                value = str(value) if value is not None else ''

            if not value and default_value:
                value = default_value

            # Parse XPath - strip everything up to and including row_element
            # e.g., /FinInstrmRptgTxRpt/Tx/TxId -> TxId
            # e.g., /FinInstrmRptgTxRpt/Tx/Buyr/LEI -> Buyr/LEI
            path_parts = target_xpath.lstrip('/').split('/')

            # Find the row_element in the path and take everything after it
            try:
                tx_index = path_parts.index(row_element)
                path_parts = path_parts[tx_index + 1:]  # Everything after Tx
            except ValueError:
                # row_element not found, use last parts
                if len(path_parts) > 2:
                    path_parts = path_parts[2:]  # Skip first two levels

            if path_parts:
                path_values[tuple(path_parts)] = value

        # Build XML from paths
        inner_xml = ArtifactGenerator._paths_to_xml(path_values, indent_level + 1, pretty_print)

        return f'{indent}<{row_element}>\n{inner_xml}\n{indent}</{row_element}>' if pretty_print else f'<{row_element}>{inner_xml}</{row_element}>'
    
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
    def _generate_flat_xml_streaming(
        data: pd.DataFrame,
        root_name: str = 'Document',
        row_name: str = 'Tx',
        pretty_print: bool = True,
        include_declaration: bool = True,
        header_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate flat XML from DataFrame using streaming approach.

        Builds XML string directly without using DOM parsing to avoid
        memory issues with large documents.

        Args:
            data: DataFrame to export
            root_name: Name of root XML element
            row_name: Name of row elements
            pretty_print: Whether to indent the output
            include_declaration: Whether to include XML declaration
            header_config: Optional header configuration for regulatory reports

        Returns:
            XML string
        """
        indent = '    ' if pretty_print else ''
        newline = '\n' if pretty_print else ''

        lines = []

        # XML declaration
        if include_declaration:
            lines.append('<?xml version="1.0" encoding="UTF-8"?>')

        # Check if we have regulatory header config
        if header_config and header_config.get('message_type'):
            # Use regulatory-compliant structure (MiFIR, EMIR, SFTR)
            message_type = header_config.get('message_type', 'auth.016')
            msg_config = ArtifactGenerator.REGULATORY_MESSAGE_TYPES.get(
                message_type, ArtifactGenerator.REGULATORY_MESSAGE_TYPES['auth.016']
            )

            ns = header_config.get('namespace') or msg_config['namespace']
            message_wrapper = msg_config['message_wrapper']
            row_element = header_config.get('row_element') or msg_config['row_element']
            regulation = msg_config.get('regulation', 'MiFIR')

            # Common header values
            include_record_count = header_config.get('include_record_count', True)
            from datetime import date
            import uuid
            reporting_date = header_config.get('reporting_date') or date.today().isoformat()
            creation_datetime = datetime.utcnow().isoformat() + 'Z'
            message_id = header_config.get('message_id') or str(uuid.uuid4())[:35]

            # Document root with namespace
            lines.append(f'<Document xmlns="{ns}">')

            # Message wrapper
            lines.append(f'{indent}<{message_wrapper}>')

            # Generate regulation-specific header
            if regulation == 'MiFIR':
                # MiFIR Report Header
                reporting_party_lei = header_config.get('reporting_party_lei', '')
                competent_authority = header_config.get('competent_authority_country', '')

                lines.append(f'{indent}{indent}<RptHdr>')
                lines.append(f'{indent}{indent}{indent}<RptgDt>{reporting_date}</RptgDt>')

                if include_record_count:
                    lines.append(f'{indent}{indent}{indent}<NbRcrds>{len(data)}</NbRcrds>')

                if reporting_party_lei:
                    lines.append(f'{indent}{indent}{indent}<RptgPty>')
                    lines.append(f'{indent}{indent}{indent}{indent}<LEI>{reporting_party_lei}</LEI>')
                    lines.append(f'{indent}{indent}{indent}</RptgPty>')

                if competent_authority:
                    lines.append(f'{indent}{indent}{indent}<CmptntAuthrty>')
                    lines.append(f'{indent}{indent}{indent}{indent}<Ctry>{competent_authority}</Ctry>')
                    lines.append(f'{indent}{indent}{indent}</CmptntAuthrty>')

                lines.append(f'{indent}{indent}</RptHdr>')

            elif regulation == 'EMIR':
                # EMIR Transaction Header
                reporting_counterparty_lei = header_config.get('reporting_counterparty_lei', '')
                trade_repository_lei = header_config.get('trade_repository_lei', '')
                report_submitting_entity_lei = header_config.get('report_submitting_entity_lei', '')
                action_type = header_config.get('action_type', 'NEWT')

                lines.append(f'{indent}{indent}<TxHdr>')
                lines.append(f'{indent}{indent}{indent}<MsgId>{message_id}</MsgId>')
                lines.append(f'{indent}{indent}{indent}<CreDtTm>{creation_datetime}</CreDtTm>')

                if include_record_count:
                    lines.append(f'{indent}{indent}{indent}<NbOfTxs>{len(data)}</NbOfTxs>')

                if reporting_counterparty_lei:
                    lines.append(f'{indent}{indent}{indent}<RptgCtrPty>')
                    lines.append(f'{indent}{indent}{indent}{indent}<LEI>{reporting_counterparty_lei}</LEI>')
                    lines.append(f'{indent}{indent}{indent}</RptgCtrPty>')

                if report_submitting_entity_lei:
                    lines.append(f'{indent}{indent}{indent}<RptSubmitgNtty>')
                    lines.append(f'{indent}{indent}{indent}{indent}<LEI>{report_submitting_entity_lei}</LEI>')
                    lines.append(f'{indent}{indent}{indent}</RptSubmitgNtty>')

                if trade_repository_lei:
                    lines.append(f'{indent}{indent}{indent}<TradRpstry>')
                    lines.append(f'{indent}{indent}{indent}{indent}<LEI>{trade_repository_lei}</LEI>')
                    lines.append(f'{indent}{indent}{indent}</TradRpstry>')

                lines.append(f'{indent}{indent}</TxHdr>')

            elif regulation == 'SFTR':
                # SFTR Report Header
                reporting_counterparty_lei = header_config.get('reporting_counterparty_lei', '')
                trade_repository_lei = header_config.get('trade_repository_lei', '')
                report_submitting_entity_lei = header_config.get('report_submitting_entity_lei', '')

                lines.append(f'{indent}{indent}<RptHdr>')
                lines.append(f'{indent}{indent}{indent}<MsgId>{message_id}</MsgId>')
                lines.append(f'{indent}{indent}{indent}<CreDtTm>{creation_datetime}</CreDtTm>')

                if include_record_count:
                    lines.append(f'{indent}{indent}{indent}<NbOfTxs>{len(data)}</NbOfTxs>')

                if reporting_counterparty_lei:
                    lines.append(f'{indent}{indent}{indent}<RptgCtrPty>')
                    lines.append(f'{indent}{indent}{indent}{indent}<LEI>{reporting_counterparty_lei}</LEI>')
                    lines.append(f'{indent}{indent}{indent}</RptgCtrPty>')

                if report_submitting_entity_lei:
                    lines.append(f'{indent}{indent}{indent}<RptSubmitgNtty>')
                    lines.append(f'{indent}{indent}{indent}{indent}<LEI>{report_submitting_entity_lei}</LEI>')
                    lines.append(f'{indent}{indent}{indent}</RptSubmitgNtty>')

                if trade_repository_lei:
                    lines.append(f'{indent}{indent}{indent}<TradRpstry>')
                    lines.append(f'{indent}{indent}{indent}{indent}<LEI>{trade_repository_lei}</LEI>')
                    lines.append(f'{indent}{indent}{indent}</TradRpstry>')

                lines.append(f'{indent}{indent}</RptHdr>')

            # Process each row as a transaction
            for idx, row in data.iterrows():
                lines.append(f'{indent}{indent}<{row_element}>')

                for col_name, value in row.items():
                    # Sanitize column name for XML tag
                    safe_col_name = str(col_name).replace(' ', '_').replace('-', '_')
                    safe_col_name = ''.join(c for c in safe_col_name if c.isalnum() or c == '_')
                    if not safe_col_name or not safe_col_name[0].isalpha():
                        safe_col_name = 'field_' + safe_col_name

                    # Skip null/None values
                    if pd.isna(value) or value is None:
                        continue
                    elif isinstance(value, (pd.Timestamp, datetime)):
                        escaped = ArtifactGenerator._escape_xml(value.isoformat())
                        lines.append(f'{indent}{indent}{indent}<{safe_col_name}>{escaped}</{safe_col_name}>')
                    else:
                        escaped = ArtifactGenerator._escape_xml(str(value))
                        lines.append(f'{indent}{indent}{indent}<{safe_col_name}>{escaped}</{safe_col_name}>')

                lines.append(f'{indent}{indent}</{row_element}>')

            # Close message wrapper and document
            lines.append(f'{indent}</{message_wrapper}>')
            lines.append('</Document>')
        else:
            # Standard flat XML without header
            lines.append(f'<{root_name}>')

            # Process each row
            for idx, row in data.iterrows():
                lines.append(f'{indent}<{row_name}>')

                for col_name, value in row.items():
                    # Sanitize column name for XML tag
                    safe_col_name = str(col_name).replace(' ', '_').replace('-', '_')
                    safe_col_name = ''.join(c for c in safe_col_name if c.isalnum() or c == '_')
                    if not safe_col_name or not safe_col_name[0].isalpha():
                        safe_col_name = 'field_' + safe_col_name

                    # Skip null/None values
                    if pd.isna(value) or value is None:
                        continue
                    elif isinstance(value, (pd.Timestamp, datetime)):
                        escaped = ArtifactGenerator._escape_xml(value.isoformat())
                        lines.append(f'{indent}{indent}<{safe_col_name}>{escaped}</{safe_col_name}>')
                    else:
                        escaped = ArtifactGenerator._escape_xml(str(value))
                        lines.append(f'{indent}{indent}<{safe_col_name}>{escaped}</{safe_col_name}>')

                lines.append(f'{indent}</{row_name}>')

            # Close root
            lines.append(f'</{root_name}>')

        return newline.join(lines)

    @staticmethod
    def generate_txt(
        data: pd.DataFrame,
        filepath: str,
        delimiter: str = '\t',
        include_header: bool = True,
        encoding: str = 'utf-8',
        line_ending: str = 'lf',
        columns: Optional[List[Dict[str, Any]]] = None,
        record_length: Optional[int] = None,
        column_headers: Optional[List[str]] = None,
        compress: bool = False
    ) -> Dict[str, Any]:
        """
        Generate plain text artifact from DataFrame.

        Args:
            data: DataFrame to export
            filepath: Output file path
            delimiter: Column delimiter (tab, pipe, etc.) - ignored if columns specified
            include_header: Whether to include column headers
            encoding: File encoding
            line_ending: Line ending style - 'lf' (Unix) or 'crlf' (Windows)
            columns: Fixed-width column specs [{field, start_position, length, padding, padding_char}]
            record_length: Total record length for fixed-width format
            column_headers: Optional custom column header names
            compress: Whether to gzip compress

        Returns:
            Dict with metadata
        """
        try:
            logger.info(f"Generating TXT artifact: {filepath}")

            line_terminator = '\r\n' if line_ending == 'crlf' else '\n'
            lines = []

            # Fixed-width format
            if columns:
                # Build header if requested (using field names or custom headers)
                if include_header:
                    header_parts = []
                    for i, col_spec in enumerate(columns):
                        field = col_spec.get('field', '')
                        length = col_spec.get('length', 20)
                        padding = col_spec.get('padding', 'right')
                        padding_char = col_spec.get('padding_char', ' ')

                        # Use custom header if provided
                        header_name = column_headers[i] if column_headers and i < len(column_headers) else field

                        if padding == 'left':
                            header_parts.append(str(header_name).rjust(length, padding_char)[:length])
                        else:
                            header_parts.append(str(header_name).ljust(length, padding_char)[:length])
                    lines.append(''.join(header_parts))

                # Build data rows
                for _, row in data.iterrows():
                    row_parts = []
                    for col_spec in columns:
                        field = col_spec.get('field', '')
                        length = col_spec.get('length', 20)
                        padding = col_spec.get('padding', 'right')
                        padding_char = col_spec.get('padding_char', ' ')

                        value = row.get(field, '') if field in row.index else ''
                        value_str = '' if pd.isna(value) else str(value)

                        if padding == 'left':
                            row_parts.append(value_str.rjust(length, padding_char)[:length])
                        else:
                            row_parts.append(value_str.ljust(length, padding_char)[:length])

                    row_text = ''.join(row_parts)
                    # Pad to record_length if specified
                    if record_length and len(row_text) < record_length:
                        row_text = row_text.ljust(record_length)
                    lines.append(row_text)

            else:
                # Delimited format
                # Add header if requested
                if include_header:
                    if column_headers and len(column_headers) == len(data.columns):
                        header = delimiter.join(str(h) for h in column_headers)
                    else:
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
                f.write(line_terminator.join(lines))
            
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

    @staticmethod
    def resolve_filename_template(
        template: str,
        job_run_id: str,
        report_name: str = '',
        parameters: Optional[Dict[str, Any]] = None,
        sequence: int = 1,
        output_format: str = ''
    ) -> str:
        """
        Resolve filename template with variable substitution.

        Supported variables:
        - {report_name} - Report name (sanitized)
        - {business_date} - From parameters or current date (YYYYMMDD)
        - {sequence} - Batch sequence number (001, 002, etc.)
        - {job_run_id} - First 8 chars of job run ID
        - {timestamp} - ISO timestamp (YYYYMMDD_HHMMSS)
        - Any parameter from the job run (e.g., {business_date_from})

        Args:
            template: Filename template string
            job_run_id: Unique job run identifier
            report_name: Name of the report
            parameters: Run parameters (may contain business_date, business_date_from, etc.)
            sequence: Batch sequence number for split files
            output_format: File extension to append

        Returns:
            Resolved filename with extension
        """
        if not template:
            template = "report_{job_run_id}"

        params = parameters or {}

        # Helper to format date values for filename
        def format_date_for_filename(value):
            if value is None:
                return datetime.utcnow().strftime('%Y%m%d')
            if isinstance(value, datetime):
                return value.strftime('%Y%m%d')
            if hasattr(value, 'strftime'):
                return value.strftime('%Y%m%d')
            if isinstance(value, str):
                # Try to parse and reformat
                try:
                    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    return parsed.strftime('%Y%m%d')
                except (ValueError, TypeError):
                    return value.replace('-', '')[:8]
            return str(value)

        # Get business_date from parameters (try multiple common names)
        business_date = (
            params.get('business_date') or
            params.get('business_date_from') or
            params.get('report_date')
        )
        business_date = format_date_for_filename(business_date)

        # Build timestamp
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')

        # Sanitize report name for filesystem
        safe_report_name = ''.join(
            c if c.isalnum() or c in '-_' else '_'
            for c in (report_name or 'report')
        )

        # Build format variables starting with standard ones
        format_vars = {
            'report_name': safe_report_name,
            'business_date': business_date,
            'sequence': f"{sequence:03d}",
            'job_run_id': job_run_id[:8] if job_run_id else 'unknown',
            'timestamp': timestamp
        }

        # Add all parameters with formatted date values
        for param_name, param_value in params.items():
            if param_name not in format_vars:
                # Format date-like parameters
                if 'date' in param_name.lower() or param_name.endswith('_dt'):
                    format_vars[param_name] = format_date_for_filename(param_value)
                else:
                    # Sanitize other values for filenames
                    safe_value = ''.join(
                        c if c.isalnum() or c in '-_' else '_'
                        for c in str(param_value)
                    )
                    format_vars[param_name] = safe_value

        try:
            filename = template.format(**format_vars)
        except KeyError as e:
            # If template has unknown placeholders, fall back to safe default
            logger.warning(f"Unknown placeholder in filename template '{template}': {e}. Using default.")
            filename = f"report_{job_run_id[:8] if job_run_id else 'unknown'}"

        # Add extension if provided and not already present
        if output_format:
            if not filename.endswith(f'.{output_format}'):
                filename = f"{filename}.{output_format}"

        logger.info(f"Resolved filename template '{template}' -> '{filename}'")
        return filename

    @staticmethod
    def split_into_batches(
        data: pd.DataFrame,
        max_records: Optional[int] = None
    ) -> List[pd.DataFrame]:
        """
        Split DataFrame into batches by record count.

        Args:
            data: DataFrame to split
            max_records: Maximum records per batch (None = no splitting)

        Returns:
            List of DataFrames (single item if no splitting needed)
        """
        if not max_records or max_records <= 0 or len(data) <= max_records:
            return [data]

        batches = []
        for i in range(0, len(data), max_records):
            batch = data.iloc[i:i + max_records].copy()
            batches.append(batch)

        logger.info(f"Split {len(data)} records into {len(batches)} batches of max {max_records} records")
        return batches
