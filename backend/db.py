from sqlalchemy import Column, Integer, String, Boolean, BigInteger, Float, DateTime, ForeignKey, JSON, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import uuid
from config import settings

Base = declarative_base()

def model_to_dict(model):
    """Convert a SQLAlchemy model instance to a dictionary"""
    if not model:
        return None
    d = {}
    for column in model.__table__.columns:
        d[column.name] = getattr(model, column.name)
    return d

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nickname = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    pwdh = Column(String)
    ip_address = Column(String)
    group = Column(String, default="user")
    money = Column(BigInteger, default=0)
    flightmiles = Column(BigInteger, default=0)
    xp = Column(BigInteger, default=0)
    level = Column(Integer, default=1)
    achievement = Column(JSON, default=list)
    createdAt = Column(BigInteger, default=lambda: int(datetime.now().timestamp()))
    lastLogin = Column(BigInteger, default=lambda: int(datetime.now().timestamp()))
    discordID = Column(BigInteger, unique=True, index=True)
    banned = Column(Boolean, default=False)
    verified = Column(Boolean, default=False)
    upcoming_flight = Column(JSON, nullable=True)
    moderation = Column(JSON, default=dict)
    transactions = Column(JSON, default=list)

class Flight(Base):
    __tablename__ = "flights"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    flight = Column(String)
    aircraft = Column(String)
    pax = Column(Integer, default=0)
    status = Column(String, default="scheduled")
    flight_miles_reward = Column(Integer, default=0)
    price = Column(JSON, default=dict)
    seating = Column(JSON, default=list) # Store as JSON list for simplicity in this migration
    
    # Departure info
    departure_icao = Column(String)
    departure_name = Column(String)
    departure_ingame_icao = Column(String)
    departure_timestamp = Column(BigInteger)
    
    # Arrival info
    arrival_icao = Column(String)
    arrival_name = Column(String)
    arrival_ingame_icao = Column(String)
    arrival_timestamp = Column(BigInteger)

class Seatmap(Base):
    __tablename__ = "seatmaps"
    aircraft_type = Column(String, primary_key=True)
    config = Column(JSON)

class Blacklist(Base):
    __tablename__ = "blacklist"
    discord_id = Column(BigInteger, primary_key=True)
    reason = Column(Text)
    blacklisted_at = Column(BigInteger)
    blacklisted_by = Column(String)

class MenuItem(Base):
    __tablename__ = "menu"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    description = Column(Text)
    category = Column(String)
    price = Column(Integer)
    image_url = Column(String)
    available = Column(Boolean, default=True)

# Database Setup
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def load_json(model, db_session):
    if not model:
        return None
    return model_to_dict(model)

def save_json(model, data, db_session):
    for key, value in data.items():
        if hasattr(model, key):
            setattr(model, key, value)
    db_session.commit()
    return model_to_dict(model)
    """Get a synchronous database session (for non-FastAPI use cases)"""
    return SessionLocal()
