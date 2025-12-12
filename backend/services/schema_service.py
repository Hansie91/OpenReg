"""
Schema Service - XSD Parsing and Validation

Provides utilities for parsing XSD schemas, extracting element structures,
and validating XML documents against schemas.
"""

from lxml import etree
from typing import Optional
import re


# XSD Namespace
XS_NS = "{http://www.w3.org/2001/XMLSchema}"


class SchemaElement:
    """Represents a parsed XSD element with its metadata"""
    
    def __init__(
        self,
        name: str,
        xpath: str,
        element_type: str = "string",
        required: bool = False,
        min_occurs: int = 1,
        max_occurs: int = 1,  # -1 means unbounded
        documentation: str = "",
        enumerations: list[str] = None,
        children: list = None,
        attributes: list = None,
        is_repeating: bool = False,
        parent_xpath: str = ""
    ):
        self.name = name
        self.xpath = xpath
        self.element_type = element_type
        self.required = required
        self.min_occurs = min_occurs
        self.max_occurs = max_occurs
        self.documentation = documentation
        self.enumerations = enumerations or []
        self.children = children or []
        self.attributes = attributes or []
        self.is_repeating = is_repeating or max_occurs != 1
        self.parent_xpath = parent_xpath
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "xpath": self.xpath,
            "type": self.element_type,
            "required": self.required,
            "min_occurs": self.min_occurs,
            "max_occurs": self.max_occurs,
            "documentation": self.documentation,
            "enumerations": self.enumerations,
            "children": [c.to_dict() for c in self.children],
            "attributes": self.attributes,
            "is_repeating": self.is_repeating,
            "parent_xpath": self.parent_xpath
        }


class XSDParser:
    """
    Parser for XSD (XML Schema Definition) files.
    Extracts element structure, types, constraints, and documentation.
    Supports complex nested structures, sequences, choices, and extensions.
    """
    
    def __init__(self, xsd_content: str):
        self.xsd_content = xsd_content
        self.root = etree.fromstring(xsd_content.encode('utf-8'))
        self.target_namespace = self.root.get("targetNamespace", "")
        self.type_definitions = {}
        self.element_definitions = {}
        self._cache_definitions()
    
    def _cache_definitions(self):
        """Cache all type and element definitions for reference resolution"""
        # Cache complexTypes
        for complex_type in self.root.iter(f"{XS_NS}complexType"):
            name = complex_type.get("name")
            if name:
                self.type_definitions[name] = complex_type
        
        # Cache simpleTypes
        for simple_type in self.root.iter(f"{XS_NS}simpleType"):
            name = simple_type.get("name")
            if name:
                self.type_definitions[name] = simple_type
        
        # Cache global elements
        for element in self.root.findall(f"{XS_NS}element"):
            name = element.get("name")
            if name:
                self.element_definitions[name] = element
    
    def parse(self) -> dict:
        """
        Parse the XSD and return structured element information.
        
        Returns:
            dict with keys:
                - root_element: name of the root element
                - namespace: target namespace
                - elements: list of SchemaElement dicts (hierarchical)
                - flat_elements: flattened list for mapping UI
        """
        root_elements = []
        flat_elements = []
        
        # Find root-level element definitions
        for element in self.root.findall(f"{XS_NS}element"):
            name = element.get("name")
            if name:
                parsed = self._parse_element(element, f"/{name}", "")
                root_elements.append(parsed)
                flat_elements.extend(self._flatten_elements(parsed))
        
        return {
            "root_element": root_elements[0].name if root_elements else None,
            "namespace": self.target_namespace,
            "elements": [e.to_dict() for e in root_elements],
            "flat_elements": [e.to_dict() for e in flat_elements]
        }
    
    def _parse_element(
        self, 
        element: etree._Element, 
        xpath: str,
        parent_xpath: str
    ) -> SchemaElement:
        """Parse a single element definition"""
        name = element.get("name", "")
        element_type = element.get("type", "")
        min_occurs = int(element.get("minOccurs", 1))
        max_occurs_str = element.get("maxOccurs", "1")
        max_occurs = -1 if max_occurs_str == "unbounded" else int(max_occurs_str)
        required = min_occurs > 0
        
        # Get documentation
        documentation = self._get_documentation(element)
        
        # Resolve type
        resolved_type, enumerations = self._resolve_type(element, element_type)
        
        # Parse child elements
        children = []
        attributes = []
        
        # Check for inline complexType
        inline_complex = element.find(f"{XS_NS}complexType")
        if inline_complex is not None:
            children, attributes = self._parse_complex_type(inline_complex, xpath)
        elif element_type and element_type in self.type_definitions:
            # Reference to named type
            type_def = self.type_definitions[element_type]
            if type_def.tag == f"{XS_NS}complexType":
                children, attributes = self._parse_complex_type(type_def, xpath)
        elif element_type:
            # Try stripping namespace prefix
            type_name = element_type.split(":")[-1]
            if type_name in self.type_definitions:
                type_def = self.type_definitions[type_name]
                if type_def.tag == f"{XS_NS}complexType":
                    children, attributes = self._parse_complex_type(type_def, xpath)
        
        return SchemaElement(
            name=name,
            xpath=xpath,
            element_type=resolved_type,
            required=required,
            min_occurs=min_occurs,
            max_occurs=max_occurs,
            documentation=documentation,
            enumerations=enumerations,
            children=children,
            attributes=attributes,
            is_repeating=max_occurs != 1,
            parent_xpath=parent_xpath
        )
    
    def _parse_complex_type(
        self, 
        complex_type: etree._Element, 
        parent_xpath: str
    ) -> tuple[list, list]:
        """Parse a complexType definition, returning children and attributes"""
        children = []
        attributes = []
        
        # Handle extension
        complex_content = complex_type.find(f"{XS_NS}complexContent")
        if complex_content is not None:
            extension = complex_content.find(f"{XS_NS}extension")
            if extension is not None:
                base_type = extension.get("base", "").split(":")[-1]
                if base_type in self.type_definitions:
                    base_children, base_attrs = self._parse_complex_type(
                        self.type_definitions[base_type], parent_xpath
                    )
                    children.extend(base_children)
                    attributes.extend(base_attrs)
                # Parse extension's own elements
                ext_children, ext_attrs = self._parse_sequence_or_choice(extension, parent_xpath)
                children.extend(ext_children)
                attributes.extend(ext_attrs)
        else:
            # Parse direct sequence/choice/all
            direct_children, direct_attrs = self._parse_sequence_or_choice(complex_type, parent_xpath)
            children.extend(direct_children)
            attributes.extend(direct_attrs)
        
        # Parse attributes
        for attr in complex_type.iter(f"{XS_NS}attribute"):
            attr_name = attr.get("name", "")
            attr_type = attr.get("type", "string").split(":")[-1]
            attr_required = attr.get("use") == "required"
            attributes.append({
                "name": attr_name,
                "type": attr_type,
                "required": attr_required,
                "xpath": f"{parent_xpath}/@{attr_name}"
            })
        
        return children, attributes
    
    def _parse_sequence_or_choice(
        self, 
        parent: etree._Element, 
        parent_xpath: str
    ) -> tuple[list, list]:
        """Parse sequence, choice, or all containers"""
        children = []
        attributes = []
        
        for container_tag in ["sequence", "choice", "all"]:
            for container in parent.iter(f"{XS_NS}{container_tag}"):
                for child_elem in container.findall(f"{XS_NS}element"):
                    child_name = child_elem.get("name")
                    ref = child_elem.get("ref")
                    
                    if ref:
                        # Reference to global element
                        ref_name = ref.split(":")[-1]
                        if ref_name in self.element_definitions:
                            child_xpath = f"{parent_xpath}/{ref_name}"
                            parsed = self._parse_element(
                                self.element_definitions[ref_name], 
                                child_xpath,
                                parent_xpath
                            )
                            # Apply local minOccurs/maxOccurs
                            parsed.min_occurs = int(child_elem.get("minOccurs", parsed.min_occurs))
                            max_str = child_elem.get("maxOccurs")
                            if max_str:
                                parsed.max_occurs = -1 if max_str == "unbounded" else int(max_str)
                            parsed.is_repeating = parsed.max_occurs != 1
                            children.append(parsed)
                    elif child_name:
                        child_xpath = f"{parent_xpath}/{child_name}"
                        children.append(self._parse_element(child_elem, child_xpath, parent_xpath))
        
        return children, attributes
    
    def _resolve_type(
        self, 
        element: etree._Element, 
        type_attr: str
    ) -> tuple[str, list[str]]:
        """Resolve element type and extract enumerations"""
        enumerations = []
        
        # Check for inline simpleType with restriction
        inline_simple = element.find(f"{XS_NS}simpleType")
        if inline_simple is not None:
            restriction = inline_simple.find(f"{XS_NS}restriction")
            if restriction is not None:
                base = restriction.get("base", "string").split(":")[-1]
                for enum in restriction.findall(f"{XS_NS}enumeration"):
                    enumerations.append(enum.get("value", ""))
                return base, enumerations
        
        # Handle named type reference
        if type_attr:
            type_name = type_attr.split(":")[-1]
            
            # Check standard XSD types
            xsd_types = {
                "string": "string",
                "integer": "integer",
                "int": "integer",
                "decimal": "decimal",
                "float": "float",
                "double": "double",
                "boolean": "boolean",
                "date": "date",
                "dateTime": "datetime",
                "time": "time",
                "positiveInteger": "integer",
                "nonNegativeInteger": "integer",
                "normalizedString": "string",
                "token": "string",
                "NMTOKEN": "string",
                "ID": "string",
                "IDREF": "string",
            }
            
            if type_name in xsd_types:
                return xsd_types[type_name], []
            
            # Check custom type definitions
            if type_name in self.type_definitions:
                type_def = self.type_definitions[type_name]
                if type_def.tag == f"{XS_NS}simpleType":
                    restriction = type_def.find(f"{XS_NS}restriction")
                    if restriction is not None:
                        base = restriction.get("base", "string").split(":")[-1]
                        for enum in restriction.findall(f"{XS_NS}enumeration"):
                            enumerations.append(enum.get("value", ""))
                        return base, enumerations
                return "complex", []
        
        return "string", []
    
    def _get_documentation(self, element: etree._Element) -> str:
        """Extract documentation annotation from element"""
        annotation = element.find(f"{XS_NS}annotation")
        if annotation is not None:
            doc = annotation.find(f"{XS_NS}documentation")
            if doc is not None and doc.text:
                return doc.text.strip()
        return ""
    
    def _flatten_elements(self, element: SchemaElement, depth: int = 0) -> list:
        """Flatten hierarchical elements for mapping UI"""
        flat = []
        
        # Add current element if it's a leaf or repeating container
        if not element.children or element.is_repeating:
            element_copy = SchemaElement(
                name=element.name,
                xpath=element.xpath,
                element_type=element.element_type,
                required=element.required,
                min_occurs=element.min_occurs,
                max_occurs=element.max_occurs,
                documentation=element.documentation,
                enumerations=element.enumerations,
                children=[],  # Don't include children in flat list
                attributes=element.attributes,
                is_repeating=element.is_repeating,
                parent_xpath=element.parent_xpath
            )
            flat.append(element_copy)
        
        # Recurse into children
        for child in element.children:
            flat.extend(self._flatten_elements(child, depth + 1))
        
        return flat


def parse_xsd(xsd_content: str) -> dict:
    """
    Parse an XSD schema and extract element structure.
    
    Args:
        xsd_content: Raw XSD XML content as string
        
    Returns:
        dict with:
            - root_element: name of root element
            - namespace: target namespace
            - elements: hierarchical element structure
            - flat_elements: flattened list for mapping
    """
    parser = XSDParser(xsd_content)
    return parser.parse()


def validate_xml_against_xsd(xml_content: str, xsd_content: str) -> tuple[bool, list[str]]:
    """
    Validate an XML document against an XSD schema.
    
    Args:
        xml_content: XML document to validate
        xsd_content: XSD schema to validate against
        
    Returns:
        tuple of (is_valid: bool, errors: list[str])
    """
    try:
        xsd_doc = etree.fromstring(xsd_content.encode('utf-8'))
        schema = etree.XMLSchema(xsd_doc)
        xml_doc = etree.fromstring(xml_content.encode('utf-8'))
        
        is_valid = schema.validate(xml_doc)
        errors = [str(error) for error in schema.error_log]
        
        return is_valid, errors
    except etree.XMLSyntaxError as e:
        return False, [f"XML Syntax Error: {str(e)}"]
    except etree.XMLSchemaParseError as e:
        return False, [f"XSD Parse Error: {str(e)}"]
    except Exception as e:
        return False, [f"Validation Error: {str(e)}"]


def get_xsd_info(xsd_content: str) -> dict:
    """
    Get basic information about an XSD schema without full parsing.
    
    Returns:
        dict with target_namespace, root_element_name, element_count
    """
    try:
        root = etree.fromstring(xsd_content.encode('utf-8'))
        namespace = root.get("targetNamespace", "")
        
        # Find root elements
        root_elements = []
        for elem in root.findall(f"{XS_NS}element"):
            name = elem.get("name")
            if name:
                root_elements.append(name)
        
        # Count all elements
        element_count = len(list(root.iter(f"{XS_NS}element")))
        
        return {
            "namespace": namespace,
            "root_elements": root_elements,
            "element_count": element_count,
            "valid": True
        }
    except Exception as e:
        return {
            "valid": False,
            "error": str(e)
        }
