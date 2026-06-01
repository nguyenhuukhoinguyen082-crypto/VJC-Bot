from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Response
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from db import get_db, User, Flight, Seatmap, Blacklist, MenuItem, model_to_dict, init_db
import json
import os
import secrets
import uuid
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
import urllib.request
import urllib.parse
import urllib.error
from config import settings, GUILD_ID, DISCORD_INVITE_URL, BRANDING
from security import (
    validate_settings,
    sanitize_user,
    sanitize_users_map,
    filter_user_updates,
    is_user_banned,
    auth_cookie_kwargs,
)
from xp import (
    JOB_WORK_COOLDOWN_SECONDS,
    MAX_DAILY_EARNINGS,
    MIN_JOB_PAYOUT,
    WORK_XP,
    apply_xp,
    can_work_job,
    ensure_progression,
    get_daily_job_board,
)

validate_settings()

app = FastAPI(title=f"{BRANDING.get('airline', {}).get('name', 'PTFS Airline')} API", version="1.0.0")

MAX_VERIFY_ATTEMPTS = 5
VERIFY_LOCKOUT_MINUTES = 15

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.on_event("startup")
def startup_event():
    init_db()

# CORS middleware — explicit origins required when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-CSRF-Token",
        "X-API-Key",
        "Accept",
        "Origin",
    ],
    expose_headers=["Content-Type"],
    max_age=600,
)

# API Key authentication
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key"
        )
    return api_key

# Password hashing via raw bcrypt to avoid passlib known bugs with modern bcrypt
class SimplePwdContext:
    def hash(self, password: str) -> str:
        # bcrypt rejects passwords > 72 bytes, truncate gently just in case
        pwd_bytes = password.encode('utf-8')[:72]
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
        
    def verify(self, password: str, hashed_password: str) -> bool:
        pwd_bytes = password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        try:
            return bcrypt.checkpw(pwd_bytes, hash_bytes)
        except (ValueError, TypeError):
            return False

pwd_context = SimplePwdContext()

# CSRF token management (in-memory for demo, use Redis in production)
csrf_tokens: Dict[str, Dict] = {}

# Verification code management (in-memory for demo, use Redis in production)
verification_codes: Dict[str, Dict] = {}
verify_attempts: Dict[str, Dict] = {}

def generate_csrf_token() -> str:
    """Generate a secure CSRF token"""
    token = secrets.token_urlsafe(32)
    csrf_tokens[token] = {
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=settings.csrf_token_expire_minutes)
    }
    return token

def validate_csrf_token(token: str) -> bool:
    """Validate a CSRF token"""
    if token not in csrf_tokens:
        print(f"CSRF: Token not found in store. Token length: {len(token)}")
        return False
    
    token_data = csrf_tokens[token]
    if datetime.utcnow() > token_data["expires_at"]:
        print(f"CSRF: Token expired. Created: {token_data['created_at']}, Expires: {token_data['expires_at']}, Now: {datetime.utcnow()}")
        del csrf_tokens[token]
        return False
    
    print(f"CSRF: Token valid. Expires in: {(token_data['expires_at'] - datetime.utcnow()).total_seconds()} seconds")
    return True

async def verify_csrf_token(request: Request, x_csrf_token: Optional[str] = Header(None, alias="X-CSRF-Token"), x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    if x_api_key == settings.api_key:
        return None
        
    cleanup_expired_csrf_tokens()
    
    if not x_csrf_token:
        print("CSRF: Missing X-CSRF-Token header")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing CSRF token header"
        )

    if not validate_csrf_token(x_csrf_token):
        print(f"CSRF: Invalid or expired token {x_csrf_token}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired CSRF token"
        )
        
    # For cross-origin deployments (iOS Safari compatibility), skip cookie validation
    # Safari ITP blocks third-party cookies, so we rely on header-only validation
    if settings.is_cross_origin_deployment:
        origin = request.headers.get("origin")
        print(f"CSRF: Cross-origin deployment, skipping cookie validation. Origin: {origin}")
        return x_csrf_token
    
    cookie_token = request.cookies.get("csrf_token")
    if not cookie_token:
        print("CSRF: Missing csrf_token cookie")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing CSRF cookie"
        )

    if cookie_token != x_csrf_token:
        print(f"CSRF: Token mismatch. Header: {x_csrf_token}, Cookie: {cookie_token}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token mismatch"
        )
        
    return x_csrf_token

def cleanup_expired_csrf_tokens():
    """Remove expired CSRF tokens"""
    now = datetime.utcnow()
    expired_tokens = [
        token for token, data in csrf_tokens.items()
        if now > data["expires_at"]
    ]
    for token in expired_tokens:
        del csrf_tokens[token]

def generate_verification_code(user_id: str) -> str:
    """Generate a secure single-use verification token."""
    code = secrets.token_urlsafe(32)
    verification_codes[code] = {
        "user_id": user_id,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=15),
    }
    verify_attempts.pop(user_id, None)
    return code


def check_verify_lockout(user_id: str) -> None:
    """Raise if the user is temporarily locked out of verification attempts."""
    record = verify_attempts.get(user_id)
    if not record:
        return
    locked_until = record.get("locked_until")
    if locked_until and datetime.utcnow() < locked_until:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed verification attempts. Try again later.",
        )
    if locked_until and datetime.utcnow() >= locked_until:
        verify_attempts.pop(user_id, None)


def record_verify_failure(user_id: str) -> None:
    record = verify_attempts.setdefault(
        user_id, {"count": 0, "locked_until": None}
    )
    record["count"] += 1
    if record["count"] >= MAX_VERIFY_ATTEMPTS:
        record["locked_until"] = datetime.utcnow() + timedelta(
            minutes=VERIFY_LOCKOUT_MINUTES
        )


def set_auth_cookies(response: Response, access_token: str, user_id: str, user_group: str) -> None:
    max_age = settings.access_token_expire_minutes * 60
    cookie_opts = auth_cookie_kwargs()
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=max_age,
        **cookie_opts,
    )
    response.set_cookie(
        key="user_group",
        value=user_group,
        max_age=max_age,
        **cookie_opts,
    )


def clear_auth_cookies(response: Response) -> None:
    cookie_opts = auth_cookie_kwargs()
    response.delete_cookie(key="access_token", **cookie_opts)
    response.delete_cookie(key="user_group", **cookie_opts)


def extract_bearer_token(request: Request, authorization: Optional[str] = None) -> Optional[str]:
    if authorization:
        if authorization.startswith("Bearer "):
            return authorization[7:]
        return authorization
    return request.cookies.get("access_token")

def is_discord_guild_member(discord_id: str) -> bool | None:
    """Return True/False for guild membership, or None if the check cannot run."""
    if not settings.discord_bot_token or not GUILD_ID:
        print("Discord: Skipping guild membership check (bot token or guild ID not configured)")
        return None

    url = f"https://discord.com/api/v10/guilds/{GUILD_ID}/members/{discord_id}"
    headers = {
        "Authorization": f"Bot {settings.discord_bot_token}",
        "User-Agent": f"{BRANDING.get('airline', {}).get('shortName', 'PTFS')} (http://localhost, 1.0.0)",
    }

    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req):
            return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        print(f"Discord: Guild member check failed for {discord_id}: {e}")
        raise HTTPException(
            status_code=503,
            detail="Unable to verify Discord membership. Please try again later.",
        )
    except Exception as e:
        print(f"Discord: Guild member check error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Unable to verify Discord membership. Please try again later.",
        )


def send_discord_message(user_id: str, payload: dict):
    """Send a DM message (content or embed) to a Discord user"""
    if not settings.discord_bot_token:
        print("Discord: No bot token configured")
        return
    
    url = "https://discord.com/api/v10/users/@me/channels"
    headers = {
        "Authorization": f"Bot {settings.discord_bot_token}",
        "Content-Type": "application/json",
        "User-Agent": f"{BRANDING.get('airline', {}).get('shortName', 'PTFS')} (http://localhost, 1.0.0)"
    }
    
    try:
        # 1. Create DM channel
        data = json.dumps({"recipient_id": user_id}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            channel_data = json.loads(resp.read().decode())
            channel_id = channel_data["id"]
            
        # 2. Send message
        msg_url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
        msg_data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(msg_url, data=msg_data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            print(f"Discord: Sent message to {user_id}")
    except Exception as e:
        print(f"Discord: Error sending message to {user_id}: {e}")

def send_verification_notification(user_id: str, discord_id: str, code: str):
    """Send a verification code via Discord DM using a rich embed"""
    embed = {
        "title": f"✈️ Welcome to {BRANDING.get('airline', {}).get('name', 'PTFS Airline')}",
        "description": f"Thank you for joining our community! Please use the code below to verify your account.",
        "color": 0x10b981,  # Emerald-500
        "fields": [
            {
                "name": "Verification Code",
                "value": f"# `{code}`",
                "inline": False
            },
            {
                "name": "Next Steps",
                "value": "Go back to the registration page and enter this code to complete your setup.",
                "inline": False
            }
        ],
        "footer": {
            "text": f"{BRANDING.get('airline', {}).get('name', 'PTFS Airline')} | {BRANDING.get('airline', {}).get('shortName', 'PTFS')}",
            "icon_url": BRANDING.get('logos', {}).get('bot', '')
        },
        "timestamp": datetime.utcnow().isoformat()
    }
    
    payload = {
        "embeds": [embed]
    }
    
    send_discord_message(discord_id, payload)

def validate_verification_code(code: str, user_id: str) -> bool:
    """Validate a verification token for the given user."""
    if code not in verification_codes:
        return False

    code_data = verification_codes[code]
    if datetime.utcnow() > code_data["expires_at"]:
        del verification_codes[code]
        return False

    if code_data["user_id"] != user_id:
        return False

    return True

def cleanup_expired_verification_codes():
    """Remove expired verification codes"""
    now = datetime.utcnow()
    expired_codes = [
        code for code, data in verification_codes.items()
        if now > data["expires_at"]
    ]
    for code in expired_codes:
        del verification_codes[code]

# RLS-like access control
class AccessControl:
    @staticmethod
    def can_access_user(user_id: str, requesting_user_id: str, user_group: str) -> bool:
        # Users can access their own data
        if user_id == requesting_user_id:
            return True
        # Dev group has full access
        if user_group == "dev":
            return True
        # Director and staff can access user information
        if user_group in ["director", "staff"]:
            return True
        return False
    
    @staticmethod
    def can_modify_user(user_id: str, requesting_user_id: str, user_group: str) -> bool:
        # Users can modify their own data
        if user_id == requesting_user_id:
            return True
        # Dev, director can modify user data
        return user_group in ["dev", "director"]
    
    @staticmethod
    def can_create_flight(user_group: str) -> bool:
        # Dev and director can create flights
        return user_group in ["dev", "director"]
    
    @staticmethod
    def can_delete_flight(user_group: str) -> bool:
        # Dev and director can delete flights
        return user_group in ["dev", "director"]
    
    @staticmethod
    def can_modify_flight(user_group: str) -> bool:
        # Dev, director, and staff can modify flights
        return user_group in ["dev", "director", "staff"]
    
    @staticmethod
    def can_access_seatmap(user_group: str) -> bool:
        # All groups can access seatmap
        return True
    
    @staticmethod
    def can_modify_seatmap(user_group: str) -> bool:
        # Dev, director, and staff can modify seatmap
        return user_group in ["dev", "director", "staff"]
    
    @staticmethod
    def can_modify_menu(user_group: str) -> bool:
        # Dev, director, and staff can modify menu items
        return user_group in ["dev", "director", "staff"]
    
    @staticmethod
    def can_access_dashboard(user_group: str) -> bool:
        # Dev has full dashboard access
        return user_group == "dev"

def update_user_upcoming_flight(nickname: str, db: Session):
    """Calculate and update the user's next upcoming flight in the database"""
    user = db.query(User).filter(User.nickname.ilike(nickname)).first()
            
    if not user:
        return
        
    user_flights = []
    flights = db.query(Flight).filter(Flight.status.notin_(["completed", "cancelled"])).all()
    
    for f in flights:
        seating = f.seating or []
        for s in seating:
            if s.get("username", "").lower() == nickname.lower():
                user_flights.append({
                    "flight_id": f.id,
                    "flight": f.flight,
                    "departure_icao": f.departure_icao,
                    "arrival_icao": f.arrival_icao,
                    "timestamp": f.departure_timestamp,
                    "seat": s.get("seat"),
                    "class": s.get("class")
                })
                break
                
    if not user_flights:
        user.upcoming_flight = None
    else:
        # Sort by timestamp, handle None if any
        user_flights.sort(key=lambda x: x["timestamp"] if x["timestamp"] is not None else 0)
        user.upcoming_flight = user_flights[0]
        
    db.commit()

# Pydantic models
class UserLogin(BaseModel):
    nickname: str
    password: str

class UserCreate(BaseModel):
    nickname: str
    email: str
    password: str
    discord_id: str

class VerifyCode(BaseModel):
    user_id: str
    code: str

class MoneyOperation(BaseModel):
    user_id: str
    amount: int
    reason: Optional[str] = None

class MilesOperation(BaseModel):
    user_id: str
    amount: int
    reason: Optional[str] = None

class BanOperation(BaseModel):
    user_id: str
    reason: str
    duration: Optional[int] = None  # in seconds, None = permanent

class WarnOperation(BaseModel):
    user_id: str
    reason: str
    expiry: int  # timestamp

class BlacklistOperation(BaseModel):
    discord_id: str
    reason: str

class SuspiciousOperation(BaseModel):
    user_id: str
    reason: str

class JobWork(BaseModel):
    job_name: str

class ReferralClaim(BaseModel):
    referrer_id: str

class MenuItemInput(BaseModel):
    name: str
    description: str
    category: str
    price: int
    image_url: Optional[str] = ""
    available: bool = True

class FlightCreate(BaseModel):
    flight: str
    departure_icao: str
    departure_name: str
    departure_ingame_icao: str
    departure_timestamp: int
    arrival_icao: str
    arrival_name: str
    arrival_ingame_icao: str
    arrival_timestamp: int
    aircraft: str
    seating_class_prices: Dict[str, int]
    flight_miles_reward: int
    pax: int = 0

class BookingRequest(BaseModel):
    class_type: str
    seat: str
    passenger: Dict

class Token(BaseModel):
    access_token: str
    token_type: str

# JWT functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        return None

# Auth endpoints
@app.get("/csrf-token")
@limiter.limit("30/minute")
async def get_csrf_token(request: Request, response: Response):
    """Get a CSRF token for state-changing requests"""
    token = generate_csrf_token()
    response.set_cookie(key="csrf_token", value=token, **auth_cookie_kwargs())
    return {"csrf_token": token}

@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, response: Response, user_login: UserLogin, db: Session = Depends(get_db)):
    nickname_input = user_login.nickname.strip()
    user = db.query(User).filter(User.nickname.ilike(nickname_input)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.pwdh or not pwd_context.verify(user_login.password, user.pwdh):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if is_user_banned(model_to_dict(user)):
        raise HTTPException(status_code=403, detail="Account is banned")

    if not user.verified:
        raise HTTPException(status_code=403, detail="Account not verified")

    access_token = create_access_token(
        data={"sub": user.id, "group": user.group}
    )
    user.lastLogin = int(datetime.now().timestamp())
    db.commit()

    set_auth_cookies(response, access_token, user.id, user.group)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "user_group": user.group,
    }

@app.post("/auth/register")
@limiter.limit("3/minute")
async def register(request: Request, user: UserCreate, db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    try:
        discord_id_int = int(user.discord_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Discord ID must be numeric")

    member_status = is_discord_guild_member(str(discord_id_int))
    if member_status is False:
        raise HTTPException(
            status_code=400,
            detail=(
                "You must join our Discord server before creating an account. "
                f"Join here: {DISCORD_INVITE_URL}"
            ),
        )

    # Check if user already exists
    existing_user = db.query(User).filter(
        or_(
            User.nickname.ilike(user.nickname.strip()),
            User.email.ilike(user.email.strip()),
            User.discordID == discord_id_int
        )
    ).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists (nickname, email, or Discord ID taken)")
    
    # Retrieve client IP address
    ip_address = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    if ip_address:
        ip_address = ip_address.split(",")[0].strip()
    else:
        ip_address = request.client.host if request.client else "127.0.0.1"

    new_user = User(
        nickname=user.nickname.strip(),
        email=user.email.strip(),
        pwdh=pwd_context.hash(user.password),
        ip_address=ip_address,
        group="user",
        money=0,
        flightmiles=0,
        achievement=[],
        createdAt=int(datetime.now().timestamp()),
        lastLogin=int(datetime.now().timestamp()),
        discordID=discord_id_int,
        xp=0,
        level=1,
        banned=False,
        verified=False
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    code = generate_verification_code(new_user.id)
    send_verification_notification(new_user.id, str(user.discord_id), code)

    return {"message": "User created successfully. Check your Discord DMs.", "user_id": new_user.id}

@app.post("/auth/verify")
@limiter.limit("10/minute")
async def verify(request: Request, verify_data: VerifyCode, db: Session = Depends(get_db)):
    cleanup_expired_verification_codes()
    check_verify_lockout(verify_data.user_id)

    user = db.query(User).filter(User.id == verify_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not validate_verification_code(verify_data.code, verify_data.user_id):
        record_verify_failure(verify_data.user_id)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    user.verified = True
    db.commit()

    del verification_codes[verify_data.code]
    verify_attempts.pop(verify_data.user_id, None)

    return {"message": "User verified successfully"}

@app.post("/auth/resend-code")
@limiter.limit("3/minute")
async def resend_code(request: Request, user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.verified:
        raise HTTPException(status_code=400, detail="User already verified")
    
    cleanup_expired_verification_codes()
    code = generate_verification_code(user_id)
    
    # Send verification code via Discord DM
    discord_id = user.discordID
    if discord_id:
        send_verification_notification(user_id, str(discord_id), code)
    else:
        print(f"Discord: No discordID found for user {user_id}")
    
    return {"message": "Verification code resent. Check your Discord DMs."}


# Dependency to get current user from token
async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Dict:
    token = extract_bearer_token(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_dict = model_to_dict(user)
    if is_user_banned(user_dict):
        raise HTTPException(status_code=403, detail="Account is banned")

    return {
        "user_id": user_id,
        "group": user.group,
        "data": user_dict,
    }


async def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[Dict]:
    """Optional version of get_current_user that returns None if no token is provided."""
    token = extract_bearer_token(request, authorization)
    if not token:
        return None
    try:
        payload = verify_token(token)
        if not payload:
            return None

        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        user_dict = model_to_dict(user)
        if is_user_banned(user_dict):
            return None

        return {
            "user_id": user_id,
            "group": user.group,
            "data": user_dict,
        }
    except Exception:
        return None


@app.get("/auth/me")
@limiter.limit("60/minute")
async def auth_me(request: Request, current_user: Dict = Depends(get_current_user)):
    return sanitize_user(current_user["user_id"], current_user["data"])


@app.post("/auth/logout")
async def auth_logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Logged out"}


async def verify_api_key(x_api_key: str = Header(None)) -> bool:
    """Verify the API Key for bot/internal requests"""
    if not x_api_key or x_api_key != settings.api_key:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return True

async def get_bot_user() -> Dict:
    """Return a mock user for bot requests authenticated via API Key"""
    return {
        "user_id": "system_bot",
        "group": "dev",
        "data": {}
    }



def format_flight(flight_model):
    """Convert flight model to nested dict structure for frontend compatibility"""
    if not flight_model:
        return None
    d = model_to_dict(flight_model)
    # Reconstruct nested departure/arrival
    d["departure"] = {
        "ingame-icao": d.pop("departure_ingame_icao", None),
        "icao": d.pop("departure_icao", None),
        "name": d.pop("departure_name", None),
        "timestamp": d.pop("departure_timestamp", None)
    }
    d["arrival"] = {
        "ingame-icao": d.pop("arrival_ingame_icao", None),
        "icao": d.pop("arrival_icao", None),
        "name": d.pop("arrival_name", None),
        "timestamp": d.pop("arrival_timestamp", None)
    }
    return d

# Flights endpoints
@app.get("/flights")
@limiter.limit("60/minute")
async def get_flights(request: Request, current_user: Optional[Dict] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    flights = db.query(Flight).all()
    return {f.id: format_flight(f) for f in flights}

@app.get("/flights/{flight_id}")
@limiter.limit("60/minute")
async def get_flight(request: Request, flight_id: str, current_user: Optional[Dict] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return format_flight(flight)

@app.post("/flights")
@limiter.limit("10/minute")
async def create_flight(request: Request, flight: FlightCreate, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Dev and director can create flights
    if not AccessControl.can_create_flight(current_user["group"]):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    new_flight = Flight(
        flight=flight.flight,
        departure_ingame_icao=flight.departure_ingame_icao,
        departure_icao=flight.departure_icao,
        departure_name=flight.departure_name,
        departure_timestamp=flight.departure_timestamp,
        arrival_ingame_icao=flight.arrival_ingame_icao,
        arrival_icao=flight.arrival_icao,
        arrival_name=flight.arrival_name,
        arrival_timestamp=flight.arrival_timestamp,
        aircraft=flight.aircraft,
        pax=flight.pax,
        status="scheduled",
        price=flight.seating_class_prices,
        flight_miles_reward=flight.flight_miles_reward,
        seating=[]
    )
    
    db.add(new_flight)
    db.commit()
    db.refresh(new_flight)
    return {"message": "Flight created", "flight_id": new_flight.id}

@app.delete("/flights/{flight_id}")
@limiter.limit("10/minute")
async def delete_flight(request: Request, flight_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Dev and director can delete flights
    if not AccessControl.can_delete_flight(current_user["group"]):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    db.delete(flight)
    db.commit()
    return {"message": "Flight deleted"}

@app.patch("/flights/{flight_id}")
@limiter.limit("10/minute")
async def update_flight(request: Request, flight_id: str, updates: Dict, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Dev and director can modify flights
    if not AccessControl.can_modify_flight(current_user["group"]):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    # Handle top-level fields
    for field in ["flight", "aircraft", "pax", "status"]:
        if field in updates:
            setattr(flight, field, updates[field])
            
    # Handle nested departure/arrival updates mapping to model columns
    if "departure_icao" in updates:
        flight.departure_icao = updates["departure_icao"]
        # If departure_ingame_icao not provided, default to departure_icao
        if "departure_ingame_icao" not in updates:
            flight.departure_ingame_icao = updates["departure_icao"]
    if "departure_name" in updates:
        flight.departure_name = updates["departure_name"]
    if "departure_timestamp" in updates:
        flight.departure_timestamp = updates["departure_timestamp"]
    if "departure_ingame_icao" in updates:
        flight.departure_ingame_icao = updates["departure_ingame_icao"]
        
    if "arrival_icao" in updates:
        flight.arrival_icao = updates["arrival_icao"]
        # If arrival_ingame_icao not provided, default to arrival_icao
        if "arrival_ingame_icao" not in updates:
            flight.arrival_ingame_icao = updates["arrival_icao"]
    if "arrival_name" in updates:
        flight.arrival_name = updates["arrival_name"]
    if "arrival_timestamp" in updates:
        flight.arrival_timestamp = updates["arrival_timestamp"]
    if "arrival_ingame_icao" in updates:
        flight.arrival_ingame_icao = updates["arrival_ingame_icao"]

    if "seating_class_prices" in updates:
        flight.price = updates["seating_class_prices"]
        
    if "flight_miles_reward" in updates:
        flight.flight_miles_reward = updates["flight_miles_reward"]
        
    db.commit()
    return {"message": "Flight updated"}

@app.get("/planes")
async def get_planes(db: Session = Depends(get_db)):
    seatmaps = db.query(Seatmap).all()
    return [s.aircraft_type for s in seatmaps]

@app.get("/planes/{plane_type}/seatmap")
async def get_plane_seatmap(plane_type: str, db: Session = Depends(get_db)):
    seatmap = db.query(Seatmap).filter(Seatmap.aircraft_type == plane_type).first()
    if not seatmap:
        raise HTTPException(status_code=404, detail="Aircraft type not found")
    return seatmap.config

@app.post("/flights/{flight_id}/complete")
@limiter.limit("5/minute")
async def complete_flight(request: Request, flight_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can complete flights
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
        
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
        
    if flight.status == "completed":
        raise HTTPException(status_code=400, detail="Flight already completed")
        
    # Mark as completed
    flight.status = "completed"
    
    # Distribute miles
    miles_reward = flight.flight_miles_reward or 0
    if miles_reward > 0:
        # Seating is an array of passenger objects: [{username: str, class: str, seat: str, ...}]
        seating = flight.seating or []
        if isinstance(seating, list):
            for passenger in seating:
                username = passenger.get("username")
                if not username:
                    continue
                # Need to find user by nickname (case-insensitive)
                found_user = db.query(User).filter(User.nickname.ilike(username)).first()
                
                if found_user:
                    found_user.flightmiles = (found_user.flightmiles or 0) + miles_reward
                    print(f"Awarded {miles_reward} miles to {username} ({found_user.id})")
        
        # Update upcoming flights for all passengers
        for s in seating:
            if isinstance(s, dict) and s.get("username"):
                update_user_upcoming_flight(s["username"], db)
        
    db.commit()
    return {"message": "Flight completed and miles distributed", "miles_awarded": miles_reward}

@app.post("/flights/{flight_id}/book")
@limiter.limit("5/minute")
async def book_flight(request: Request, flight_id: str, booking: BookingRequest, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    # Check if seat is already taken
    seating = flight.seating or []
    if not isinstance(seating, list):
        seating = []
        
    if any(s.get("seat") == booking.seat for s in seating):
        raise HTTPException(status_code=400, detail="Seat already taken")
    
    # --- Payment Verification & Deduction ---
    user_id = current_user["user_id"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")
    
    seat_class = booking.class_type
    
    flight_prices = flight.price or {}
    if seat_class not in flight_prices:
        raise HTTPException(status_code=400, detail=f"Pricing for class '{seat_class}' not defined for this flight")
    
    ticket_price = flight_prices[seat_class]
    current_balance = user.money or 0
    
    if current_balance < ticket_price:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient funds ({current_balance:,} / {ticket_price:,} VND). Please head to our Discord server and use `/work` to earn more money through our interactive mini-games!"
        )
    
    # Deduct money
    user.money = current_balance - ticket_price
    
    # Log transaction
    transactions = user.transactions or []
    transactions.append({
        "type": "flight_booking",
        "amount": ticket_price,
        "flight": flight.flight,
        "seat": booking.seat,
        "timestamp": int(datetime.now().timestamp())
    })
    user.transactions = transactions
    # ---------------------------------------

    # Add booking
    new_booking = {
        "username": current_user["data"]["nickname"],
        "class": booking.class_type,
        "seat": booking.seat,
        "details": booking.passenger,
        "booked_at": datetime.utcnow().isoformat()
    }
    # Important: Create a NEW list to trigger SQLAlchemy JSON detection
    new_seating = list(seating)
    new_seating.append(new_booking)
    flight.seating = new_seating
    flight.pax = len(new_seating)
    
    db.commit()
    
    # Update user's upcoming flight
    update_user_upcoming_flight(current_user["data"]["nickname"], db)
    
    return {"message": "Booking successful", "booking": new_booking, "price_paid": ticket_price}

@app.patch("/seatmap/{seatmap_id}")
@limiter.limit("10/minute")
async def update_seatmap_by_id(request: Request, seatmap_id: str, updates: Dict, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    seatmap = db.query(Seatmap).filter(Seatmap.aircraft_type == seatmap_id).first()
    if not seatmap:
        # Create new if doesn't exist
        seatmap = Seatmap(aircraft_type=seatmap_id, config=updates)
        db.add(seatmap)
    else:
        new_config = dict(seatmap.config)
        new_config.update(updates)
        seatmap.config = new_config
        
    db.commit()
    return {"message": "Seatmap updated"}

# Users endpoints
@app.get("/users")
@limiter.limit("30/minute")
async def get_users(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # RLS check
    if current_user["group"] == "user":
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            current_user["user_id"]: sanitize_user(
                current_user["user_id"], model_to_dict(user)
            )
        }

    users = db.query(User).all()
    users_dict = {u.id: model_to_dict(u) for u in users}
    return sanitize_users_map(users_dict)

@app.get("/users/{user_id}")
@limiter.limit("30/minute")
async def get_user(request: Request, user_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # RLS check
    if not AccessControl.can_access_user(user_id, current_user["user_id"], current_user["group"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return sanitize_user(user_id, model_to_dict(user))

@app.patch("/users/{user_id}")
@limiter.limit("20/minute")
async def update_user(request: Request, user_id: str, updates: Dict, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    if not AccessControl.can_modify_user(user_id, current_user["user_id"], current_user["group"]):
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_self = user_id == current_user["user_id"]
    is_dev = current_user["group"] == "dev"
    if not is_self and current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    allowed_updates = filter_user_updates(
        updates, is_self=is_self, is_dev=is_dev
    )
    if not allowed_updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    for k, v in allowed_updates.items():
        setattr(user, k, v)
        
    user.lastLogin = int(datetime.now().timestamp())
    db.commit()
    db.refresh(user)

    return {
        "message": "User updated",
        "user": sanitize_user(user_id, model_to_dict(user)),
    }

# Seatmap endpoints
@app.get("/seatmap")
@limiter.limit("60/minute")
async def get_seatmap(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    seatmaps = db.query(Seatmap).all()
    return {s.aircraft_type: s.config for s in seatmaps}

@app.get("/seatmap/{aircraft_type}")
@limiter.limit("60/minute")
async def get_aircraft_seatmap_2(request: Request, aircraft_type: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    seatmap = db.query(Seatmap).filter(Seatmap.aircraft_type == aircraft_type).first()
    if not seatmap:
        raise HTTPException(status_code=404, detail="Aircraft type not found")
    return seatmap.config

@app.post("/seatmap/{aircraft_type}")
@limiter.limit("10/minute")
async def create_seatmap(request: Request, aircraft_type: str, seatmap_data: Dict, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Dev and director can create seatmaps
    if not AccessControl.can_modify_seatmap(current_user["group"]):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    seatmap = db.query(Seatmap).filter(Seatmap.aircraft_type == aircraft_type).first()
    if seatmap:
        seatmap.config = seatmap_data
    else:
        seatmap = Seatmap(aircraft_type=aircraft_type, config=seatmap_data)
        db.add(seatmap)
        
    db.commit()
    return {"message": "Seatmap created"}

@app.patch("/seatmap/{aircraft_type}")
@limiter.limit("10/minute")
async def update_seatmap(request: Request, aircraft_type: str, updates: Dict, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Dev, director, and staff can modify seatmaps
    if not AccessControl.can_modify_seatmap(current_user["group"]):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    seatmap = db.query(Seatmap).filter(Seatmap.aircraft_type == aircraft_type).first()
    if not seatmap:
        raise HTTPException(status_code=404, detail="Aircraft type not found")
    
    new_config = dict(seatmap.config)
    new_config.update(updates)
    seatmap.config = new_config
    db.commit()
    return {"message": "Seatmap updated"}


@app.delete("/flights/{flight_id}/book/{seat}")
@limiter.limit("10/minute")
async def cancel_booking(request: Request, flight_id: str, seat: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    seating = flight.seating or []
    if not isinstance(seating, list):
        seating = []
        
    booking_to_cancel = None
    for b in seating:
        if b.get("seat") == seat:
            booking_to_cancel = b
            break
            
    if not booking_to_cancel:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    booked_username = booking_to_cancel.get("username")
    
    # Resolve booked_user from users DB using the username (nickname)
    booked_user = db.query(User).filter(User.nickname.ilike(booked_username)).first()
            
    if not booked_user:
        raise HTTPException(status_code=404, detail="Booked user not found")
    
    # Users can cancel their own bookings, staff can cancel any
    if current_user["group"] == "user" and current_user["user_id"] != booked_user.id:
        raise HTTPException(status_code=403, detail="Can only cancel your own booking")
    
    # Refund logic
    seat_class = booking_to_cancel.get("class", "Economy")
    flight_prices = flight.price or {}
    price = flight_prices.get(seat_class, 0)
    
    # Refund money (50% refund)
    refund_amount = price // 2
    booked_user.money = (booked_user.money or 0) + refund_amount
    
    # Remove booking
    new_seating = list(seating)
    new_seating.remove(booking_to_cancel)
    flight.seating = new_seating
    flight.pax = max(0, (flight.pax or 0) - 1)
    
    db.commit()
    
    # Update upcoming flights
    update_user_upcoming_flight(booked_username, db)
    
    return {"message": "Booking cancelled", "refund": refund_amount}

@app.get("/flights/{flight_id}/bookings")
@limiter.limit("30/minute")
async def get_flight_bookings(request: Request, flight_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    seating = flight.seating or []
    if not isinstance(seating, list):
        seating = []
    
    # Regular users only see their own bookings
    if current_user["group"] == "user":
        user_nickname = current_user["data"].get("nickname", "")
        user_bookings = [b for b in seating if b.get("username", "").lower() == user_nickname.lower()]
        return user_bookings
    
    # Staff, director, dev can see all bookings
    return seating

@app.patch("/flights/{flight_id}/bookings/{seat}")
@limiter.limit("20/minute")
async def update_flight_booking(request: Request, flight_id: str, seat: str, updates: Dict, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
        
    seating = flight.seating or []
    if not isinstance(seating, list):
        seating = []
        
    booking = None
    for b in seating:
        if b.get("seat") == seat:
            booking = b
            break
            
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    is_staff = current_user["group"] in ["dev", "director", "staff"]
    
    if not is_staff:
        # Resolve username of booking to check ownership
        booked_username = booking.get("username")
        booked_user = db.query(User).filter(User.nickname.ilike(booked_username)).first()
                
        if not booked_user or current_user["user_id"] != booked_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
            
        allowed_updates = ["checked_in"]
        for k in updates.keys():
            if k not in allowed_updates:
                raise HTTPException(status_code=403, detail="Cannot modify this field")
        if updates.get("checked_in") is not True:
            raise HTTPException(status_code=400, detail="Can only set checked_in to True")
            
    # Apply updates
    new_seating = list(seating)
    # Find the index of the booking to update it in the new list
    for idx, b in enumerate(new_seating):
        if b.get("seat") == seat:
            updated_booking = dict(b)
            for k, v in updates.items():
                if k in ["seat", "username"] and not is_staff:
                    continue
                updated_booking[k] = v
            new_seating[idx] = updated_booking
            booking = updated_booking
            break
            
    flight.seating = new_seating
    db.commit()
    
    # Also update user's upcoming flight reference in users database
    booked_username = booking.get("username")
    update_user_upcoming_flight(booked_username, db)
    
    return {"message": "Booking updated successfully", "booking": booking}

def determine_seat_class(aircraft_type: str, seat: str, db: Session):
    """Determine seat class based on aircraft type and seat number"""
    seatmap = db.query(Seatmap).filter(Seatmap.aircraft_type == aircraft_type).first()
    if not seatmap:
        return "Economy"
    
    aircraft_config = seatmap.config
    try:
        row = int(''.join(filter(str.isdigit, seat)))
    except ValueError:
        return "Economy"
    
    for class_name, config in aircraft_config.items():
        row_range = config.get("row", config.get("number", [1, 100]))
        if row_range[0] <= row <= row_range[1]:
            return class_name
    
    return "Economy"

# Economy endpoints
@app.post("/economy/money/add")
@limiter.limit("20/minute")
async def add_money(request: Request, operation: MoneyOperation, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can add money
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == operation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.money = (user.money or 0) + operation.amount
    
    # Log transaction
    transactions = user.transactions or []
    transactions.append({
        "type": "add",
        "amount": operation.amount,
        "reason": operation.reason or "Admin addition",
        "timestamp": int(datetime.now().timestamp())
    })
    user.transactions = transactions
    
    db.commit()
    return {"message": "Money added successfully"}

@app.post("/economy/money/remove")
@limiter.limit("20/minute")
async def remove_money(request: Request, operation: MoneyOperation, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can remove money
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == operation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.money = max(0, (user.money or 0) - operation.amount)
    
    # Log transaction
    transactions = user.transactions or []
    transactions.append({
        "type": "remove",
        "amount": operation.amount,
        "reason": operation.reason or "Admin deduction",
        "timestamp": int(datetime.now().timestamp())
    })
    user.transactions = transactions
    
    db.commit()
    return {"message": "Money removed successfully"}

@app.post("/economy/money/reset")
@limiter.limit("10/minute")
async def reset_money(request: Request, user_id: str, reason: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only dev and director can reset money
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.money = 0
    
    # Log transaction
    transactions = user.transactions or []
    transactions.append({
        "type": "reset",
        "amount": 0,
        "reason": reason or "Admin reset",
        "timestamp": int(datetime.now().timestamp())
    })
    user.transactions = transactions
    
    db.commit()
    return {"message": "Money reset successfully"}

@app.post("/economy/miles/add")
@limiter.limit("20/minute")
async def add_miles(request: Request, operation: MilesOperation, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can add miles
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == operation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.flightmiles = (user.flightmiles or 0) + operation.amount
    db.commit()
    return {"message": "Miles added successfully"}

@app.post("/economy/miles/remove")
@limiter.limit("20/minute")
async def remove_miles(request: Request, operation: MilesOperation, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can remove miles
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == operation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.flightmiles = max(0, (user.flightmiles or 0) - operation.amount)
    db.commit()
    return {"message": "Miles removed successfully"}

@app.post("/economy/pay")
@limiter.limit("20/minute")
async def pay_user(request: Request, target_user_id: str, amount: int, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    sender = db.query(User).filter(User.id == current_user["user_id"]).first()
    receiver = db.query(User).filter(User.id == target_user_id).first()
    
    if not receiver:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    if not sender:
        raise HTTPException(status_code=404, detail="Your user not found")
    
    if (sender.money or 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    # Transfer money
    sender.money = (sender.money or 0) - amount
    receiver.money = (receiver.money or 0) + amount
    
    # Log transactions for both users
    sender_transactions = sender.transactions or []
    sender_transactions.append({
        "type": "payment_sent",
        "amount": amount,
        "to": target_user_id,
        "timestamp": int(datetime.now().timestamp())
    })
    sender.transactions = sender_transactions
    
    receiver_transactions = receiver.transactions or []
    receiver_transactions.append({
        "type": "payment_received",
        "amount": amount,
        "from": current_user["user_id"],
        "timestamp": int(datetime.now().timestamp())
    })
    receiver.transactions = receiver_transactions
    
    db.commit()
    return {"message": "Payment successful"}

@app.get("/economy/transactions/{user_id}")
@limiter.limit("30/minute")
async def get_transactions(request: Request, user_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Users can only see their own transactions, staff can see all
    if current_user["group"] == "user" and current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user.transactions or []

@app.get("/economy/leaderboard")
@limiter.limit("30/minute")
async def get_leaderboard(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Get top 50 users sorted by money, then by flightmiles
    users = db.query(User).order_by(User.money.desc(), User.flightmiles.desc()).limit(50).all()
    
    leaderboard = []
    for user in users:
        leaderboard.append({
            "user_id": user.id,
            "nickname": user.nickname or "Unknown",
            "money": user.money or 0,
            "flightmiles": user.flightmiles or 0
        })
    
    return leaderboard

# Moderation endpoints
@app.post("/moderation/ban")
@limiter.limit("10/minute")
async def ban_user(request: Request, operation: BanOperation, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can ban
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == operation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    moderation = dict(user.moderation) if user.moderation else {}
    
    ban_data = {
        "reason": operation.reason,
        "banned_at": int(datetime.now().timestamp()),
        "banned_by": current_user["user_id"]
    }
    
    if operation.duration:
        ban_data["expires_at"] = int(datetime.now().timestamp()) + operation.duration
        ban_data["type"] = "tempban"
    else:
        ban_data["type"] = "permanent"
    
    moderation["ban"] = ban_data
    user.moderation = moderation
    user.banned = True
    
    db.commit()
    return {"message": "User banned successfully"}

@app.post("/moderation/unban")
@limiter.limit("10/minute")
async def unban_user(request: Request, user_id: str, reason: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can unban
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    moderation = dict(user.moderation) if user.moderation else {}
    
    # Save ban history
    if "ban_history" not in moderation:
        moderation["ban_history"] = []
    
    if "ban" in moderation:
        moderation["ban_history"].append({
            **moderation["ban"],
            "unbanned_at": int(datetime.now().timestamp()),
            "unbanned_by": current_user["user_id"],
            "unban_reason": reason
        })
        del moderation["ban"]
    
    user.moderation = moderation
    user.banned = False
    
    db.commit()
    return {"message": "User unbanned successfully"}

@app.post("/moderation/warn")
@limiter.limit("20/minute")
async def warn_user(request: Request, operation: WarnOperation, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can warn
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == operation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    moderation = dict(user.moderation) if user.moderation else {}
    
    if "warnings" not in moderation:
        moderation["warnings"] = []
    
    moderation["warnings"].append({
        "reason": operation.reason,
        "warned_at": int(datetime.now().timestamp()),
        "warned_by": current_user["user_id"],
        "expires_at": operation.expiry
    })
    
    user.moderation = moderation
    db.commit()
    return {"message": "User warned successfully"}

@app.get("/moderation/expired-bans")
@limiter.limit("10/minute")
async def get_expired_bans(request: Request, x_api_key: Optional[str] = Header(None), current_user: Optional[Dict] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    # Check API key or user group
    is_bot = x_api_key == settings.api_key
    if not is_bot and (not current_user or current_user["group"] not in ["dev", "director", "staff"]):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    now = int(datetime.now().timestamp())
    users = db.query(User).filter(User.banned == True).all()
    expired = []
    
    for user in users:
        ban_data = (user.moderation or {}).get("ban", {})
        expires_at = ban_data.get("expires_at")
        if expires_at and now > expires_at:
            expired.append({
                "user_id": user.id,
                "discord_id": str(user.discordID),
                "reason": ban_data.get("reason", "Ban expired")
            })
    
    return expired

@app.get("/moderation/blacklist")
@limiter.limit("20/minute")
async def get_blacklist(request: Request, x_api_key: Optional[str] = Header(None), current_user: Optional[Dict] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    is_bot = x_api_key == settings.api_key
    if not is_bot and not current_user:
        raise HTTPException(status_code=403, detail="Authentication required")
    
    blacklist = db.query(Blacklist).all()
    return [model_to_dict(b) for b in blacklist]

@app.get("/moderation/all-bans")
@limiter.limit("10/minute")
async def get_all_bans(request: Request, x_api_key: Optional[str] = Header(None), current_user: Optional[Dict] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    is_bot = x_api_key == settings.api_key
    if not is_bot and (not current_user or current_user["group"] not in ["dev", "director", "staff"]):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    users = db.query(User).filter(User.banned == True).all()
    bans = []
    for user in users:
        bans.append({
            "user_id": user.id,
            "discord_id": str(user.discordID),
            "ban_data": (user.moderation or {}).get("ban")
        })
    return bans

@app.post("/moderation/kick")
@limiter.limit("20/minute")
async def kick_user(request: Request, user_id: str, reason: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can kick
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    moderation = dict(user.moderation) if user.moderation else {}
    
    if "kicks" not in moderation:
        moderation["kicks"] = []
    
    moderation["kicks"].append({
        "reason": reason,
        "kicked_at": int(datetime.now().timestamp()),
        "kicked_by": current_user["user_id"]
    })
    
    user.moderation = moderation
    db.commit()
    return {"message": "User kicked successfully"}

@app.post("/moderation/blacklist")
@limiter.limit("10/minute")
async def blacklist_user(request: Request, operation: BlacklistOperation, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only dev and director can blacklist
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        discord_id_int = int(operation.discord_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Discord ID must be numeric")

    # Check if user exists
    user = db.query(User).filter(User.discordID == discord_id_int).first()
    
    if user:
        moderation = dict(user.moderation) if user.moderation else {}
        moderation["blacklisted"] = {
            "reason": operation.reason,
            "blacklisted_at": int(datetime.now().timestamp()),
            "blacklisted_by": current_user["user_id"]
        }
        user.moderation = moderation
        user.banned = True
    
    # Also add to separate Blacklist table for non-registered users (or all blacklisted users)
    blacklist_entry = db.query(Blacklist).filter(Blacklist.discord_id == discord_id_int).first()
    if not blacklist_entry:
        blacklist_entry = Blacklist(
            discord_id=discord_id_int,
            reason=operation.reason,
            blacklisted_at=int(datetime.now().timestamp()),
            blacklisted_by=current_user["user_id"]
        )
        db.add(blacklist_entry)
    else:
        blacklist_entry.reason = operation.reason
        blacklist_entry.blacklisted_at = int(datetime.now().timestamp())
        blacklist_entry.blacklisted_by = current_user["user_id"]
        
    db.commit()
    return {"message": "User blacklisted successfully"}

@app.post("/moderation/unblacklist")
@limiter.limit("10/minute")
async def unblacklist_user(request: Request, discord_id: str, reason: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only dev and director can unblacklist
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        discord_id_int = int(discord_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Discord ID must be numeric")

    # Check if user exists
    user = db.query(User).filter(User.discordID == discord_id_int).first()
    
    if user:
        moderation = dict(user.moderation) if user.moderation else {}
        if "blacklisted" in moderation:
            del moderation["blacklisted"]
            user.moderation = moderation
            user.banned = False
    
    # Remove from Blacklist table
    blacklist_entry = db.query(Blacklist).filter(Blacklist.discord_id == discord_id_int).first()
    if blacklist_entry:
        db.delete(blacklist_entry)
    elif not user:
        raise HTTPException(status_code=404, detail="User not found in blacklist")
    
    db.commit()
    return {"message": "User unblacklisted successfully"}

@app.get("/moderation/suspicious")
@limiter.limit("10/minute")
async def list_suspicious(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Staff, Director, and Dev can see the list
    if current_user["group"] not in ["dev", "director", "staff"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    users = db.query(User).all()
    suspicious_users = []
    
    for user in users:
        moderation = user.moderation or {}
        if "suspicious" in moderation:
            suspicious_users.append({
                "user_id": user.id,
                "nickname": user.nickname or "Unknown",
                "flags": moderation["suspicious"]
            })
            
    return suspicious_users

@app.post("/moderation/suspicious")
@limiter.limit("10/minute")
async def add_suspicious(request: Request, operation: SuspiciousOperation, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    # Only Dev or Director can flag users as suspicious
    if current_user["group"] not in ["dev", "director"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == operation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    moderation = dict(user.moderation) if user.moderation else {}
    if "suspicious" not in moderation:
        moderation["suspicious"] = []
        
    moderation["suspicious"].append({
        "reason": operation.reason,
        "flagged_at": int(datetime.now().timestamp()),
        "flagged_by": current_user["user_id"]
    })
    
    user.moderation = moderation
    db.commit()
    return {"message": "User flagged as suspicious"}

@app.get("/moderation/info/{user_id}")
@limiter.limit("30/minute")
async def get_moderation_info(request: Request, user_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only dev, director, and staff can view moderation info
    if current_user["group"] not in ["dev", "director", "staff"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user.moderation or {}

@app.get("/moderation/blacklist-all") # Changed from /moderation/blacklist to avoid conflict
@limiter.limit("30/minute")
async def get_blacklist_all(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only dev, director, and staff can view blacklist
    if current_user["group"] not in ["dev", "director", "staff"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    blacklist = db.query(Blacklist).all()
    # Also collect from User table moderation field if any missing
    # But usually Blacklist table should be the source of truth now
    return [model_to_dict(b) for b in blacklist]

# Analytics endpoints
@app.get("/analytics/daily")
@limiter.limit("10/minute")
async def daily_report(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only dev, director, and staff can view analytics
    if current_user["group"] not in ["dev", "director", "staff"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    today = datetime.now().date()
    today_timestamp = int(datetime(today.year, today.month, today.day).timestamp())
    
    # Calculate daily stats
    new_registrations = db.query(User).filter(User.createdAt >= today_timestamp).count()
    
    from sqlalchemy import func
    total_money = db.query(func.sum(User.money)).scalar() or 0
    total_miles = db.query(func.sum(User.flightmiles)).scalar() or 0
    total_users = db.query(User).count()
    
    flights = db.query(Flight).all()
    bookings_made = 0
    for f in flights:
        if f.seating:
            bookings_made += len(f.seating)
    
    return {
        "date": today.isoformat(),
        "new_registrations": new_registrations,
        "total_users": total_users,
        "total_money": total_money,
        "total_miles": total_miles,
        "bookings_made": bookings_made,
        "total_flights": len(flights)
    }

@app.get("/analytics/weekly")
@limiter.limit("10/minute")
async def weekly_report(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only dev, director, and staff can view analytics
    if current_user["group"] not in ["dev", "director", "staff"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    week_ago = datetime.now() - timedelta(days=7)
    week_ago_timestamp = int(week_ago.timestamp())
    
    # Calculate weekly stats
    new_registrations = db.query(User).filter(User.createdAt >= week_ago_timestamp).count()
    
    from sqlalchemy import func
    total_money = db.query(func.sum(User.money)).scalar() or 0
    total_miles = db.query(func.sum(User.flightmiles)).scalar() or 0
    total_users = db.query(User).count()
    
    flights = db.query(Flight).all()
    bookings_made = 0
    for f in flights:
        if f.seating:
            bookings_made += len(f.seating)
    
    return {
        "period": "last_7_days",
        "new_registrations": new_registrations,
        "total_users": total_users,
        "total_money": total_money,
        "total_miles": total_miles,
        "bookings_made": bookings_made,
        "total_flights": len(flights)
    }

@app.get("/analytics/monthly")
@limiter.limit("10/minute")
async def monthly_report(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only dev, director, and staff can view analytics
    if current_user["group"] not in ["dev", "director", "staff"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    month_ago = datetime.now() - timedelta(days=30)
    month_ago_timestamp = int(month_ago.timestamp())
    
    # Calculate monthly stats
    new_registrations = db.query(User).filter(User.createdAt >= month_ago_timestamp).count()
    
    from sqlalchemy import func
    total_money = db.query(func.sum(User.money)).scalar() or 0
    total_miles = db.query(func.sum(User.flightmiles)).scalar() or 0
    total_users = db.query(User).count()
    
    flights = db.query(Flight).all()
    bookings_made = 0
    for f in flights:
        if f.seating:
            bookings_made += len(f.seating)
    
    return {
        "period": "last_30_days",
        "new_registrations": new_registrations,
        "total_users": total_users,
        "total_money": total_money,
        "total_miles": total_miles,
        "bookings_made": bookings_made,
        "total_flights": len(flights)
    }

@app.get("/analytics/user/{user_id}")
@limiter.limit("20/minute")
async def user_report(request: Request, user_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only dev, director, and staff can view user analytics
    if current_user["group"] not in ["dev", "director", "staff"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate user stats
    transactions = user.transactions or []
    moderation = user.moderation or {}
    
    return {
        "user_id": user.id,
        "nickname": user.nickname,
        "money": user.money or 0,
        "flightmiles": user.flightmiles or 0,
        "joined_at": user.createdAt,
        "last_login": user.lastLogin,
        "total_transactions": len(transactions),
        "warnings": len(moderation.get("warnings", [])),
        "kicks": len(moderation.get("kicks", [])),
        "banned": user.banned,
        "verified": user.verified
    }

# Job system endpoints
@app.get("/jobs/list")
@limiter.limit("30/minute")
async def get_job_list(request: Request, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the list of available jobs for today"""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_dict = model_to_dict(user)
    ensure_progression(user_dict)
    
    # Update user from progression if changed
    user.level = user_dict["level"]
    user.xp = user_dict["xp"]
    db.commit()
    
    level = user.level
    daily_jobs, today_iso = get_daily_job_board()
    for job in daily_jobs:
        job["unlocked"] = job["min_level"] <= level

    return {
        "date": today_iso,
        "jobs": daily_jobs,
        "level": level,
        "xp": user.xp,
    }

@app.post("/jobs/work")
@limiter.limit("20/minute")
async def work_job(request: Request, job_work: JobWork, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    """Work a job to earn money"""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check job limits stored in upcoming_flight or separate JSON field if we had one
    # For this migration, we'll use a temporary approach or repurpose a field
    # Actually, we should have a 'jobs' JSON field in User model. Let's check db.py.
    # I didn't add 'jobs' to User model in db.py. I'll add it.
    
    # --- Check job limits ---
    today = datetime.now().date()
    today_key = today.isoformat()
    
    # We'll store job stats in the 'moderation' field or a new field.
    # Let's assume 'moderation' can store it for now or I'll update db.py.
    # Actually, I'll just update db.py to add 'jobs_stat' JSON field.
    
    # For now, let's assume it's in a JSON field 'jobs_stat'
    jobs_stat = user.moderation.get("jobs_stat", {}) if user.moderation else {}
    if today_key not in jobs_stat:
        jobs_stat[today_key] = {"count": 0, "earned": 0}
    
    daily_jobs = jobs_stat[today_key]
    
    if daily_jobs["count"] >= 5:
        raise HTTPException(status_code=400, detail="Maximum jobs per day reached (5)")
    
    if daily_jobs["earned"] >= MAX_DAILY_EARNINGS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum daily earning cap reached ({MAX_DAILY_EARNINGS:,})",
        )

    cap_left = MAX_DAILY_EARNINGS - daily_jobs["earned"]
    if cap_left < MIN_JOB_PAYOUT:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Not enough daily cap remaining for a shift "
                f"(minimum payout {MIN_JOB_PAYOUT:,} VND)"
            ),
        )

    last_work = user.moderation.get("last_job_work_at", 0) if user.moderation else 0
    if last_work:
        elapsed = int(datetime.now().timestamp()) - int(last_work)
        remaining = JOB_WORK_COOLDOWN_SECONDS - elapsed
        if remaining > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Job cooldown active. Try again in {remaining // 60}m {remaining % 60}s.",
            )
    
    user_dict = model_to_dict(user)
    ensure_progression(user_dict)
    daily_jobs_board, _ = get_daily_job_board()
    job_data = next((j for j in daily_jobs_board if j["name"] == job_work.job_name), None)

    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found in today's list")

    allowed, level_reason = can_work_job(user_dict, job_work.job_name)
    if not allowed:
        raise HTTPException(status_code=403, detail=level_reason)

    # Calculate random pay within range
    import random
    pay = random.randint(job_data["pay_range"][0], job_data["pay_range"][1])
    
    # Check if adding this pay would exceed cap
    if daily_jobs["earned"] + pay > MAX_DAILY_EARNINGS:
        pay = MAX_DAILY_EARNINGS - daily_jobs["earned"]
    
    # Add money
    user.money = (user.money or 0) + pay
    daily_jobs["count"] += 1
    daily_jobs["earned"] += pay
    
    if not user.moderation: user.moderation = {}
    user.moderation["jobs_stat"] = jobs_stat
    user.moderation["last_job_work_at"] = int(datetime.now().timestamp())
    
    xp_result = apply_xp(user_dict, WORK_XP)
    user.xp = xp_result["total_xp"]
    user.level = xp_result["new_level"]

    # Log transaction
    if not user.transactions: user.transactions = []
    user.transactions.append({
        "type": "job_earning",
        "job": job_work.job_name,
        "amount": pay,
        "timestamp": int(datetime.now().timestamp())
    })
    
    db.commit()
    
    return {
        "message": "Job completed successfully",
        "job": job_work.job_name,
        "earned": pay,
        "daily_jobs_completed": daily_jobs["count"],
        "daily_earned": daily_jobs["earned"],
        "remaining_jobs": 5 - daily_jobs["count"],
        "remaining_cap": MAX_DAILY_EARNINGS - daily_jobs["earned"],
        "next_shift_in_seconds": JOB_WORK_COOLDOWN_SECONDS,
        "xp_gained": WORK_XP,
        "total_xp": xp_result["total_xp"],
        "level": xp_result["new_level"],
        "leveled_up": xp_result["leveled_up"],
    }

@app.get("/jobs/status/{user_id}")
@limiter.limit("30/minute")
async def get_job_status(request: Request, user_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get job status for a user"""
    # Users can only see their own status, staff can see all
    if current_user["group"] == "user" and current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    today = datetime.now().date()
    today_key = today.isoformat()
    
    jobs_stat = user.moderation.get("jobs_stat", {}) if user.moderation else {}
    
    if today_key not in jobs_stat:
        return {
            "user_id": user_id,
            "date": today_key,
            "jobs_completed": 0,
            "earned_today": 0,
            "remaining_jobs": 5,
            "remaining_cap": MAX_DAILY_EARNINGS
        }
    
    daily_jobs = jobs_stat[today_key]
    
    return {
        "user_id": user_id,
        "date": today_key,
        "jobs_completed": daily_jobs["count"],
        "earned_today": daily_jobs["earned"],
        "remaining_jobs": 5 - daily_jobs["count"],
        "remaining_cap": MAX_DAILY_EARNINGS - daily_jobs["earned"]
    }

# Referral system endpoints
@app.post("/referral/claim")
@limiter.limit("10/minute")
async def claim_referral(request: Request, claim: ReferralClaim, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db), csrf_token: str = Depends(verify_csrf_token)):
    """Claim a referral reward"""
    user_id = current_user["user_id"]
    user = db.query(User).filter(User.id == user_id).first()
    referrer = db.query(User).filter(User.id == claim.referrer_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not referrer:
        raise HTTPException(status_code=404, detail="Referrer not found")
    
    if claim.referrer_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")
    
    # Check if user already claimed a referral (store in moderation JSON for now)
    if user.moderation.get("referred_by"):
        raise HTTPException(status_code=400, detail="Already claimed a referral")
    
    # Check if referrer has referral tracking
    referral_tracking = referrer.moderation.get("referral_tracking", {"count": 0, "users": [], "total_rewards": 0})
    
    # Check if this user was already referred by someone
    if user_id in referral_tracking.get("users", []):
        raise HTTPException(status_code=400, detail="Already referred by this user")
    
    # Set referral
    user.moderation["referred_by"] = claim.referrer_id
    
    # Add to referrer's referral list
    referral_tracking["users"].append(user_id)
    referral_tracking["count"] += 1
    
    # Give rewards
    referrer_reward = 50000
    new_user_reward = 25000
    
    referrer.money = (referrer.money or 0) + referrer_reward
    referral_tracking["total_rewards"] += referrer_reward
    referrer.moderation["referral_tracking"] = referral_tracking
    
    user.money = (user.money or 0) + new_user_reward
    
    # Log transactions
    if not referrer.transactions: referrer.transactions = []
    referrer.transactions.append({
        "type": "referral_reward",
        "amount": referrer_reward,
        "referred_user": user_id,
        "timestamp": int(datetime.now().timestamp())
    })
    
    if not user.transactions: user.transactions = []
    user.transactions.append({
        "type": "referral_bonus",
        "amount": new_user_reward,
        "referrer": claim.referrer_id,
        "timestamp": int(datetime.now().timestamp())
    })
    
    db.commit()
    
    return {
        "message": "Referral claimed successfully",
        "referrer_reward": referrer_reward,
        "new_user_reward": new_user_reward
    }

@app.get("/referral/info/{user_id}")
@limiter.limit("30/minute")
async def get_referral_info(request: Request, user_id: str, current_user: Dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get referral information for a user"""
    if current_user["group"] == "user" and current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    referral_data = user.moderation.get("referral_tracking", {"count": 0, "users": [], "total_rewards": 0})
    
    return {
        "user_id": user_id,
        "referral_count": referral_data.get("count", 0),
        "referred_users": referral_data.get("users", []),
        "total_rewards_earned": referral_data.get("total_rewards", 0),
        "referred_by": user.moderation.get("referred_by")
    }

@app.get("/referral/code/{user_id}")
@limiter.limit("30/minute")
async def get_referral_code(request: Request, user_id: str, current_user: Dict = Depends(get_current_user)):
    """Get referral code for a user"""
    if current_user["group"] == "user" and current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Simple referral code is just the user ID
    return {
        "user_id": user_id,
        "referral_code": user_id,
        "referral_link": f"{BRANDING.get('links', {}).get('website', 'https://ptfs-panel.vercel.app')}/register?ref={user_id}"
    }

# Menu endpoints
@app.get("/menu")
@limiter.limit("60/minute")
async def get_menu(db: Session = Depends(get_db)):
    menu_items = db.query(MenuItem).all()
    return [model_to_dict(item) for item in menu_items]

@app.post("/menu")
@limiter.limit("20/minute")
async def create_menu_item(
    request: Request,
    item: MenuItemInput,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    csrf_token: str = Depends(verify_csrf_token)
):
    if not AccessControl.can_modify_menu(current_user.get("group", "")):
        raise HTTPException(status_code=403, detail="Access denied: Admin permission required")
        
    new_item = MenuItem(
        name=item.name,
        description=item.description,
        category=item.category,
        price=item.price,
        image_url=item.image_url,
        available=item.available
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    return {"message": "Menu item created successfully", "item": model_to_dict(new_item)}

@app.put("/menu/{item_id}")
@limiter.limit("20/minute")
async def update_menu_item(
    request: Request,
    item_id: str,
    item: MenuItemInput,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    csrf_token: str = Depends(verify_csrf_token)
):
    if not AccessControl.can_modify_menu(current_user.get("group", "")):
        raise HTTPException(status_code=403, detail="Access denied: Admin permission required")
        
    menu_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
        
    menu_item.name = item.name
    menu_item.description = item.description
    menu_item.category = item.category
    menu_item.price = item.price
    menu_item.image_url = item.image_url
    menu_item.available = item.available
    
    db.commit()
    return {"message": "Menu item updated successfully", "item": model_to_dict(menu_item)}

@app.delete("/menu/{item_id}")
@limiter.limit("20/minute")
async def delete_menu_item(
    request: Request,
    item_id: str,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    csrf_token: str = Depends(verify_csrf_token)
):
    if not AccessControl.can_modify_menu(current_user.get("group", "")):
        raise HTTPException(status_code=403, detail="Access denied: Admin permission required")
        
    menu_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
        
    db.delete(menu_item)
    db.commit()
    
    return {"message": "Menu item deleted successfully"}

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "pid": os.getpid(),
        "file": __file__
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
