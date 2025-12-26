from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'sigmat_secret_key_2025')
JWT_ALGORITHM = "HS256"

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ==================== MODELS ====================

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    city: str
    gender: str
    age: int
    bio: Optional[str] = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    bio: Optional[str] = None
    age: Optional[int] = None

class UserSearch(BaseModel):
    city: Optional[str] = None
    gender: Optional[str] = None
    min_age: Optional[int] = 18
    max_age: Optional[int] = 60

class MessageSend(BaseModel):
    receiver_id: str
    content: str
    message_type: str = "text"  # text, image, video

class PointsPackage(BaseModel):
    amount: int
    price: float

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminUserUpdate(BaseModel):
    status: Optional[str] = None
    points: Optional[int] = None

class AdminSettings(BaseModel):
    logo_url: Optional[str] = None
    background_url: Optional[str] = None
    landing_hero_url: Optional[str] = None
    login_bg_url: Optional[str] = None
    register_bg_url: Optional[str] = None
    payment_mode: Optional[str] = None  # "free" or "paid"
    paypal_email: Optional[str] = None

# Stories Models
class StoryCreate(BaseModel):
    content: Optional[str] = ""
    media_url: Optional[str] = ""
    media_type: str = "text"  # text, image, video
    visibility: str = "public"  # public, friends
    allow_comments: bool = True

class StoryComment(BaseModel):
    story_id: str
    content: str

class BlockUser(BaseModel):
    user_id: str

class FriendRequest(BaseModel):
    receiver_id: str

# ==================== HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, is_admin: bool = False) -> str:
    payload = {
        "user_id": user_id,
        "is_admin": is_admin,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        is_admin = payload.get("is_admin", False)
        
        if is_admin:
            return {"user_id": user_id, "is_admin": True}
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("status") == "blocked":
            raise HTTPException(status_code=403, detail="User is blocked")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if not payload.get("is_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== SETTINGS ====================

@api_router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({"type": "app_settings"}, {"_id": 0})
    if not settings:
        default_settings = {
            "type": "app_settings",
            "logo_url": "https://customer-assets.emergentagent.com/job_7aedad12-b510-4b3d-9a6d-74dcee097495/artifacts/5461ncmm_SIGMAT.png",
            "background_url": "",
            "landing_hero_url": "https://images.unsplash.com/photo-1541800298525-46ec4a4e5c5c?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
            "login_bg_url": "https://images.unsplash.com/photo-1607030698714-2dc69ead9bf7?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
            "register_bg_url": "https://images.unsplash.com/photo-1562862640-61aef0574543?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
            "paypal_email": "paybey2@gmail.com",
            "payment_mode": "paid"  # "free" or "paid"
        }
        await db.settings.insert_one(default_settings)
        return default_settings
    return settings

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if user_data.age < 18 or user_data.age > 60:
        raise HTTPException(status_code=400, detail="Age must be between 18 and 60")
    
    if user_data.gender not in ["male", "female"]:
        raise HTTPException(status_code=400, detail="Gender must be 'male' or 'female'")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "city": user_data.city,
        "gender": user_data.gender,
        "age": user_data.age,
        "bio": user_data.bio or "",
        "profile_photo": "",
        "gallery": [],  # Up to 5 photos
        "points": 10,
        "status": "active",
        "blocked_users": [],  # Users this user has blocked
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": user_data.name,
            "email": user_data.email,
            "city": user_data.city,
            "gender": user_data.gender,
            "age": user_data.age,
            "bio": user_data.bio or "",
            "profile_photo": "",
            "gallery": [],
            "points": 10,
            "status": "active"
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("status") == "blocked":
        raise HTTPException(status_code=403, detail="Account is blocked")
    
    token = create_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "city": user["city"],
            "gender": user["gender"],
            "age": user["age"],
            "bio": user.get("bio", ""),
            "profile_photo": user.get("profile_photo", ""),
            "gallery": user.get("gallery", []),
            "points": user["points"],
            "status": user["status"]
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        return {"is_admin": True}
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "city": current_user["city"],
        "gender": current_user["gender"],
        "age": current_user["age"],
        "bio": current_user.get("bio", ""),
        "profile_photo": current_user.get("profile_photo", ""),
        "gallery": current_user.get("gallery", []),
        "points": current_user["points"],
        "status": current_user["status"]
    }

# ==================== PROFILE ROUTES ====================

@api_router.put("/profile")
async def update_profile(update: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have profile")
    
    update_data = {}
    if update.name:
        update_data["name"] = update.name
    if update.city:
        update_data["city"] = update.city
    if update.bio is not None:
        update_data["bio"] = update.bio
    if update.age:
        if update.age < 18 or update.age > 60:
            raise HTTPException(status_code=400, detail="Age must be between 18 and 60")
        update_data["age"] = update.age
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user

@api_router.post("/profile/photo")
async def upload_profile_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have profile")
    
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    content_type = file.content_type or "image/png"
    base64_content = base64.b64encode(content).decode('utf-8')
    data_url = f"data:{content_type};base64,{base64_content}"
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"profile_photo": data_url}}
    )
    
    return {"url": data_url, "message": "Profile photo updated"}

@api_router.post("/profile/gallery")
async def upload_gallery_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have profile")
    
    # Check gallery limit
    gallery = current_user.get("gallery", [])
    if len(gallery) >= 5:
        raise HTTPException(status_code=400, detail="Gallery full (max 5 photos)")
    
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    content_type = file.content_type or "image/png"
    base64_content = base64.b64encode(content).decode('utf-8')
    data_url = f"data:{content_type};base64,{base64_content}"
    
    photo_id = str(uuid.uuid4())
    photo_doc = {
        "id": photo_id,
        "url": data_url,
        "status": "pending",  # pending, approved, rejected
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"gallery": photo_doc}}
    )
    
    return {"photo": photo_doc, "message": "Photo added to gallery"}

@api_router.delete("/profile/gallery/{photo_id}")
async def delete_gallery_photo(photo_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have profile")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"gallery": {"id": photo_id}}}
    )
    
    return {"message": "Photo deleted from gallery"}

# ==================== USER ROUTES ====================

@api_router.post("/users/search")
async def search_users(search: UserSearch, current_user: dict = Depends(get_current_user)):
    query = {"status": "active"}
    
    # Exclude current user and blocked users from search
    if not current_user.get("is_admin"):
        blocked_users = current_user.get("blocked_users", [])
        query["id"] = {"$ne": current_user["id"], "$nin": blocked_users}
        # Also exclude users who blocked current user
        query["blocked_users"] = {"$nin": [current_user["id"]]}
    
    if search.city:
        query["city"] = {"$regex": search.city, "$options": "i"}
    
    if search.gender:
        query["gender"] = search.gender
    
    if search.min_age or search.max_age:
        query["age"] = {}
        if search.min_age:
            query["age"]["$gte"] = search.min_age
        if search.max_age:
            query["age"]["$lte"] = search.max_age
    
    users = await db.users.find(query, {"_id": 0, "password": 0, "blocked_users": 0}).to_list(100)
    return users

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "blocked_users": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if blocked
    if not current_user.get("is_admin"):
        blocked_by_user = await db.users.find_one({"id": user_id, "blocked_users": current_user["id"]})
        if blocked_by_user:
            raise HTTPException(status_code=403, detail="You are blocked by this user")
        
        if user_id in current_user.get("blocked_users", []):
            raise HTTPException(status_code=403, detail="You have blocked this user")
    
    return user

@api_router.post("/users/block")
async def block_user(block: BlockUser, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot block users this way")
    
    if block.user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    # Check if user exists
    target_user = await db.users.find_one({"id": block.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add to blocked list
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$addToSet": {"blocked_users": block.user_id}}
    )
    
    return {"message": "User blocked"}

@api_router.post("/users/unblock")
async def unblock_user(block: BlockUser, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot unblock users this way")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"blocked_users": block.user_id}}
    )
    
    return {"message": "User unblocked"}

@api_router.get("/users/blocked/list")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have blocked list")
    
    blocked_ids = current_user.get("blocked_users", [])
    if not blocked_ids:
        return []
    
    blocked_users = await db.users.find(
        {"id": {"$in": blocked_ids}},
        {"_id": 0, "password": 0, "blocked_users": 0}
    ).to_list(100)
    
    return blocked_users

@api_router.delete("/users/contact/{user_id}")
async def delete_contact(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete all messages with a user (remove from contacts)"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot delete contacts")
    
    # Delete all messages between users
    await db.messages.delete_many({
        "$or": [
            {"sender_id": current_user["id"], "receiver_id": user_id},
            {"sender_id": user_id, "receiver_id": current_user["id"]}
        ]
    })
    
    return {"message": "Contact and messages deleted"}

# ==================== FRIEND REQUEST ROUTES ====================

@api_router.post("/friends/request")
async def send_friend_request(request: FriendRequest, current_user: dict = Depends(get_current_user)):
    """Send a friend request to another user"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot send friend requests")
    
    if request.receiver_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    # Check if receiver exists
    receiver = await db.users.find_one({"id": request.receiver_id})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if blocked
    if current_user["id"] in receiver.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You are blocked by this user")
    
    if request.receiver_id in current_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You have blocked this user")
    
    # Check if already friends
    existing_friendship = await db.friendships.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": request.receiver_id},
            {"user1_id": request.receiver_id, "user2_id": current_user["id"]}
        ]
    })
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Already friends")
    
    # Check if request already exists
    existing_request = await db.friend_requests.find_one({
        "sender_id": current_user["id"],
        "receiver_id": request.receiver_id,
        "status": "pending"
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="Friend request already sent")
    
    # Check if there's a pending request from the other user
    reverse_request = await db.friend_requests.find_one({
        "sender_id": request.receiver_id,
        "receiver_id": current_user["id"],
        "status": "pending"
    })
    if reverse_request:
        # Auto-accept if there's a reverse request
        await db.friend_requests.update_one(
            {"id": reverse_request["id"]},
            {"$set": {"status": "accepted"}}
        )
        # Create friendship
        friendship_id = str(uuid.uuid4())
        await db.friendships.insert_one({
            "id": friendship_id,
            "user1_id": request.receiver_id,
            "user2_id": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"message": "You are now friends!", "status": "accepted"}
    
    # Create new friend request
    request_id = str(uuid.uuid4())
    request_doc = {
        "id": request_id,
        "sender_id": current_user["id"],
        "receiver_id": request.receiver_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.friend_requests.insert_one(request_doc)
    
    return {"message": "Friend request sent", "request_id": request_id}

@api_router.get("/friends/requests/received")
async def get_received_friend_requests(current_user: dict = Depends(get_current_user)):
    """Get all pending friend requests received"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have friends")
    
    requests = await db.friend_requests.find({
        "receiver_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Add sender info
    result = []
    for req in requests:
        sender = await db.users.find_one({"id": req["sender_id"]}, {"_id": 0, "password": 0, "blocked_users": 0})
        if sender:
            req["sender"] = sender
            result.append(req)
    
    return result

@api_router.get("/friends/requests/sent")
async def get_sent_friend_requests(current_user: dict = Depends(get_current_user)):
    """Get all pending friend requests sent"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have friends")
    
    requests = await db.friend_requests.find({
        "sender_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Add receiver info
    result = []
    for req in requests:
        receiver = await db.users.find_one({"id": req["receiver_id"]}, {"_id": 0, "password": 0, "blocked_users": 0})
        if receiver:
            req["receiver"] = receiver
            result.append(req)
    
    return result

@api_router.post("/friends/requests/{request_id}/accept")
async def accept_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Accept a friend request"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have friends")
    
    request = await db.friend_requests.find_one({
        "id": request_id,
        "receiver_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0})
    
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    # Update request status
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted"}}
    )
    
    # Create friendship
    friendship_id = str(uuid.uuid4())
    await db.friendships.insert_one({
        "id": friendship_id,
        "user1_id": request["sender_id"],
        "user2_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Friend request accepted"}

@api_router.post("/friends/requests/{request_id}/reject")
async def reject_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Reject a friend request"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have friends")
    
    request = await db.friend_requests.find_one({
        "id": request_id,
        "receiver_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0})
    
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected"}}
    )
    
    return {"message": "Friend request rejected"}

@api_router.delete("/friends/requests/{request_id}/cancel")
async def cancel_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a sent friend request"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have friends")
    
    result = await db.friend_requests.delete_one({
        "id": request_id,
        "sender_id": current_user["id"],
        "status": "pending"
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    return {"message": "Friend request cancelled"}

@api_router.get("/friends/list")
async def get_friends_list(current_user: dict = Depends(get_current_user)):
    """Get all friends"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have friends")
    
    friendships = await db.friendships.find({
        "$or": [
            {"user1_id": current_user["id"]},
            {"user2_id": current_user["id"]}
        ]
    }, {"_id": 0}).to_list(1000)
    
    friends = []
    for friendship in friendships:
        friend_id = friendship["user2_id"] if friendship["user1_id"] == current_user["id"] else friendship["user1_id"]
        friend = await db.users.find_one({"id": friend_id}, {"_id": 0, "password": 0, "blocked_users": 0})
        if friend:
            friend["friendship_id"] = friendship["id"]
            friends.append(friend)
    
    return friends

@api_router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a friend"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot have friends")
    
    result = await db.friendships.delete_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": friend_id},
            {"user1_id": friend_id, "user2_id": current_user["id"]}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    return {"message": "Friend removed"}

@api_router.get("/friends/check/{user_id}")
async def check_friendship_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Check friendship status with another user"""
    if current_user.get("is_admin"):
        return {"status": "admin"}
    
    # Check if friends
    friendship = await db.friendships.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]
    })
    if friendship:
        return {"status": "friends", "friendship_id": friendship["id"]}
    
    # Check if I sent a request
    sent_request = await db.friend_requests.find_one({
        "sender_id": current_user["id"],
        "receiver_id": user_id,
        "status": "pending"
    })
    if sent_request:
        return {"status": "request_sent", "request_id": sent_request["id"]}
    
    # Check if I received a request
    received_request = await db.friend_requests.find_one({
        "sender_id": user_id,
        "receiver_id": current_user["id"],
        "status": "pending"
    })
    if received_request:
        return {"status": "request_received", "request_id": received_request["id"]}
    
    return {"status": "none"}

# ==================== CHAT ROUTES ====================

@api_router.post("/chat/send")
async def send_message(message: MessageSend, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot send chat messages")
    
    # Check if users are friends
    friendship = await db.friendships.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": message.receiver_id},
            {"user1_id": message.receiver_id, "user2_id": current_user["id"]}
        ]
    })
    if not friendship:
        raise HTTPException(status_code=403, detail="Morate biti prijatelji da biste slali poruke. Pošaljite zahtjev za prijateljstvo.")
    
    # Check payment mode
    settings = await db.settings.find_one({"type": "app_settings"}, {"_id": 0})
    payment_mode = settings.get("payment_mode", "paid") if settings else "paid"
    
    # Check if user has enough points (only in paid mode)
    if payment_mode == "paid" and current_user["points"] < 1:
        raise HTTPException(status_code=402, detail="Not enough points. Please buy more points.")
    
    # Check if receiver exists
    receiver = await db.users.find_one({"id": message.receiver_id}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    if receiver.get("status") == "blocked":
        raise HTTPException(status_code=400, detail="Cannot message blocked user")
    
    # Check if blocked
    if current_user["id"] in receiver.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You are blocked by this user")
    
    if message.receiver_id in current_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You have blocked this user")
    
    # Deduct 1 point only in paid mode
    if payment_mode == "paid":
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"points": -1}}
        )
    
    # Create message
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "sender_id": current_user["id"],
        "receiver_id": message.receiver_id,
        "content": message.content,
        "message_type": message.message_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
        "deleted_by": []
    }
    
    await db.messages.insert_one(message_doc)
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    return {
        "message": "Message sent",
        "message_id": message_id,
        "remaining_points": updated_user["points"]
    }

@api_router.post("/chat/send-media")
async def send_media_message(
    receiver_id: str = Form(...),
    message_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot send chat messages")
    
    # Check if users are friends
    friendship = await db.friendships.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": receiver_id},
            {"user1_id": receiver_id, "user2_id": current_user["id"]}
        ]
    })
    if not friendship:
        raise HTTPException(status_code=403, detail="Morate biti prijatelji da biste slali poruke.")
    
    if current_user["points"] < 1:
        raise HTTPException(status_code=402, detail="Not enough points")
    
    receiver = await db.users.find_one({"id": receiver_id}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    # Check blocks
    if current_user["id"] in receiver.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You are blocked by this user")
    
    if receiver_id in current_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You have blocked this user")
    
    content = await file.read()
    max_size = 10 * 1024 * 1024  # 10MB for videos, 5MB for images
    if message_type == "video" and len(content) > max_size:
        raise HTTPException(status_code=400, detail="Video too large (max 10MB)")
    if message_type == "image" and len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    
    content_type = file.content_type or "application/octet-stream"
    base64_content = base64.b64encode(content).decode('utf-8')
    data_url = f"data:{content_type};base64,{base64_content}"
    
    # Deduct point
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"points": -1}}
    )
    
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "sender_id": current_user["id"],
        "receiver_id": receiver_id,
        "content": data_url,
        "message_type": message_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
        "deleted_by": []
    }
    
    await db.messages.insert_one(message_doc)
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    return {
        "message": "Media sent",
        "message_id": message_id,
        "remaining_points": updated_user["points"]
    }

@api_router.delete("/chat/message/{message_id}")
async def delete_message(message_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot delete chat messages")
    
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only sender can delete their message
    if message["sender_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    
    # Soft delete - mark as deleted
    await db.messages.update_one(
        {"id": message_id},
        {"$addToSet": {"deleted_by": current_user["id"]}}
    )
    
    return {"message": "Message deleted"}

@api_router.get("/chat/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot access chat")
    
    user_id = current_user["id"]
    blocked_users = current_user.get("blocked_users", [])
    
    # Get all messages involving current user (not deleted by them)
    messages = await db.messages.find({
        "$or": [
            {"sender_id": user_id},
            {"receiver_id": user_id}
        ],
        "deleted_by": {"$nin": [user_id]}
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    conversations = {}
    for msg in messages:
        partner_id = msg["receiver_id"] if msg["sender_id"] == user_id else msg["sender_id"]
        
        # Skip blocked users
        if partner_id in blocked_users:
            continue
        
        if partner_id not in conversations:
            partner = await db.users.find_one({"id": partner_id}, {"_id": 0, "password": 0, "blocked_users": 0})
            if partner:
                # Check if partner blocked current user
                partner_full = await db.users.find_one({"id": partner_id}, {"_id": 0})
                if user_id in partner_full.get("blocked_users", []):
                    continue
                
                unread = await db.messages.count_documents({
                    "sender_id": partner_id,
                    "receiver_id": user_id,
                    "read": False,
                    "deleted_by": {"$nin": [user_id]}
                })
                conversations[partner_id] = {
                    "user_id": partner_id,
                    "user_name": partner["name"],
                    "user_city": partner["city"],
                    "user_gender": partner["gender"],
                    "user_age": partner["age"],
                    "profile_photo": partner.get("profile_photo", ""),
                    "last_message": msg["content"] if msg["message_type"] == "text" else f"[{msg['message_type']}]",
                    "last_message_time": msg["created_at"],
                    "last_message_type": msg["message_type"],
                    "unread_count": unread
                }
    
    return list(conversations.values())

@api_router.get("/chat/{partner_id}")
async def get_chat_messages(partner_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot access chat")
    
    user_id = current_user["id"]
    
    # Mark messages as read
    await db.messages.update_many(
        {"sender_id": partner_id, "receiver_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    # Get messages (excluding deleted ones)
    messages = await db.messages.find({
        "$or": [
            {"sender_id": user_id, "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": user_id}
        ],
        "deleted_by": {"$nin": [user_id]}
    }, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    sender = await db.users.find_one({"id": user_id}, {"_id": 0})
    receiver = await db.users.find_one({"id": partner_id}, {"_id": 0})
    
    result = []
    for msg in messages:
        msg["sender_name"] = sender["name"] if msg["sender_id"] == user_id else (receiver["name"] if receiver else "Unknown")
        msg["receiver_name"] = receiver["name"] if msg["receiver_id"] == partner_id else sender["name"]
        result.append(msg)
    
    return result

# ==================== POINTS ROUTES ====================

POINTS_PACKAGES = [
    {"amount": 100, "price": 25.00},
    {"amount": 150, "price": 37.50},
    {"amount": 200, "price": 50.00},
    {"amount": 250, "price": 62.50},
    {"amount": 300, "price": 75.00},
    {"amount": 350, "price": 87.50},
    {"amount": 400, "price": 100.00},
    {"amount": 450, "price": 112.50},
    {"amount": 500, "price": 125.00},
]

@api_router.get("/points/packages")
async def get_packages():
    return POINTS_PACKAGES

@api_router.post("/points/purchase")
async def purchase_points(package: PointsPackage, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot purchase points")
    
    valid_package = None
    for p in POINTS_PACKAGES:
        if p["amount"] == package.amount:
            valid_package = p
            break
    
    if not valid_package:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    payment_id = str(uuid.uuid4())
    payment_doc = {
        "id": payment_id,
        "user_id": current_user["id"],
        "amount": package.amount,
        "price": valid_package["price"],
        "status": "pending",
        "paypal_email": "paybey2@gmail.com",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.insert_one(payment_doc)
    
    return {
        "payment_id": payment_id,
        "amount": package.amount,
        "price": valid_package["price"],
        "paypal_email": "paybey2@gmail.com",
        "status": "pending"
    }

@api_router.post("/points/confirm/{payment_id}")
async def confirm_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot confirm payments")
    
    payment = await db.payments.find_one({"id": payment_id, "user_id": current_user["id"]}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] == "completed":
        raise HTTPException(status_code=400, detail="Payment already completed")
    
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "completed"}}
    )
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"points": payment["amount"]}}
    )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    return {
        "message": "Payment confirmed",
        "points_added": payment["amount"],
        "new_balance": updated_user["points"]
    }

# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/login")
async def admin_login(credentials: AdminLogin):
    if credentials.username == "admin" and credentials.password == "admin2025":
        token = create_token("admin", is_admin=True)
        return {"token": token, "is_admin": True}
    raise HTTPException(status_code=401, detail="Invalid admin credentials")

@api_router.get("/admin/users")
async def admin_get_users(admin: dict = Depends(get_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, update: AdminUserUpdate, admin: dict = Depends(get_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {}
    if update.status:
        if update.status not in ["active", "paused", "blocked"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        update_data["status"] = update.status
    
    if update.points is not None:
        update_data["points"] = update.points
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@api_router.post("/admin/users/{user_id}/add-points")
async def admin_add_points(user_id: str, points: int, admin: dict = Depends(get_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"points": points}}
    )
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return {"message": f"Added {points} points", "user": updated_user}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_admin)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.messages.delete_many({
        "$or": [{"sender_id": user_id}, {"receiver_id": user_id}]
    })
    
    return {"message": "User deleted"}

@api_router.get("/admin/settings")
async def admin_get_settings(admin: dict = Depends(get_admin)):
    settings = await db.settings.find_one({"type": "app_settings"}, {"_id": 0})
    if not settings:
        default_settings = {
            "type": "app_settings",
            "logo_url": "https://customer-assets.emergentagent.com/job_7aedad12-b510-4b3d-9a6d-74dcee097495/artifacts/5461ncmm_SIGMAT.png",
            "background_url": ""
        }
        await db.settings.insert_one(default_settings)
        return default_settings
    return settings

@api_router.put("/admin/settings")
async def admin_update_settings(settings: AdminSettings, admin: dict = Depends(get_admin)):
    update_data = {}
    if settings.logo_url is not None:
        update_data["logo_url"] = settings.logo_url
    if settings.background_url is not None:
        update_data["background_url"] = settings.background_url
    if settings.landing_hero_url is not None:
        update_data["landing_hero_url"] = settings.landing_hero_url
    if settings.login_bg_url is not None:
        update_data["login_bg_url"] = settings.login_bg_url
    if settings.register_bg_url is not None:
        update_data["register_bg_url"] = settings.register_bg_url
    if settings.payment_mode is not None:
        update_data["payment_mode"] = settings.payment_mode
    if settings.paypal_email is not None:
        update_data["paypal_email"] = settings.paypal_email
    
    if update_data:
        await db.settings.update_one(
            {"type": "app_settings"},
            {"$set": update_data},
            upsert=True
        )
    
    return await db.settings.find_one({"type": "app_settings"}, {"_id": 0})

@api_router.post("/admin/broadcast")
async def admin_send_broadcast(message: dict, admin: dict = Depends(get_admin)):
    """Send a broadcast message/notification to all users with optional image/video"""
    broadcast_id = str(uuid.uuid4())
    broadcast_doc = {
        "id": broadcast_id,
        "title": message.get("title", "Obavijest"),
        "content": message.get("content", ""),
        "image_url": message.get("image_url", ""),
        "video_url": message.get("video_url", ""),
        "type": message.get("type", "info"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True
    }
    await db.broadcasts.insert_one(broadcast_doc)
    return {"message": "Broadcast sent", "id": broadcast_id}

@api_router.post("/admin/upload")
async def admin_upload_file(file: UploadFile = File(...), admin: dict = Depends(get_admin)):
    content = await file.read()
    content_type = file.content_type or "image/png"
    base64_content = base64.b64encode(content).decode('utf-8')
    data_url = f"data:{content_type};base64,{base64_content}"
    return {"url": data_url, "filename": file.filename}

@api_router.get("/admin/payments")
async def admin_get_payments(admin: dict = Depends(get_admin)):
    payments = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return payments

@api_router.get("/admin/broadcasts")
async def admin_get_broadcasts(admin: dict = Depends(get_admin)):
    """Get all broadcasts"""
    broadcasts = await db.broadcasts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return broadcasts

@api_router.delete("/admin/broadcasts/{broadcast_id}")
async def admin_delete_broadcast(broadcast_id: str, admin: dict = Depends(get_admin)):
    """Delete a broadcast"""
    result = await db.broadcasts.delete_one({"id": broadcast_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return {"message": "Broadcast deleted"}

@api_router.post("/admin/send-user-message")
async def admin_send_user_message(data: dict, admin: dict = Depends(get_admin)):
    """Send a direct message to a specific user from admin"""
    user_id = data.get("user_id")
    content = data.get("content")
    image_url = data.get("image_url")
    
    if not user_id or (not content and not image_url):
        raise HTTPException(status_code=400, detail="user_id and content or image required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    notification_id = str(uuid.uuid4())
    notification_doc = {
        "id": notification_id,
        "user_id": user_id,
        "title": "Poruka od Admina",
        "content": content or "",
        "image_url": image_url or "",
        "type": "admin_message",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    return {"message": "Message sent to user", "id": notification_id}

@api_router.delete("/chat/conversation/{partner_id}")
async def delete_conversation(partner_id: str, current_user: dict = Depends(get_current_user)):
    """Delete all messages in a conversation (keeps friendship)"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot delete conversations")
    
    # Delete all messages between users
    await db.messages.delete_many({
        "$or": [
            {"sender_id": current_user["id"], "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": current_user["id"]}
        ]
    })
    
    return {"message": "Conversation deleted"}

@api_router.get("/notifications")
async def get_user_notifications(current_user: dict = Depends(get_current_user)):
    """Get notifications for current user"""
    if current_user.get("is_admin"):
        return []
    
    # Get personal notifications
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Get active broadcasts
    broadcasts = await db.broadcasts.find(
        {"active": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    # Get pending friend requests count
    pending_requests = await db.friend_requests.count_documents({
        "receiver_id": current_user["id"],
        "status": "pending"
    })
    
    return {
        "notifications": notifications,
        "broadcasts": broadcasts,
        "pending_friend_requests": pending_requests
    }

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.get("/admin/users/{user_id}/profile")
async def admin_get_user_profile(user_id: str, admin: dict = Depends(get_admin)):
    """Get full user profile for admin review"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.get("/admin/pending-images")
async def admin_get_pending_images(admin: dict = Depends(get_admin)):
    """Get all users with pending images for moderation"""
    users_with_pending = await db.users.find(
        {"gallery": {"$elemMatch": {"status": "pending"}}},
        {"_id": 0, "password": 0, "blocked_users": 0}
    ).to_list(1000)
    
    result = []
    for user in users_with_pending:
        pending_images = [img for img in user.get("gallery", []) if img.get("status") == "pending"]
        if pending_images:
            result.append({
                "user_id": user["id"],
                "user_name": user["name"],
                "user_email": user["email"],
                "pending_images": pending_images
            })
    return result

@api_router.put("/admin/images/{user_id}/{photo_id}/approve")
async def admin_approve_image(user_id: str, photo_id: str, admin: dict = Depends(get_admin)):
    """Approve a user's gallery image"""
    result = await db.users.update_one(
        {"id": user_id, "gallery.id": photo_id},
        {"$set": {"gallery.$.status": "approved"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": "Image approved"}

@api_router.put("/admin/images/{user_id}/{photo_id}/reject")
async def admin_reject_image(user_id: str, photo_id: str, admin: dict = Depends(get_admin)):
    """Reject and remove a user's gallery image"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$pull": {"gallery": {"id": photo_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": "Image rejected and removed"}

@api_router.put("/admin/profile-photo/{user_id}/approve")
async def admin_approve_profile_photo(user_id: str, admin: dict = Depends(get_admin)):
    """Approve user's profile photo"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"profile_photo_status": "approved"}}
    )
    return {"message": "Profile photo approved"}

@api_router.put("/admin/profile-photo/{user_id}/reject")
async def admin_reject_profile_photo(user_id: str, admin: dict = Depends(get_admin)):
    """Reject and remove user's profile photo"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"profile_photo": "", "profile_photo_status": "none"}}
    )
    return {"message": "Profile photo rejected and removed"}

# ==================== STORIES ROUTES ====================

@api_router.post("/stories")
async def create_story(story: StoryCreate, current_user: dict = Depends(get_current_user)):
    """Create a new story"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot create stories")
    
    story_id = str(uuid.uuid4())
    story_doc = {
        "id": story_id,
        "user_id": current_user["id"],
        "content": story.content,
        "media_url": story.media_url,
        "media_type": story.media_type,
        "visibility": story.visibility,
        "allow_comments": story.allow_comments,
        "likes": [],
        "shares": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stories.insert_one(story_doc)
    return {"message": "Story created", "story_id": story_id}

@api_router.post("/stories/upload")
async def upload_story_media(
    media_type: str = Form(...),
    visibility: str = Form("public"),
    allow_comments: bool = Form(True),
    content: str = Form(""),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a story with media (image or video)"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot create stories")
    
    file_content = await file.read()
    max_size = 50 * 1024 * 1024  # 50MB for videos
    if len(file_content) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    content_type = file.content_type or "application/octet-stream"
    base64_content = base64.b64encode(file_content).decode('utf-8')
    data_url = f"data:{content_type};base64,{base64_content}"
    
    story_id = str(uuid.uuid4())
    story_doc = {
        "id": story_id,
        "user_id": current_user["id"],
        "content": content,
        "media_url": data_url,
        "media_type": media_type,
        "visibility": visibility,
        "allow_comments": allow_comments,
        "likes": [],
        "shares": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stories.insert_one(story_doc)
    return {"message": "Story created", "story_id": story_id}

@api_router.get("/stories")
async def get_stories(current_user: dict = Depends(get_current_user)):
    """Get all visible stories for the feed"""
    if current_user.get("is_admin"):
        return []
    
    user_id = current_user["id"]
    
    # Get user's friends
    friendships = await db.friendships.find({
        "$or": [
            {"user1_id": user_id},
            {"user2_id": user_id}
        ]
    }, {"_id": 0}).to_list(1000)
    
    friend_ids = []
    for f in friendships:
        friend_ids.append(f["user2_id"] if f["user1_id"] == user_id else f["user1_id"])
    
    # Get stories: public stories OR friends-only from friends OR own stories
    stories = await db.stories.find({
        "$or": [
            {"visibility": "public"},
            {"visibility": "friends", "user_id": {"$in": friend_ids}},
            {"user_id": user_id}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add user info to each story
    result = []
    for story in stories:
        author = await db.users.find_one({"id": story["user_id"]}, {"_id": 0, "password": 0, "blocked_users": 0})
        if author:
            story["author"] = {
                "id": author["id"],
                "name": author["name"],
                "profile_photo": author.get("profile_photo", "")
            }
            story["likes_count"] = len(story.get("likes", []))
            story["liked_by_me"] = user_id in story.get("likes", [])
            
            # Get comments count
            comments_count = await db.story_comments.count_documents({"story_id": story["id"]})
            story["comments_count"] = comments_count
            
            result.append(story)
    
    return result

@api_router.get("/stories/my")
async def get_my_stories(current_user: dict = Depends(get_current_user)):
    """Get current user's stories"""
    if current_user.get("is_admin"):
        return []
    
    stories = await db.stories.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for story in stories:
        story["likes_count"] = len(story.get("likes", []))
        story["liked_by_me"] = current_user["id"] in story.get("likes", [])
        comments_count = await db.story_comments.count_documents({"story_id": story["id"]})
        story["comments_count"] = comments_count
    
    return stories

@api_router.get("/stories/user/{user_id}")
async def get_user_stories(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get stories of a specific user"""
    if current_user.get("is_admin"):
        return []
    
    # Check if friends
    is_friend = await db.friendships.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]
    })
    
    # Filter by visibility
    query = {"user_id": user_id}
    if user_id != current_user["id"] and not is_friend:
        query["visibility"] = "public"
    
    stories = await db.stories.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    author = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "blocked_users": 0})
    
    for story in stories:
        if author:
            story["author"] = {
                "id": author["id"],
                "name": author["name"],
                "profile_photo": author.get("profile_photo", "")
            }
        story["likes_count"] = len(story.get("likes", []))
        story["liked_by_me"] = current_user["id"] in story.get("likes", [])
        comments_count = await db.story_comments.count_documents({"story_id": story["id"]})
        story["comments_count"] = comments_count
    
    return stories

@api_router.post("/stories/{story_id}/like")
async def like_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Like a story"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot like stories")
    
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    user_id = current_user["id"]
    if user_id in story.get("likes", []):
        # Unlike
        await db.stories.update_one(
            {"id": story_id},
            {"$pull": {"likes": user_id}}
        )
        return {"message": "Story unliked", "liked": False}
    else:
        # Like
        await db.stories.update_one(
            {"id": story_id},
            {"$addToSet": {"likes": user_id}}
        )
        return {"message": "Story liked", "liked": True}

@api_router.post("/stories/{story_id}/share")
async def share_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Share a story (increment share count)"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot share stories")
    
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    await db.stories.update_one(
        {"id": story_id},
        {"$inc": {"shares": 1}}
    )
    return {"message": "Story shared"}

@api_router.post("/stories/{story_id}/comment")
async def comment_story(story_id: str, comment: StoryComment, current_user: dict = Depends(get_current_user)):
    """Comment on a story"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot comment on stories")
    
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if not story.get("allow_comments", True):
        raise HTTPException(status_code=403, detail="Comments are disabled for this story")
    
    comment_id = str(uuid.uuid4())
    comment_doc = {
        "id": comment_id,
        "story_id": story_id,
        "user_id": current_user["id"],
        "content": comment.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.story_comments.insert_one(comment_doc)
    return {"message": "Comment added", "comment_id": comment_id}

@api_router.get("/stories/{story_id}/comments")
async def get_story_comments(story_id: str, current_user: dict = Depends(get_current_user)):
    """Get comments for a story"""
    comments = await db.story_comments.find(
        {"story_id": story_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add user info
    result = []
    for c in comments:
        author = await db.users.find_one({"id": c["user_id"]}, {"_id": 0, "password": 0})
        if author:
            c["author"] = {
                "id": author["id"],
                "name": author["name"],
                "profile_photo": author.get("profile_photo", "")
            }
            result.append(c)
    
    return result

@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a story"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot delete user stories")
    
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own stories")
    
    await db.stories.delete_one({"id": story_id})
    await db.story_comments.delete_many({"story_id": story_id})
    
    return {"message": "Story deleted"}

@api_router.delete("/stories/comment/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a comment"""
    if current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin cannot delete comments")
    
    comment = await db.story_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # User can delete their own comment, or story owner can delete any comment
    story = await db.stories.find_one({"id": comment["story_id"]})
    if comment["user_id"] != current_user["id"] and story["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You cannot delete this comment")
    
    await db.story_comments.delete_one({"id": comment_id})
    return {"message": "Comment deleted"}

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "SIGMAT API - Dating & Chat Platform"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
