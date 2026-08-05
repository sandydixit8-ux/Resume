from fastapi import APIRouter
from app.services.country_rules import COUNTRY_RULES, get_country, list_countries, INTERNATIONAL_FIELDS

router = APIRouter(tags=["Countries"])


@router.get("/countries")
def countries_list():
    return {"countries": list_countries()}


@router.get("/countries/{code}")
def country_detail(code: str):
    return {"country": get_country(code)}


@router.get("/countries/fields")
def international_fields():
    return {"fields": INTERNATIONAL_FIELDS}
