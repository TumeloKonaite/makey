import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.routes.categories.schemas import CategoryRead
from app.models import Category
from app.repository.database.tables.session_manager import get_db
from app.services.listings import service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)) -> list[Category]:
    return service.list_categories(db)


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: uuid.UUID, db: Session = Depends(get_db)) -> Category:
    return service.get_category(db, category_id)
