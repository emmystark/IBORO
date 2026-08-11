#!/usr/bin/env python3
"""
Migration script to add user_id to existing conversations
"""
import json
from pathlib import Path

CONVERSATIONS_FILE = Path("./conversations.json")
DEFAULT_USER_ID = "stark"  # Assign old conversations to this user

def migrate():
    if not CONVERSATIONS_FILE.exists():
        print("No conversations.json found, nothing to migrate")
        return
    
    with open(CONVERSATIONS_FILE, 'r') as f:
        conversations = json.load(f)
    
    migrated_count = 0
    for conv_id, conv in conversations.items():
        if "user_id" not in conv or conv["user_id"] is None:
            print(f"Migrating conversation {conv_id}: adding user_id={DEFAULT_USER_ID}")
            conv["user_id"] = DEFAULT_USER_ID
            migrated_count += 1
    
    if migrated_count > 0:
        with open(CONVERSATIONS_FILE, 'w') as f:
            json.dump(conversations, f, indent=2)
        print(f"✓ Successfully migrated {migrated_count} conversations")
    else:
        print("No conversations needed migration (all have user_id)")

if __name__ == "__main__":
    migrate()
