import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pydantic_core import core_schema
from dotenv import load_dotenv
import motor.motor_asyncio
from passlib.context import CryptContext
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from typing import List, Any
from datetime import datetime
from bson import ObjectId

# --- Configuration ---
QMAIL_DOMAIN = "qmail.co.in"

# --- ObjectId Helper (Updated for Pydantic v2) ---
class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler
    ) -> core_schema.CoreSchema:
        def validate(v):
            if not ObjectId.is_valid(v):
                raise ValueError("Invalid objectid")
            return ObjectId(v)

        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.no_info_plain_validator_function(validate)
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            ),
        )

# Load environment variables
load_dotenv()
MONGO_CONNECTION_STRING = os.getenv("MONGO_CONNECTION_STRING")

# --- Database Setup ---
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_CONNECTION_STRING)
db = client.qmail
users_collection = db.get_collection("users")
emails_collection = db.get_collection("emails")

# --- Security ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str):
    return pwd_context.hash(password)

# --- Email Configuration ---
conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD"),
    MAIL_FROM = os.getenv("MAIL_FROM"),
    MAIL_PORT = int(os.getenv("MAIL_PORT")),
    MAIL_SERVER = os.getenv("MAIL_SERVER"),
    MAIL_STARTTLS = False,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = False,
    VALIDATE_CERTS = False
)

# --- Application Instance ---
app = FastAPI()

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class UserCreate(BaseModel):
    username: str
    password: str
    public_key: str
    firstName: str
    lastName: str
    phoneNumber: str
    address: str
    recoveryEmail: EmailStr

class UserLogin(BaseModel):
    email: str # Changed from username
    password: str

class EmailSchema(BaseModel):
    sender_email: str
    recipient_email: str
    encrypted_body: str

class EmailInDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    sender_email: str
    recipient_email: str
    encrypted_body: str
    timestamp: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

# --- API Endpoints ---
@app.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user: UserCreate):
    full_email = f"{user.username}@{QMAIL_DOMAIN}"
    existing_user = await users_collection.find_one({"email": full_email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )
    hashed_password = hash_password(user.password)
    user_document = {
        "email": full_email, # Storing the full email
        "username": user.username, # Keep username for display/reference
        "hashed_password": hashed_password,
        "public_key": user.public_key,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "phoneNumber": user.phoneNumber,
        "address": user.address,
        "recoveryEmail": user.recoveryEmail,
    }
    await users_collection.insert_one(user_document)
    return {"message": "User registered successfully", "email": full_email}

@app.post("/login")
async def login_user(user: UserLogin):
    db_user = await users_collection.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Incorrect email or password"
        )
    return {"message": "Login successful", "email": db_user["email"]}

@app.get("/users/{email}/key")
async def get_user_public_key(email: str):
    db_user = await users_collection.find_one({"email": email})
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if "public_key" not in db_user:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Public key not found")
    return {"email": email, "public_key": db_user["public_key"]}

@app.post("/send-email")
async def send_email(email: EmailSchema):
    recipient = await users_collection.find_one({"email": email.recipient_email})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    email_document = {
        "sender_email": email.sender_email,
        "recipient_email": email.recipient_email,
        "encrypted_body": email.encrypted_body,
        "timestamp": datetime.utcnow()
    }
    await emails_collection.insert_one(email_document)
    
    recipient_recovery_email = recipient.get("recoveryEmail")
    if recipient_recovery_email:
        message = MessageSchema(
            subject=f"You have a new QMail message from {email.sender_email}!",
            recipients=[recipient_recovery_email],
            body=f"You have received a new encrypted message. Please log in to the QMail app to decrypt and view it.",
            subtype="html"
        )
        fm = FastMail(conf)
        await fm.send_message(message)
    
    return {"message": "Email has been sent and stored successfully!"}

@app.get("/inbox/{email}", response_model=List[EmailInDB])
async def get_inbox(email: str):
    emails = await emails_collection.find({"recipient_email": email}).sort("timestamp", -1).to_list(100)
    return emails

@app.get("/sent/{email}", response_model=List[EmailInDB])
async def get_sent_mail(email: str):
    emails = await emails_collection.find({"sender_email": email}).sort("timestamp", -1).to_list(100)
    return emails

@app.get("/")
def read_root():
    return {"Project": "QMail"}

