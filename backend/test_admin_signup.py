#!/usr/bin/env python3
"""
Complete test for Admin & Signup fixes
Run after restarting backend: python3 test_admin_signup.py
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:3000"

def test_admin_login():
    """Test admin can login"""
    print("\n[1] Admin Login Test")
    print("-" * 40)
    
    response = requests.post(f"{BASE_URL}/api/auth/login", 
        json={"username": "admin", "password": "admin123"})
    
    if response.status_code == 200:
        user = response.json()['user']
        print(f"✓ Admin login successful")
        print(f"  ID: {user['id']}")
        print(f"  Role: {user['role']}")
        return user['id']
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  {response.text}")
        return None

def test_admin_get_users(admin_id):
    """Test admin can view all users"""
    print("\n[2] Admin Get Users Test")
    print("-" * 40)
    
    headers = {"X-User-ID": admin_id}
    response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
    
    if response.status_code == 200:
        users = response.json()
        print(f"✓ Retrieved {len(users)} users")
        for user in users:
            print(f"  - {user['username']} ({user['role']})")
        return len(users) > 0
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  {response.text}")
        return False

def test_admin_get_user_conversations(admin_id):
    """Test admin can view a user's conversations"""
    print("\n[3] Admin Get User Conversations Test")
    print("-" * 40)
    
    headers = {"X-User-ID": admin_id}
    response = requests.get(
        f"{BASE_URL}/api/admin/users/stark/conversations?include_deleted=true",
        headers=headers)
    
    if response.status_code == 200:
        convs = response.json()
        print(f"✓ Retrieved {len(convs)} conversations for 'stark' user")
        if convs:
            print(f"  Most recent: {convs[0]['title']}")
            if len(convs) > 1:
                print(f"  Oldest: {convs[-1]['title']}")
        return True
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  {response.text}")
        return False

def test_admin_view_deleted_conversations(admin_id):
    """Test admin can view deleted conversations"""
    print("\n[4] Admin View Deleted Conversations Test")
    print("-" * 40)
    
    headers = {"X-User-ID": admin_id}
    response = requests.get(
        f"{BASE_URL}/api/admin/users/stark/conversations?include_deleted=true",
        headers=headers)
    
    if response.status_code == 200:
        convs = response.json()
        deleted = [c for c in convs if c.get('is_deleted')]
        print(f"✓ Can view deleted conversations")
        print(f"  Total conversations: {len(convs)}")
        print(f"  Deleted conversations: {len(deleted)}")
        return True
    else:
        print(f"✗ Failed: {response.status_code}")
        return False

def test_public_signup():
    """Test public signup endpoint (no authentication needed)"""
    print("\n[5] Public Signup Test (No Auth Required)")
    print("-" * 40)
    
    test_username = f"testuser_{int(datetime.now().timestamp())}"
    
    payload = {
        "username": test_username,
        "email": f"{test_username}@example.com",
        "password": "testpass123",
        "company": "Test Company"
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
    
    if response.status_code == 200:
        user = response.json()['user']
        print(f"✓ Signup successful (no auth needed!)")
        print(f"  Username: {user['username']}")
        print(f"  Email: {user['email']}")
        print(f"  Role: {user['role']}")
        print(f"  Company: {user['company']}")
        return test_username
    elif response.status_code == 400 and "already exists" in response.text:
        print(f"⚠ User already exists (endpoint is working)")
        return None
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  {response.text}")
        return None

def test_signup_then_login(username):
    """Test login after signup"""
    if not username:
        print("\n[6] Signup + Login Test - SKIPPED (no new user created)")
        return False
    
    print("\n[6] Signup + Login Test")
    print("-" * 40)
    
    response = requests.post(f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": "testpass123"})
    
    if response.status_code == 200:
        user = response.json()['user']
        print(f"✓ New user can login")
        print(f"  ID: {user['id']}")
        print(f"  Role: {user['role']}")
        return True
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  {response.text}")
        return False

def main():
    print("=" * 60)
    print("ADMIN & SIGNUP FIXES - COMPREHENSIVE TEST")
    print("=" * 60)
    
    results = {}
    
    # Test admin functionality
    admin_id = test_admin_login()
    if admin_id:
        results['admin_login'] = True
        results['admin_users'] = test_admin_get_users(admin_id)
        results['admin_conversations'] = test_admin_get_user_conversations(admin_id)
        results['admin_deleted'] = test_admin_view_deleted_conversations(admin_id)
    else:
        results['admin_login'] = False
        print("\n⚠ Skipping admin tests - login failed")
    
    # Test public signup
    new_user = test_public_signup()
    results['public_signup'] = new_user is not None or test_public_signup() == "⚠"
    
    # Test login after signup
    if new_user:
        results['signup_login'] = test_signup_then_login(new_user)
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for test, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test}")
    
    all_passed = all(results.values())
    print("\n" + ("✓ ALL TESTS PASSED!" if all_passed else "✗ SOME TESTS FAILED"))
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("✗ ERROR: Cannot connect to backend at http://localhost:3000")
        print("  Make sure backend is running: cd backend && python3 app.py")
    except Exception as e:
        print(f"✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
