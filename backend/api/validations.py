"""Validation Rules API"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user, log_audit
import models

router = APIRouter()


# === Pydantic Models ===

class ValidationRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    rule_type: str = Field(..., description="SQL or python_expr")
    expression: str = Field(..., min_length=1, description="SQL query or Python expression")
    severity: str = Field(..., description="warning, blocking, or correctable")
    error_message: str = Field(..., min_length=1)
    is_active: bool = True


class ValidationRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    rule_type: Optional[str] = None
    expression: Optional[str] = None
    severity: Optional[str] = None
    error_message: Optional[str] = None
    is_active: Optional[bool] = None


class ValidationRuleResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    rule_type: str
    expression: str
    severity: str
    error_message: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID]

    class Config:
        from_attributes = True


class ValidationTestRequest(BaseModel):
    sample_data: dict = Field(..., description="Sample row data to test validation against")


class ValidationTestResponse(BaseModel):
    passed: bool
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None


# === API Endpoints ===

@router.get("", response_model=List[ValidationRuleResponse])
async def list_validations(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    rule_type: Optional[str] = Query(None, description="Filter by rule type (sql or python_expr)"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all validation rules for the current tenant"""
    query = db.query(models.ValidationRule).filter(
        models.ValidationRule.tenant_id == current_user.tenant_id
    )
    
    # Apply filters
    if is_active is not None:
        query = query.filter(models.ValidationRule.is_active == is_active)
    
    if rule_type:
        query = query.filter(models.ValidationRule.rule_type == rule_type)
    
    rules = query.order_by(models.ValidationRule.created_at.desc()).all()
    
    return [
        ValidationRuleResponse(
            id=rule.id,
            name=rule.name,
            description=rule.description,
            rule_type=rule.rule_type.value,
            expression=rule.expression,
            severity=rule.severity.value,
            error_message=rule.error_message,
            is_active=rule.is_active,
            created_at=rule.created_at,
            updated_at=rule.updated_at,
            created_by=rule.created_by
        )
        for rule in rules
    ]


@router.post("", response_model=ValidationRuleResponse, status_code=201)
async def create_validation(
    validation: ValidationRuleCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new validation rule"""
    # Validate rule_type
    try:
        rule_type_enum = models.ValidationRuleType(validation.rule_type.lower())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rule_type. Must be one of: {', '.join([e.value for e in models.ValidationRuleType])}"
        )
    
    # Validate severity
    try:
        severity_enum = models.ValidationSeverity(validation.severity.lower())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity. Must be one of: {', '.join([e.value for e in models.ValidationSeverity])}"
        )
    
    # Create validation rule
    new_rule = models.ValidationRule(
        tenant_id=current_user.tenant_id,
        name=validation.name,
        description=validation.description,
        rule_type=rule_type_enum,
        expression=validation.expression,
        severity=severity_enum,
        error_message=validation.error_message,
        is_active=validation.is_active,
        created_by=current_user.id
    )
    
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    log_audit(db, current_user, models.AuditAction.CREATE, "ValidationRule", str(new_rule.id),
              changes={"name": validation.name, "rule_type": validation.rule_type, "severity": validation.severity})

    return ValidationRuleResponse(
        id=new_rule.id,
        name=new_rule.name,
        description=new_rule.description,
        rule_type=new_rule.rule_type.value,
        expression=new_rule.expression,
        severity=new_rule.severity.value,
        error_message=new_rule.error_message,
        is_active=new_rule.is_active,
        created_at=new_rule.created_at,
        updated_at=new_rule.updated_at,
        created_by=new_rule.created_by
    )


@router.get("/{validation_id}", response_model=ValidationRuleResponse)
async def get_validation(
    validation_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific validation rule by ID"""
    rule = db.query(models.ValidationRule).filter(
        models.ValidationRule.id == validation_id,
        models.ValidationRule.tenant_id == current_user.tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Validation rule not found")
    
    return ValidationRuleResponse(
        id=rule.id,
        name=rule.name,
        description=rule.description,
        rule_type=rule.rule_type.value,
        expression=rule.expression,
        severity=rule.severity.value,
        error_message=rule.error_message,
        is_active=rule.is_active,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
        created_by=rule.created_by
    )


@router.put("/{validation_id}", response_model=ValidationRuleResponse)
async def update_validation(
    validation_id: UUID,
    validation_update: ValidationRuleUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing validation rule"""
    rule = db.query(models.ValidationRule).filter(
        models.ValidationRule.id == validation_id,
        models.ValidationRule.tenant_id == current_user.tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Validation rule not found")
    
    # Update fields if provided
    if validation_update.name is not None:
        rule.name = validation_update.name
    
    if validation_update.description is not None:
        rule.description = validation_update.description
    
    if validation_update.rule_type is not None:
        try:
            rule.rule_type = models.ValidationRuleType(validation_update.rule_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid rule_type. Must be one of: {', '.join([e.value for e in models.ValidationRuleType])}"
            )
    
    if validation_update.expression is not None:
        rule.expression = validation_update.expression
    
    if validation_update.severity is not None:
        try:
            rule.severity = models.ValidationSeverity(validation_update.severity.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid severity. Must be one of: {', '.join([e.value for e in models.ValidationSeverity])}"
            )
    
    if validation_update.error_message is not None:
        rule.error_message = validation_update.error_message
    
    if validation_update.is_active is not None:
        rule.is_active = validation_update.is_active
    
    db.commit()
    db.refresh(rule)

    update_data = validation_update.model_dump(exclude_unset=True)
    # Log expression presence but not content for security
    changes = {k: v for k, v in update_data.items() if v is not None and k != "expression"}
    if "expression" in update_data and update_data["expression"] is not None:
        changes["expression"] = "updated"
    log_audit(db, current_user, models.AuditAction.UPDATE, "ValidationRule", str(rule.id),
              changes=changes)

    return ValidationRuleResponse(
        id=rule.id,
        name=rule.name,
        description=rule.description,
        rule_type=rule.rule_type.value,
        expression=rule.expression,
        severity=rule.severity.value,
        error_message=rule.error_message,
        is_active=rule.is_active,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
        created_by=rule.created_by
    )


@router.delete("/{validation_id}", status_code=204)
async def delete_validation(
    validation_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a validation rule (soft delete by marking inactive)"""
    rule = db.query(models.ValidationRule).filter(
        models.ValidationRule.id == validation_id,
        models.ValidationRule.tenant_id == current_user.tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Validation rule not found")

    log_audit(db, current_user, models.AuditAction.DELETE, "ValidationRule", str(rule.id),
              changes={"is_active": False, "action": "soft_delete"})

    # Soft delete by marking as inactive
    rule.is_active = False
    db.commit()

    return None


@router.post("/{validation_id}/test", response_model=ValidationTestResponse)
async def test_validation(
    validation_id: UUID,
    test_request: ValidationTestRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test a validation rule against sample data"""
    rule = db.query(models.ValidationRule).filter(
        models.ValidationRule.id == validation_id,
        models.ValidationRule.tenant_id == current_user.tenant_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Validation rule not found")
    
    # TODO: Implement actual validation testing
    # For now, return a placeholder response
    import time
    start_time = time.time()
    
    try:
        if rule.rule_type == models.ValidationRuleType.PYTHON_EXPR:
            # Simple Python expression evaluation
            # In production, this should use the validation engine
            result = eval(rule.expression, {"__builtins__": {}}, test_request.sample_data)
            passed = bool(result)
        else:
            # SQL validation would require database context
            # For now, mark as passed
            passed = True
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        return ValidationTestResponse(
            passed=passed,
            error_message=None if passed else rule.error_message,
            execution_time_ms=execution_time_ms
        )
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        return ValidationTestResponse(
            passed=False,
            error_message=f"Validation error: {str(e)}",
            execution_time_ms=execution_time_ms
        )
