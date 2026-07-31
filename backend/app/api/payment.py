import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.payment import Subscription
from app.config import get_settings

router = APIRouter(tags=["Payment"])

PLANS = {
    "free": {"id": "free", "name": "Free", "price": 0, "features": ["3 analyses/mo", "Basic ATS", "1 template", "1 cover letter/mo"]},
    "pro": {"id": "pro", "name": "Pro", "price": 1900, "features": ["Unlimited analyses", "Unlimited builder", "Unlimited cover letters", "JD matching", "AI interview prep", "Priority support"]},
    "recruiter": {"id": "recruiter", "name": "Recruiter", "price": 9900, "features": ["Everything in Pro", "Unlimited job posts", "AI candidate ranking", "Analytics dashboard", "Team access (5 seats)", "API access"]},
}

@router.get("/api/v1/payment/config")
def payment_config():
    settings = get_settings()
    return {
        "stripe_configured": bool(settings.stripe_secret_key),
        "plans": {
            k: {"id": v["id"], "name": v["name"], "price": v["price"]} for k, v in PLANS.items()
        },
    }

@router.post("/api/v1/payment/create-checkout")
def create_checkout(request: dict, db: Session = Depends(get_db)):
    settings = get_settings()
    plan_id = request.get("plan", "free")
    email = request.get("email", "")

    if plan_id not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    if settings.stripe_secret_key:
        import stripe
        stripe.api_key = settings.stripe_secret_key

        price_map = {
            "pro": settings.stripe_price_pro_monthly,
            "recruiter": settings.stripe_price_recruiter_monthly,
        }
        price_id = price_map.get(plan_id)
        if not price_id or price_id in ("price_pro_monthly", "price_recruiter_monthly"):
            raise HTTPException(status_code=500, detail=f"Stripe price ID not configured for {plan_id} plan. Set STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_RECRUITER_MONTHLY in .env")

        try:
            checkout_session = stripe.checkout.Session.create(
                customer_email=email,
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=f"{settings.frontend_url}/pricing/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.frontend_url}/pricing/cancel",
                metadata={"plan": plan_id, "email": email},
            )
            return {"url": checkout_session.url, "session_id": checkout_session.id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    else:
        sub = db.query(Subscription).filter(Subscription.email == email).first()
        if not sub:
            sub = Subscription(email=email, plan=plan_id, status="active", stripe_subscription_id=f"demo_{plan_id}_{email}")
            db.add(sub)
        else:
            sub.plan = plan_id
            sub.status = "active"
            sub.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {
            "url": f"/pricing/success?session_id=demo_{plan_id}_{email}",
            "session_id": f"demo_{plan_id}_{email}",
            "demo": True,
        }

@router.get("/api/v1/payment/subscription")
def get_subscription(email: str = "", db: Session = Depends(get_db)):
    if not email:
        return {"plan": "free", "status": "inactive", "email": ""}
    sub = db.query(Subscription).filter(Subscription.email == email).first()
    if not sub or sub.status != "active":
        return {"plan": "free", "status": "inactive", "email": email}
    return {
        "plan": sub.plan,
        "status": sub.status,
        "email": sub.email,
        "since": sub.created_at.isoformat() if sub.created_at else None,
    }

@router.post("/api/v1/payment/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    settings = get_settings()
    if not settings.stripe_secret_key:
        return {"status": "ignored", "detail": "Stripe not configured"}

    import stripe
    stripe.api_key = settings.stripe_secret_key

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        email = session.get("customer_email") or session["metadata"].get("email")
        plan = session["metadata"].get("plan", "free")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")

        if email:
            sub = db.query(Subscription).filter(Subscription.email == email).first()
            if sub:
                sub.plan = plan
                sub.status = "active"
                sub.stripe_customer_id = customer_id
                sub.stripe_subscription_id = subscription_id
                sub.updated_at = datetime.now(timezone.utc)
            else:
                db.add(Subscription(
                    email=email, plan=plan, status="active",
                    stripe_customer_id=customer_id, stripe_subscription_id=subscription_id,
                ))
            db.commit()

    elif event["type"] == "customer.subscription.updated":
        sub_data = event["data"]["object"]
        subscription_id = sub_data.get("id")
        status = sub_data.get("status", "inactive")
        db_sub = db.query(Subscription).filter(Subscription.stripe_subscription_id == subscription_id).first()
        if db_sub:
            db_sub.status = "active" if status == "active" else status
            db_sub.updated_at = datetime.now(timezone.utc)
            db.commit()

    elif event["type"] == "customer.subscription.deleted":
        sub_data = event["data"]["object"]
        subscription_id = sub_data.get("id")
        db_sub = db.query(Subscription).filter(Subscription.stripe_subscription_id == subscription_id).first()
        if db_sub:
            db_sub.status = "canceled"
            db_sub.updated_at = datetime.now(timezone.utc)
            db.commit()

    return {"status": "ok"}

@router.post("/api/v1/payment/portal")
def customer_portal(request: dict, db: Session = Depends(get_db)):
    settings = get_settings()
    email = request.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    if not settings.stripe_secret_key:
        sub = db.query(Subscription).filter(Subscription.email == email).first()
        if sub:
            sub.status = "canceled"
            sub.updated_at = datetime.now(timezone.utc)
            db.commit()
        return {"url": "/pricing", "demo": True}

    import stripe
    stripe.api_key = settings.stripe_secret_key

    sub = db.query(Subscription).filter(Subscription.email == email).first()
    if not sub or not sub.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No active subscription for this email")

    try:
        session = stripe.billing_portal.Session.create(
            customer=sub.stripe_customer_id,
            return_url=f"{settings.frontend_url}/pricing",
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
