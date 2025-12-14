"""
XBRL Taxonomy Parser Service

Parses XBRL taxonomy packages (ZIP files) and extracts:
- Concepts (elements) with types and attributes
- Dimensions (explicit and typed)
- Linkbases (presentation, calculation, definition, label, reference)
"""

import zipfile
import io
import re
from typing import Dict, List, Optional, Any, Tuple
from xml.etree import ElementTree as ET
from dataclasses import dataclass, field, asdict
from pathlib import Path


# XBRL namespaces
NAMESPACES = {
    'xs': 'http://www.w3.org/2001/XMLSchema',
    'xbrli': 'http://www.xbrl.org/2003/instance',
    'link': 'http://www.xbrl.org/2003/linkbase',
    'xlink': 'http://www.w3.org/1999/xlink',
    'xl': 'http://www.xbrl.org/2003/XLink',
    'xbrldt': 'http://xbrl.org/2005/xbrldt',
    'xbrldi': 'http://xbrl.org/2006/xbrldi',
    'iso4217': 'http://www.xbrl.org/2003/iso4217',
    'label': 'http://www.xbrl.org/2003/label',
    'reference': 'http://www.xbrl.org/2003/reference',
}


@dataclass
class Concept:
    """XBRL Concept (element) definition"""
    name: str
    id: str
    element_type: str
    period_type: Optional[str] = None  # instant | duration
    balance: Optional[str] = None      # debit | credit
    abstract: bool = False
    nillable: bool = True
    substitution_group: str = "xbrli:item"
    namespace: str = ""
    documentation: str = ""


@dataclass
class Dimension:
    """XBRL Dimension definition"""
    name: str
    id: str
    dimension_type: str = "explicit"  # explicit | typed
    domain: Optional[str] = None
    members: List[str] = field(default_factory=list)
    default_member: Optional[str] = None
    namespace: str = ""


@dataclass
class LabelEntry:
    """Label for a concept in a specific language/role"""
    concept_id: str
    language: str
    role: str
    text: str


@dataclass
class CalculationArc:
    """Calculation relationship between concepts"""
    parent: str
    child: str
    weight: float
    order: float = 0


@dataclass
class PresentationArc:
    """Presentation hierarchy relationship"""
    parent: str
    child: str
    order: float = 0
    preferred_label: Optional[str] = None


@dataclass
class ParsedTaxonomy:
    """Complete parsed XBRL taxonomy"""
    namespace: str
    entry_point_uri: str
    concepts: List[Concept] = field(default_factory=list)
    dimensions: List[Dimension] = field(default_factory=list)
    presentation_linkbase: Dict[str, Any] = field(default_factory=dict)
    calculation_linkbase: Dict[str, Any] = field(default_factory=dict)
    definition_linkbase: Dict[str, Any] = field(default_factory=dict)
    label_linkbase: Dict[str, Dict[str, str]] = field(default_factory=dict)
    reference_linkbase: Dict[str, List[Dict]] = field(default_factory=dict)
    raw_files: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSONB storage"""
        return {
            'namespace': self.namespace,
            'entry_point_uri': self.entry_point_uri,
            'concepts': [asdict(c) for c in self.concepts],
            'dimensions': [asdict(d) for d in self.dimensions],
            'presentation_linkbase': self.presentation_linkbase,
            'calculation_linkbase': self.calculation_linkbase,
            'definition_linkbase': self.definition_linkbase,
            'label_linkbase': self.label_linkbase,
            'reference_linkbase': self.reference_linkbase,
        }


class XBRLTaxonomyParser:
    """Parse XBRL taxonomy ZIP files"""
    
    def __init__(self):
        self.concepts: Dict[str, Concept] = {}
        self.dimensions: Dict[str, Dimension] = {}
        self.labels: Dict[str, Dict[str, str]] = {}
        self.references: Dict[str, List[Dict]] = {}
        self.presentation: Dict[str, Dict] = {}
        self.calculation: Dict[str, Dict] = {}
        self.definition: Dict[str, Dict] = {}
        
    def parse(self, zip_data: bytes, entry_point: Optional[str] = None) -> ParsedTaxonomy:
        """
        Parse XBRL taxonomy from ZIP file.
        
        Args:
            zip_data: Binary content of the taxonomy ZIP
            entry_point: Optional entry point XSD filename (auto-detected if not provided)
            
        Returns:
            ParsedTaxonomy with all extracted components
        """
        with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zf:
            file_list = zf.namelist()
            
            # Find entry point (main .xsd file)
            if not entry_point:
                entry_point = self._find_entry_point(file_list)
            
            # Read all files
            files = {}
            for filename in file_list:
                if filename.endswith(('.xsd', '.xml')):
                    try:
                        content = zf.read(filename).decode('utf-8')
                        files[filename] = content
                    except Exception:
                        pass
            
            # Parse schema files
            namespace = ""
            for filename, content in files.items():
                if filename.endswith('.xsd'):
                    ns = self._parse_schema(filename, content)
                    if ns and not namespace:
                        namespace = ns
            
            # Parse linkbase files
            for filename, content in files.items():
                if 'presentation' in filename.lower() or '-pre-' in filename.lower():
                    self._parse_presentation_linkbase(content)
                elif 'calculation' in filename.lower() or '-cal-' in filename.lower():
                    self._parse_calculation_linkbase(content)
                elif 'definition' in filename.lower() or '-def-' in filename.lower():
                    self._parse_definition_linkbase(content)
                elif 'label' in filename.lower() or '-lab-' in filename.lower():
                    self._parse_label_linkbase(content)
                elif 'reference' in filename.lower() or '-ref-' in filename.lower():
                    self._parse_reference_linkbase(content)
            
            return ParsedTaxonomy(
                namespace=namespace,
                entry_point_uri=entry_point,
                concepts=list(self.concepts.values()),
                dimensions=list(self.dimensions.values()),
                presentation_linkbase=self.presentation,
                calculation_linkbase=self.calculation,
                definition_linkbase=self.definition,
                label_linkbase=self.labels,
                reference_linkbase=self.references,
                raw_files={k: v[:10000] for k, v in files.items()}  # Truncate for storage
            )
    
    def _find_entry_point(self, file_list: List[str]) -> str:
        """Find the main XSD entry point"""
        # Look for common patterns
        for filename in file_list:
            lower = filename.lower()
            if any(p in lower for p in ['_entry', 'entrypoint', '-full-', '_full']):
                if filename.endswith('.xsd'):
                    return filename
        
        # Fall back to first XSD in root
        root_xsds = [f for f in file_list if f.endswith('.xsd') and '/' not in f]
        if root_xsds:
            return root_xsds[0]
        
        # Any XSD
        xsds = [f for f in file_list if f.endswith('.xsd')]
        return xsds[0] if xsds else ""
    
    def _parse_schema(self, filename: str, content: str) -> Optional[str]:
        """Parse XSD schema file for concepts and dimensions"""
        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            return None
        
        # Get target namespace
        namespace = root.get('targetNamespace', '')
        
        # Parse elements (concepts)
        for elem in root.findall('.//xs:element', NAMESPACES):
            concept = self._parse_element(elem, namespace)
            if concept:
                self.concepts[concept.id] = concept
                
                # Check if it's a dimension
                if elem.get(f"{{{NAMESPACES['xbrldt']}}}typedDomainRef"):
                    self.dimensions[concept.id] = Dimension(
                        name=concept.name,
                        id=concept.id,
                        dimension_type="typed",
                        namespace=namespace
                    )
                elif self._is_dimension(elem):
                    self.dimensions[concept.id] = Dimension(
                        name=concept.name,
                        id=concept.id,
                        dimension_type="explicit",
                        namespace=namespace
                    )
        
        return namespace
    
    def _parse_element(self, elem: ET.Element, namespace: str) -> Optional[Concept]:
        """Parse single element definition"""
        name = elem.get('name')
        if not name:
            return None
        
        element_id = elem.get('id', name)
        element_type = elem.get('type', 'string')
        
        # Get XBRL-specific attributes
        substitution_group = elem.get('substitutionGroup', 'xbrli:item')
        period_type = elem.get(f"{{{NAMESPACES['xbrli']}}}periodType")
        balance = elem.get(f"{{{NAMESPACES['xbrli']}}}balance")
        abstract = elem.get('abstract', 'false').lower() == 'true'
        nillable = elem.get('nillable', 'true').lower() == 'true'
        
        # Get documentation/annotation
        doc = ""
        annotation = elem.find('xs:annotation/xs:documentation', NAMESPACES)
        if annotation is not None and annotation.text:
            doc = annotation.text.strip()
        
        return Concept(
            name=name,
            id=element_id,
            element_type=element_type,
            period_type=period_type,
            balance=balance,
            abstract=abstract,
            nillable=nillable,
            substitution_group=substitution_group,
            namespace=namespace,
            documentation=doc
        )
    
    def _is_dimension(self, elem: ET.Element) -> bool:
        """Check if element is a dimension"""
        sub_group = elem.get('substitutionGroup', '')
        return 'DimensionItem' in sub_group or 'dimensionItem' in sub_group
    
    def _parse_presentation_linkbase(self, content: str):
        """Parse presentation linkbase for hierarchy"""
        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            return
        
        for link in root.findall('.//link:presentationLink', NAMESPACES):
            role = link.get(f"{{{NAMESPACES['xlink']}}}role", 'default')
            
            # Build locator map
            locators = {}
            for loc in link.findall('link:loc', NAMESPACES):
                label = loc.get(f"{{{NAMESPACES['xlink']}}}label", '')
                href = loc.get(f"{{{NAMESPACES['xlink']}}}href", '')
                # Extract concept name from href
                if '#' in href:
                    concept_id = href.split('#')[-1]
                    locators[label] = concept_id
            
            # Parse arcs
            hierarchy = {}
            for arc in link.findall('link:presentationArc', NAMESPACES):
                from_label = arc.get(f"{{{NAMESPACES['xlink']}}}from", '')
                to_label = arc.get(f"{{{NAMESPACES['xlink']}}}to", '')
                order = float(arc.get('order', '0'))
                
                from_concept = locators.get(from_label, from_label)
                to_concept = locators.get(to_label, to_label)
                
                if from_concept not in hierarchy:
                    hierarchy[from_concept] = []
                hierarchy[from_concept].append({
                    'concept': to_concept,
                    'order': order
                })
            
            # Sort children by order
            for parent in hierarchy:
                hierarchy[parent] = sorted(hierarchy[parent], key=lambda x: x['order'])
            
            self.presentation[role] = hierarchy
    
    def _parse_calculation_linkbase(self, content: str):
        """Parse calculation linkbase for summation relationships"""
        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            return
        
        for link in root.findall('.//link:calculationLink', NAMESPACES):
            role = link.get(f"{{{NAMESPACES['xlink']}}}role", 'default')
            
            # Build locator map
            locators = {}
            for loc in link.findall('link:loc', NAMESPACES):
                label = loc.get(f"{{{NAMESPACES['xlink']}}}label", '')
                href = loc.get(f"{{{NAMESPACES['xlink']}}}href", '')
                if '#' in href:
                    concept_id = href.split('#')[-1]
                    locators[label] = concept_id
            
            # Parse arcs
            calculations = {}
            for arc in link.findall('link:calculationArc', NAMESPACES):
                from_label = arc.get(f"{{{NAMESPACES['xlink']}}}from", '')
                to_label = arc.get(f"{{{NAMESPACES['xlink']}}}to", '')
                weight = float(arc.get('weight', '1'))
                order = float(arc.get('order', '0'))
                
                from_concept = locators.get(from_label, from_label)
                to_concept = locators.get(to_label, to_label)
                
                if from_concept not in calculations:
                    calculations[from_concept] = []
                calculations[from_concept].append({
                    'concept': to_concept,
                    'weight': weight,
                    'order': order
                })
            
            self.calculation[role] = calculations
    
    def _parse_definition_linkbase(self, content: str):
        """Parse definition linkbase for dimensional relationships"""
        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            return
        
        for link in root.findall('.//link:definitionLink', NAMESPACES):
            role = link.get(f"{{{NAMESPACES['xlink']}}}role", 'default')
            
            # Build locator map
            locators = {}
            for loc in link.findall('link:loc', NAMESPACES):
                label = loc.get(f"{{{NAMESPACES['xlink']}}}label", '')
                href = loc.get(f"{{{NAMESPACES['xlink']}}}href", '')
                if '#' in href:
                    concept_id = href.split('#')[-1]
                    locators[label] = concept_id
            
            # Parse arcs (dimension-default, hypercube-dimension, dimension-domain, etc.)
            definitions = {}
            for arc in link.findall('link:definitionArc', NAMESPACES):
                arcrole = arc.get(f"{{{NAMESPACES['xlink']}}}arcrole", '')
                from_label = arc.get(f"{{{NAMESPACES['xlink']}}}from", '')
                to_label = arc.get(f"{{{NAMESPACES['xlink']}}}to", '')
                
                from_concept = locators.get(from_label, from_label)
                to_concept = locators.get(to_label, to_label)
                
                # Categorize by arcrole
                arcrole_name = arcrole.split('/')[-1] if '/' in arcrole else arcrole
                
                if arcrole_name not in definitions:
                    definitions[arcrole_name] = {}
                if from_concept not in definitions[arcrole_name]:
                    definitions[arcrole_name][from_concept] = []
                definitions[arcrole_name][from_concept].append(to_concept)
                
                # Update dimension members
                if 'dimension-domain' in arcrole.lower() or 'domain-member' in arcrole.lower():
                    if from_concept in self.dimensions:
                        self.dimensions[from_concept].members.append(to_concept)
                    if to_concept in self.dimensions:
                        self.dimensions[to_concept].members.append(from_concept)
            
            self.definition[role] = definitions
    
    def _parse_label_linkbase(self, content: str):
        """Parse label linkbase for human-readable labels"""
        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            return
        
        for link in root.findall('.//link:labelLink', NAMESPACES):
            # Build locator map
            locators = {}
            for loc in link.findall('link:loc', NAMESPACES):
                label = loc.get(f"{{{NAMESPACES['xlink']}}}label", '')
                href = loc.get(f"{{{NAMESPACES['xlink']}}}href", '')
                if '#' in href:
                    concept_id = href.split('#')[-1]
                    locators[label] = concept_id
            
            # Build label map
            labels = {}
            for lab in link.findall('link:label', NAMESPACES):
                label_id = lab.get(f"{{{NAMESPACES['xlink']}}}label", '')
                lang = lab.get(f"{{{NAMESPACES['xml']}}}lang", 'en') or lab.get('lang', 'en')
                role = lab.get(f"{{{NAMESPACES['xlink']}}}role", 'standard')
                text = lab.text or ''
                labels[label_id] = {'lang': lang, 'role': role, 'text': text.strip()}
            
            # Link concepts to labels via arcs
            for arc in link.findall('link:labelArc', NAMESPACES):
                from_label = arc.get(f"{{{NAMESPACES['xlink']}}}from", '')
                to_label = arc.get(f"{{{NAMESPACES['xlink']}}}to", '')
                
                concept_id = locators.get(from_label, from_label)
                label_info = labels.get(to_label, {})
                
                if concept_id and label_info:
                    if concept_id not in self.labels:
                        self.labels[concept_id] = {}
                    lang = label_info.get('lang', 'en')
                    self.labels[concept_id][lang] = label_info.get('text', '')
    
    def _parse_reference_linkbase(self, content: str):
        """Parse reference linkbase for authoritative references"""
        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            return
        
        for link in root.findall('.//link:referenceLink', NAMESPACES):
            # Build locator map
            locators = {}
            for loc in link.findall('link:loc', NAMESPACES):
                label = loc.get(f"{{{NAMESPACES['xlink']}}}label", '')
                href = loc.get(f"{{{NAMESPACES['xlink']}}}href", '')
                if '#' in href:
                    concept_id = href.split('#')[-1]
                    locators[label] = concept_id
            
            # Build reference map
            references = {}
            for ref in link.findall('link:reference', NAMESPACES):
                ref_id = ref.get(f"{{{NAMESPACES['xlink']}}}label", '')
                ref_data = {}
                for child in ref:
                    tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                    ref_data[tag] = child.text
                references[ref_id] = ref_data
            
            # Link concepts to references via arcs
            for arc in link.findall('link:referenceArc', NAMESPACES):
                from_label = arc.get(f"{{{NAMESPACES['xlink']}}}from", '')
                to_label = arc.get(f"{{{NAMESPACES['xlink']}}}to", '')
                
                concept_id = locators.get(from_label, from_label)
                ref_info = references.get(to_label, {})
                
                if concept_id and ref_info:
                    if concept_id not in self.references:
                        self.references[concept_id] = []
                    self.references[concept_id].append(ref_info)


def parse_xbrl_taxonomy(zip_data: bytes, entry_point: Optional[str] = None) -> ParsedTaxonomy:
    """
    Convenience function to parse XBRL taxonomy.
    
    Args:
        zip_data: Binary content of taxonomy ZIP file
        entry_point: Optional entry point XSD filename
        
    Returns:
        ParsedTaxonomy object
    """
    parser = XBRLTaxonomyParser()
    return parser.parse(zip_data, entry_point)
