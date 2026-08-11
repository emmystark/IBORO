#!/usr/bin/env python3
"""
Test script to verify conversation persistence and admin features
Run this after starting the backend: python3 test_conversations.py
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:3000"
STARK_USER_ID = "stark"
ADMIN_USER_ID = "admin"

def test_user_conversations():
    """Test that user can see their conversations"""
    print("\n=== TEST 1: User Can See Their Conversations ===")
    headers = {
        "X-User-ID": STARK_USER_ID,
        "Content-Type": "application/json"
    }
    
    response = requests.get(f"{BASE_URL}/api/conversations", headers=headers)
    if response.status_code == 200:
        conversations = response.json()
        print(f"✓ User '{STARK_USER_ID}' has {len(conversations)} conversations")
        if conversations:
            print(f"  Most recent: {conversations[0]['title']} (created {conversations[0]['createdAt']})")
            if len(conversations) > 1:
                print(f"  Oldest: {conversations[-1]['title']} (created {conversations[-1]['createdAt']})")
        return True
    else:
        print(f"✗ Failed to get conversations: {response.status_code}")
        print(f"  Response: {response.text}")
        return False

def test_create_conversation():
    """Test creating a new conversation"""
    print("\n=== TEST 2: Create New Conversation ===")
    headers = {
        "X-User-ID": STARK_USER_ID,
        "Content-Type": "application/json"
    }
    
    data = {
        "id": f"test_conv_{datetime.now().timestamp()}",
        "title": f"Test Conversation - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    }
    
    response = requests.post(f"{BASE_URL}/api/conversations", headers=headers, json=data)
    if response.status_code == 200:
        new_conv = response.json()
        print(f"✓ Created conversation: {new_conv['title']}")
        print(f"  ID: {new_conv['id']}")
        print(f"  user_id: {new_conv.get('user_id', 'MISSING!')}")
        return new_conv['id']
    else:
        print(f"✗ Failed to create conversation: {response.status_code}")
        print(f"  Response: {response.text}")
        return None

def test_save_message(conv_id):
    """Test saving a message to conversation"""
    print(f"\n=== TEST 3: Save Message to Conversation ===")
    headers = {
        "X-User-ID": STARK_USER_ID,
        "Content-Type": "application/json"
    }
    
    message = {
        "id": "test_msg_1",
        "role": "user",
        "content": "This is a test message",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "sources": []
    }
    
    response = requests.post(
        f"{BASE_URL}/api/conversations/{conv_id}/messages",
        headers=headers,
        json=message
    )
    
    if response.status_code == 200:
        print(f"✓ Message saved successfully")
        return True
    else:
        print(f"✗ Failed to save message: {response.status_code}")
        print(f"  Response: {response.text}")
        return False

def test_admin_view_user_conversations():
    """Test that admin can see all user conversations including deleted ones"""
    print(f"\n=== TEST 4: Admin View User Conversations (with deleted) ===")
    headers = {
        "X-User-ID": ADMIN_USER_ID,
        "Content-Type": "application/json"
    }
    
    response = requests.get(
        f"{BASE_URL}/api/admin/users/{STARK_USER_ID}/conversations?include_deleted=true",
        headers=headers
    )
    
    if response.status_code == 200:
        conversations = response.json()
        print(f"✓ Admin can see {len(conversations)} conversations for user '{STARK_USER_ID}'")
        if conversations:
            print(f"  Most recent: {conversations[0]['title']}")
            print(f"  Sorted by recency: {conversations[0]['createdAt'] > conversations[-1]['createdAt']}")
        return True
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  Response: {response.text}")
        return False

def test_sorting():
    """Test that conversations are sorted by most recent first"""
    print(f"\n=== TEST 5: Conversation Sorting (Most Recent First) ===")
    headers = {
        "X-User-ID": STARK_USER_ID,
        "Content-Type": "application/json"
    }
    
    response = requests.get(f"{BASE_URL}/api/conversations", headers=headers)
    if response.status_code == 200:
        conversations = response.json()
        
        if len(conversations) >= 2:
            first_date = datetime.fromisoformat(conversations[0]['createdAt'].replace('Z', '+00:00'))
            second_date = datetime.fromisoformat(conversations[1]['createdAt'].replace('Z', '+00:00'))
            
            is_sorted = first_date >= second_date
            status = "✓" if is_sorted else "✗"
            print(f"{status} Conversations are {'correctly' if is_sorted else 'incorrectly'} sorted")
            print(f"  First: {conversations[0]['title']} ({first_date})")
            print(f"  Second: {conversations[1]['title']} ({second_date})")
        else:
            print(f"⚠ Need at least 2 conversations to test sorting (have {len(conversations)})")
        return True
    else:
        print(f"✗ Failed to get conversations: {response.status_code}")
        return False

def main():
    print("=" * 60)
    print("CONVERSATION PERSISTENCE & ADMIN FEATURE TEST")
    print("=" * 60)
    
    # Test sequence
    test_user_conversations()
    test_sorting()
    
    # Create and test a new conversation
    new_conv_id = test_create_conversation()
    if new_conv_id:
        test_save_message(new_conv_id)
    
    # Test admin features
    test_admin_view_user_conversations()
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("✗ ERROR: Cannot connect to backend at http://localhost:3000")
        print("  Make sure the backend is running: cd backend && python3 app.py")
    except Exception as e:
        print(f"✗ ERROR: {e}")
