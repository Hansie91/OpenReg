"""
Code Generator Service

Generates Python transformation code from Simple Mode field mappings.
"""

from typing import Dict, List, Any, Optional
import textwrap


class CodeGenerator:
    """Generate Python code from declarative field mappings."""
    
    # Transform function templates
    TRANSFORM_FUNCTIONS = {
        'UPPER': 'str(value).upper() if value else ""',
        'LOWER': 'str(value).lower() if value else ""',
        'TRIM': 'str(value).strip() if value else ""',
        'DATE_ISO': 'value.isoformat() if hasattr(value, "isoformat") else str(value) if value else ""',
        'DATE_YYYYMMDD': 'value.strftime("%Y%m%d") if hasattr(value, "strftime") else str(value) if value else ""',
        'DECIMAL_2': 'f"{float(value):.2f}" if value is not None else ""',
        'DECIMAL_4': 'f"{float(value):.4f}" if value is not None else ""',
        'INTEGER': 'str(int(value)) if value is not None else ""',
        'BOOLEAN_YN': '"Y" if value else "N"',
        'BOOLEAN_TF': '"true" if value else "false"',
    }
    
    @staticmethod
    def generate_from_mappings(
        source_table: str,
        field_mappings: List[Dict[str, str]],
        output_format: str = 'xml',
        schema_id: Optional[str] = None
    ) -> str:
        """
        Generate Python transformation code from field mappings.
        
        Args:
            source_table: Qualified table name (schema.table)
            field_mappings: List of mapping dicts with sourceColumn, targetXPath, transform, defaultValue
            output_format: 'xml' or 'csv'
            schema_id: Optional schema ID for XML generation
            
        Returns:
            Python code string
        """
        # Filter out empty mappings
        valid_mappings = [m for m in field_mappings if m.get('sourceColumn') or m.get('defaultValue')]
        
        if not valid_mappings:
            return CodeGenerator._generate_empty_template()
        
        # Build the code
        code_parts = [
            '"""',
            'Auto-generated transformation code from Simple Mode mappings.',
            f'Source table: {source_table}',
            f'Output format: {output_format}',
            '"""',
            '',
            'def transform(db, mappings, params):',
            '    # Query source data',
            f'    data = query_db("SELECT * FROM {source_table}")',
            '    ',
            '    if data.empty:',
            '        log("No data found in source table")',
            '        return []',
            '    ',
            '    log(f"Processing {len(data)} rows")',
            '    ',
            '    # Transform each row',
            '    results = []',
            '    for idx, row in data.iterrows():',
            '        record = {}',
        ]
        
        # Add mapping logic for each field
        for mapping in valid_mappings:
            source_col = mapping.get('sourceColumn', '')
            target = mapping.get('targetXPath', '')
            transform = mapping.get('transform', '')
            default = mapping.get('defaultValue', '')
            
            # Generate field name from XPath (last element)
            field_name = target.split('/')[-1].replace('@', '') if target else source_col
            
            if source_col:
                # Get value from column
                code_parts.append(f'        ')
                code_parts.append(f'        # Map: {source_col} -> {target}')
                code_parts.append(f'        value = row.get("{source_col}")')
                
                # Apply transform if specified
                if transform and transform in CodeGenerator.TRANSFORM_FUNCTIONS:
                    transform_expr = CodeGenerator.TRANSFORM_FUNCTIONS[transform]
                    code_parts.append(f'        value = {transform_expr}')
                else:
                    code_parts.append(f'        value = str(value) if value is not None else ""')
                
                # Apply default if value is empty
                if default:
                    code_parts.append(f'        if not value:')
                    code_parts.append(f'            value = "{default}"')
                
                code_parts.append(f'        record["{field_name}"] = value')
            elif default:
                # Static default value only
                code_parts.append(f'        ')
                code_parts.append(f'        # Static value for: {target}')
                code_parts.append(f'        record["{field_name}"] = "{default}"')
        
        # Close the loop and return
        code_parts.extend([
            '        ',
            '        results.append(record)',
            '    ',
            '    log(f"Generated {len(results)} output records")',
            '    return results',
        ])
        
        return '\n'.join(code_parts)
    
    @staticmethod
    def _generate_empty_template() -> str:
        """Generate a template for empty/invalid mappings."""
        return textwrap.dedent('''
            """
            Report Transformation Logic
            
            No field mappings were configured. Please edit this code manually.
            
            Available context:
            - query_db(sql): Execute SQL and return DataFrame
            - get_mapping(name, value): Look up cross-reference mapping
            - log(message): Write to execution log
            - parameters: Runtime parameters dict
            """
            
            def transform(db, mappings, params):
                # Example: Query data from the connected database
                # data = query_db("SELECT * FROM my_table")
                
                # Return the transformed data as list of dicts
                return [
                    {"field1": "value1", "field2": "value2"},
                ]
        ''').strip()
